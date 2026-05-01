import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import {
  DeepSeekWebClient,
  type DeepSeekWebClientOptions,
} from "../providers/deepseek-web-client.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import {
  REGEX_THINK_START,
  REGEX_THINK_END,
  REGEX_FINAL_START,
  REGEX_FINAL_END,
  REGEX_TOOL_CALL_START,
  REGEX_TOOL_CALL_END,
  REGEX_REPLY,
  REGEX_MALFORMED_THINK,
  SESSION_TTL_MS,
  MAX_SESSIONS,
  CLEANUP_INTERVAL_MS,
  JUNK_TOKENS,
  INTERNAL_TOOLS,
  DEFAULT_TOOL_INSTRUCTIONS,
} from "./parsers/types.js";

type AssistantMessageWithThinking = AssistantMessage & {
  thinking_enabled?: boolean;
};

function setThinkingEnabled(msg: AssistantMessage, enabled: boolean): AssistantMessage {
  (msg as AssistantMessageWithThinking).thinking_enabled = enabled;
  return msg;
}

function getShortSessionId(sessionKey: string): string {
  if (sessionKey.length <= 8) return sessionKey;
  return sessionKey.slice(0, 4) + ".." + sessionKey.slice(-4);
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

interface DeepseekStreamOptions {
  searchEnabled?: boolean;
  preempt?: boolean;
  fileIds?: string[];
  signal?: AbortSignal;
}

type MessageContentPart = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  index?: number;
  id?: string;
};

interface DeepSeekStreamContext {
  sessionId: string;
  runId?: string;
  sessionKey?: string;
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string | MessageContentPart[];
  }>;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

type ToolResultContentPart = {
  type: "text";
  text: string;
};

type ToolResultMessageWithContent = ToolResultMessage & {
  content: string | ToolResultContentPart[];
};

const sessionMap = new Map<string, string>();
const parentMessageMap = new Map<string, string | number>();
const sessionTimestampMap = new Map<string, number>();

function extractToolCallAttrs(tag: string): { id: string | null; name: string } {
  const isToolResponse = tag.toLowerCase().includes("tool_response");
  const idMatch = tag.match(/\bid\s*=\s*(['"]?)([^'"'\s]+)\1/i);
  const nameMatch = tag.match(/\bname\s*=\s*(['"]?)([^'"'\s]*)\1/i);
  let id = idMatch ? idMatch[2] : null;
  let name = nameMatch ? nameMatch[2] : "";
  if (isToolResponse) {
    if (id && !name) {
      name = id;
      id = null;
    }
  }
  return { id, name };
}

function buildPrompt(
  messages: DeepSeekStreamContext["messages"],
  systemPrompt: string,
  tools: DeepSeekStreamContext["tools"],
  sessionId: string,
  parentMessageMap: Map<string, string | number>,
): string {
  const parentId = parentMessageMap.get(sessionId);

  if (!parentId) {
    const historyParts: string[] = [];

    let systemPromptContent = systemPrompt;

    if (tools.length > 0) {
      let toolPrompt = DEFAULT_TOOL_INSTRUCTIONS;
      for (const tool of tools) {
        toolPrompt += `#### ${tool.name}\n${tool.description}\n`;
        toolPrompt += `Parameters: ${JSON.stringify(tool.parameters)}\n\n`;
      }
      systemPromptContent += toolPrompt;
    }

    if (systemPromptContent && !messages.some((m) => m.role === "system")) {
      historyParts.push(`System: ${systemPromptContent}`);
    }

    for (const m of messages) {
      const msgRole = m.role;
      if (msgRole === "toolResult") {
        continue;
      }
      const role = msgRole === "user" ? "User" : "Assistant";
      let content = "";

      if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === "text") {
            content += (part).text;
          } else if (part.type === "thinking") {
            content += `<think>\n${(part).thinking}\n
</think>

\n`;
          } else if (part.type === "toolCall") {
            const tc = part;
            content += `<tool_call id="${tc.id}" name="${tc.name}">${JSON.stringify(tc.arguments)}</tool_call>`;
          }
        }
      } else {
        content = String(m.content);
      }

      historyParts.push(`${role}: ${content}`);
    }

    return historyParts.join("\n\n");
  } else {
    const messagesList = messages as Array<{ role: string; content: string | MessageContentPart[]; toolCallId?: string; toolName?: string }>;
    const lastMsg = messagesList[messagesList.length - 1];
    if (lastMsg.role === "toolResult") {
      const lastUserIndex = [...messagesList].toReversed().findIndex((m) => m.role === "user");
      const cutoffIndex = lastUserIndex >= 0 ? messagesList.length - lastUserIndex : 0;
      const currentRoundToolResults = messagesList.slice(cutoffIndex).filter((m) => m.role === "toolResult");
      console.log(`[buildPrompt] messagesList.length=${messagesList.length}, lastUserIndex=${lastUserIndex}, cutoffIndex=${cutoffIndex}, currentRoundToolResults.length=${currentRoundToolResults.length}`);
      if (currentRoundToolResults.length > 0) {
        const responses = currentRoundToolResults.map((tr) => {
          let resultText = "";
          if (Array.isArray(tr.content)) {
            for (const part of tr.content) {
              if (part.type === "text") {
                resultText += part.text;
              }
            }
          }
          return `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>`;
        }).join("\n");
        return `${responses}\n\nPlease proceed based on these tool results.`;
      }
    }

    const lastUserMessage = [...messagesList].toReversed().find((m) => m.role === "user");
    if (lastUserMessage) {
      if (typeof lastUserMessage.content === "string") {
        return lastUserMessage.content;
      } else if (Array.isArray(lastUserMessage.content)) {
        return lastUserMessage.content
          .filter((part) => part.type === "text")
          .map((part) => (part as TextContent).text)
          .join("");
      }
    }
  }
  return "";
}

let lastCleanup = Date.now();

function cleanupOldSessions(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && sessionMap.size < MAX_SESSIONS) {
    return;
  }
  lastCleanup = now;

  for (const [key, timestamp] of sessionTimestampMap.entries()) {
    if (now - timestamp > SESSION_TTL_MS) {
      sessionMap.delete(key);
      parentMessageMap.delete(key);
      sessionTimestampMap.delete(key);
      console.log(`🧹 清理 | 过期: ${key.slice(0, 8)}`);
    }
  }

  if (sessionMap.size > MAX_SESSIONS) {
    const entries = [...sessionTimestampMap.entries()]
      .toSorted((a, b) => a[1] - b[1])
      .slice(0, sessionMap.size - MAX_SESSIONS);
    for (const [key] of entries) {
      sessionMap.delete(key);
      parentMessageMap.delete(key);
      sessionTimestampMap.delete(key);
      console.log(`🧹 清理 | LRU: ${key.slice(0, 8)}`);
    }
  }
}

export function createDeepseekWebStreamFn(
  cookieOrJson: string,
  contextInfo?: { runId?: string; sessionKey?: string; streamDelayMs?: number },
): StreamFn {
  let options: string | DeepSeekWebClientOptions;
  try {
    const parsed = JSON.parse(cookieOrJson);
    if (typeof parsed === "string") {
      options = { cookie: parsed };
    } else {
      options = parsed;
    }
  } catch {
    options = { cookie: cookieOrJson };
  }
  const client = new DeepSeekWebClient(options);
  const defaultRunId = contextInfo?.runId;
  const defaultSessionKey = contextInfo?.sessionKey;
  const defaultStreamDelayMs = contextInfo?.streamDelayMs ?? 50;

  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        cleanupOldSessions();

        const streamContext = context as unknown as DeepSeekStreamContext;
        const sessionKey = streamContext.sessionId || defaultSessionKey || "default";
        const runId = streamContext.runId || defaultRunId;
        let dsSessionId = sessionMap.get(sessionKey);
        let parentId = parentMessageMap.get(sessionKey);

        if (!dsSessionId) {
          const session = await client.createChatSession();
          dsSessionId = session.chat_session_id || "";
          sessionMap.set(sessionKey, dsSessionId);
          parentId = undefined;
        }
        sessionTimestampMap.set(sessionKey, Date.now());

        const messages = streamContext.messages;
        const systemPrompt = streamContext.systemPrompt;
        const tools = streamContext.tools;

        const prompt = buildPrompt(messages, systemPrompt, tools, sessionKey, parentMessageMap);

        if (!prompt) {
          console.error(`[DeepseekWebStream] ❌ 无可发送的消息:`, JSON.stringify(messages));
          throw new Error("No message found to send to DeepSeek web API");
        }

        const streamOptions: DeepseekStreamOptions = options ?? {};

        const searchEnabled = streamOptions.searchEnabled ?? true;
        const preempt = streamOptions.preempt ?? false;
        const fileIds = streamOptions.fileIds || [];

        const estimateTokens = (text: string): number => {
          return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
        };

        const inputTokenCount = estimateTokens(prompt);
        let currentStatus = "发送中";
        console.log(
          `⚡ ${getShortSessionId(sessionKey)} → ${formatNumber(inputTokenCount)}`,
        );

        const updateStatus = (status: string) => {
          currentStatus = status;
          const icon = status === "思考" ? "⏳" : status === "思考完成" ? "💭" : "📤";
          console.log(
            `${icon} ${status}`,
          );
        };

        const endSession = () => {
          const outputTokens = Math.ceil(outputTokenCount / 4);
          const totalTokens = inputTokenCount + outputTokens;
          const stopReason = accumulatedToolCalls.length > 0 ? "🔧 tool_use" : "✓ stop";
          console.log(
            `✓ ${formatNumber(inputTokenCount)}→${formatNumber(outputTokens)} ${stopReason}`,
          );
        };

        const responseStream = await client.chatCompletions({
          sessionId: dsSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: model.id,
          searchEnabled,
          preempt,
          fileIds,
          signal: streamOptions.signal,
        });

        if (!responseStream) {
          throw new Error("DeepSeek Web API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        const accumulatedContentParts: string[] = [];
        const accumulatedReasoningParts: string[] = [];
        const accumulatedToolCalls: MessageContentPart[] = [];
        let buffer = "";
        let lastEmittedThinking = "";

        const getAccumulatedContent = () => accumulatedContentParts.join("");
        const getAccumulatedReasoning = () => accumulatedReasoningParts.join("");

        const emitThinkingEvent = (text: string, isStart: boolean = false) => {
          if (!runId) {
            return;
          }
          const prior = lastEmittedThinking ?? "";
          const delta = text.startsWith(prior) ? text.slice(prior.length) : text;
          if (!delta && !isStart) {
            return;
          }
          lastEmittedThinking = text;
          emitAgentEvent({
            runId,
            stream: "thinking",
            data: { text, delta },
            sessionKey: streamContext.sessionKey,
          });
        };

        let outputTokenCount = 0;
        let hasTextStarted = false;

        // Buffer for streamed text output
        let textBuffer = "";
        let lastFlushTime = 0;
        let flushTimeout: ReturnType<typeof setTimeout> | null = null;
        let thinkingBuffer = "";
        let thinkingFlushTimeout: ReturnType<typeof setTimeout> | null = null;

        const flushTextBuffer = () => {
          if (textBuffer.length === 0) return;
          const flushedText = textBuffer;
          textBuffer = "";
          lastFlushTime = Date.now();

          const key = "text";
          let index = indexMap.get(key);
          if (index === undefined) {
            index = nextIndex++;
            indexMap.set(key, index);
            contentParts[index] = { type: "text", text: "" };
            stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
            if (!hasTextStarted) {
              hasTextStarted = true;
              updateStatus("输出");
            }
          }
          (contentParts[index] as TextContent).text += flushedText;
          accumulatedContentParts.push(flushedText);
          outputTokenCount += Buffer.byteLength(flushedText, "utf8");
          stream.push({
            type: "text_delta",
            contentIndex: index,
            delta: flushedText,
            text: flushedText,
            partial: createPartial(),
          } as any);
          if (runId) {
            const fullText = getAccumulatedContent();
            emitAgentEvent({
              runId,
              stream: "assistant",
              data: { text: fullText, delta: flushedText },
              sessionKey: streamContext.sessionKey,
            });
          }
        };

        const flushThinkingBuffer = () => {
          if (thinkingBuffer.length === 0) return;
          const flushedThinking = thinkingBuffer;
          thinkingBuffer = "";

          const key = "thinking";
          let index = indexMap.get(key);
          if (index === undefined) {
            index = nextIndex++;
            indexMap.set(key, index);
            contentParts[index] = { type: "thinking", thinking: "" };
            stream.push({
              type: "thinking_start",
              contentIndex: index,
              partial: createPartial(),
            });
            emitThinkingEvent("", true);
          }
          (contentParts[index] as ThinkingContent).thinking += flushedThinking;
          accumulatedReasoningParts.push(flushedThinking);
          stream.push({
            type: "thinking_delta",
            contentIndex: index,
            delta: flushedThinking,
          } as any);
          const fullThinking = getAccumulatedReasoning();
          emitThinkingEvent(fullThinking, false);
        };

        const scheduleTextFlush = () => {
          if (textBuffer.length === 0) return;
          flushTextBuffer();
        };

        const scheduleThinkingFlush = () => {
          if (thinkingBuffer.length === 0) return;
          flushThinkingBuffer();
        };

        // Sequential indexing for pi-ai AssistantMessage events
        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];

        const createPartial = (): AssistantMessage => {
          const msg: AssistantMessage = {
            role: "assistant",
            content: [...contentParts],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
            timestamp: Date.now(),
          };
          return setThinkingEnabled(msg, !!getAccumulatedReasoning());
        };

        // Stateful parser for tags in the text stream
        let currentMode: "text" | "thinking" | "tool_call" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";
        let skippingInternalTool = false;

        const emitDelta = (
          type: "text" | "thinking" | "toolcall",
          delta: string,
          forceId?: string,
        ) => {
          if (delta === "" && type !== "toolcall") {
            return;
          }

          if (type === "text") {
            const wasEmpty = textBuffer === "";
            textBuffer += delta;
            if (wasEmpty) {
              flushTextBuffer();
            } else {
              scheduleTextFlush();
            }
            return;
          }

          if (type === "thinking") {
            thinkingBuffer += delta;
            scheduleThinkingFlush();
            return;
          }

          const key = type === "toolcall" ? `tool_${currentToolIndex}` : type;
          if (!indexMap.has(key)) {
            const index = nextIndex++;
            indexMap.set(key, index);

            if (type === "toolcall") {
              const toolId = forceId || `call_${Date.now()}_${index}`;
              contentParts[index] = {
                type: "toolCall",
                id: toolId,
                name: currentToolName,
                arguments: {},
              };
              accumulatedToolCalls[currentToolIndex] = {
                type: "tool_call",
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
                id: toolId,
              };
              stream.push({
                type: "toolcall_start",
                contentIndex: index,
                partial: createPartial(),
              });
            }
          }

          const index = indexMap.get(key)!;
          if (type === "toolcall") {
            accumulatedToolCalls[currentToolIndex].arguments += delta;
            stream.push({
              type: "toolcall_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          }
        };

        const emitDeltaByMode = (delta: string) => {
          if (skippingInternalTool) {
            return;
          }
          if (currentMode === "thinking") {
            emitDelta("thinking", delta);
          } else if (currentMode === "tool_call") {
            emitDelta("toolcall", delta);
          } else {
            emitDelta("text", delta);
          }
        };

        const pushDelta = (delta: string, forceType?: "text" | "thinking") => {
          if (!delta) {
            return;
          }

          if (JUNK_TOKENS.has(delta)) {
            return;
          }

          if (forceType === "thinking") {
            emitDelta("thinking", delta);
            return;
          }

          tagBuffer += delta;

          const checkTags = () => {
            const thinkStartMatch = tagBuffer.match(REGEX_THINK_START);
            const thinkEndMatch = tagBuffer.match(REGEX_THINK_END);
            const finalStartMatch = tagBuffer.match(REGEX_FINAL_START);
            const finalEndMatch = tagBuffer.match(REGEX_FINAL_END);
            const toolCallStartMatch = tagBuffer.match(REGEX_TOOL_CALL_START);
            const toolCallEndMatch = tagBuffer.match(REGEX_TOOL_CALL_END);
            const replyMatch = tagBuffer.match(REGEX_REPLY);
            const malformedThinkMatch = tagBuffer.match(REGEX_MALFORMED_THINK);

            // Priority: find the first occurring tag
            const indices = [
              {
                type: "think_start",
                idx: thinkStartMatch ? thinkStartMatch.index! : -1,
                len: thinkStartMatch ? thinkStartMatch[0].length : 0,
              },
              {
                type: "think_end",
                idx: thinkEndMatch ? thinkEndMatch.index! : -1,
                len: thinkEndMatch ? thinkEndMatch[0].length : 0,
              },
              {
                type: "final_start",
                idx: finalStartMatch ? finalStartMatch.index! : -1,
                len: finalStartMatch ? finalStartMatch[0].length : 0,
              },
              {
                type: "final_end",
                idx: finalEndMatch ? finalEndMatch.index! : -1,
                len: finalEndMatch ? finalEndMatch[0].length : 0,
              },
              {
                type: "tool_call_start",
                idx: toolCallStartMatch ? toolCallStartMatch.index! : -1,
                len: toolCallStartMatch ? toolCallStartMatch[0].length : 0,
                ...extractToolCallAttrs(toolCallStartMatch ? toolCallStartMatch[0] : ""),
              },
              {
                type: "tool_call_end",
                idx: toolCallEndMatch ? toolCallEndMatch.index! : -1,
                len: toolCallEndMatch ? toolCallEndMatch[0].length : 0,
              },
              {
                type: "reply_marker",
                idx: replyMatch ? replyMatch.index! : -1,
                len: replyMatch ? replyMatch[0].length : 0,
              },
              {
                type: "think_start", // Treat malformed think> as start
                idx: malformedThinkMatch ? malformedThinkMatch.index! : -1,
                len: malformedThinkMatch ? malformedThinkMatch[0].length : 0,
              },
            ]
              .filter((tag) => tag.idx !== -1)
              .toSorted((a, b) => a.idx - b.idx);

            if (indices.length > 0) {
              const first = indices[0];
              const before = tagBuffer.slice(0, first.idx);

              if (before) {
                emitDeltaByMode(before);
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
                updateStatus("思考");
              } else if (first.type === "think_end") {
                currentMode = "text";
                updateStatus("思考完成");
              } else if (first.type === "final_start") {
                currentMode = "text";
              } else if (first.type === "final_end") {
                currentMode = "text";
              } else if (first.type === "reply_marker") {
                currentMode = "text";
              } else if (first.type === "tool_call_start") {
                const attrs = first as { id?: string | null; name?: string };
                const toolName = attrs.name || "";
                if (INTERNAL_TOOLS.has(toolName)) {
                  skippingInternalTool = true;
                  currentMode = "text";
                  const toolId = attrs.id || `call_${Date.now()}_${currentToolIndex}`;
                  if (runId) {
                    emitAgentEvent({
                      runId,
                      stream: "tool",
                      data: {
                        phase: "start",
                        name: toolName,
                        toolCallId: toolId,
                        args: {} as Record<string, unknown>,
                      },
                      sessionKey: streamContext.sessionKey,
                    });
                  }
                } else {
                  currentMode = "tool_call";
                  currentToolName = toolName;
                  const toolId = attrs.id || `call_${Date.now()}_${currentToolIndex}`;
                  emitDelta("toolcall", "", toolId);
                }
              } else if (first.type === "tool_call_end") {
                if (skippingInternalTool) {
                  skippingInternalTool = false;
                  if (runId) {
                    emitAgentEvent({
                      runId,
                      stream: "tool",
                      data: {
                        phase: "result",
                        name: currentToolName,
                        toolCallId: `call_${Date.now()}_${currentToolIndex}`,
                        isError: false,
                        result: "",
                      },
                      sessionKey: streamContext.sessionKey,
                    });
                  }
                  currentMode = "text";
                } else {
                  const key = `tool_${currentToolIndex}`;
                  const index = indexMap.get(key);
                  if (index !== undefined && currentToolIndex < accumulatedToolCalls.length) {
                    const part = contentParts[index] as ToolCall;
                    const argData = accumulatedToolCalls[currentToolIndex].arguments;
                    const argStr = typeof argData === "string" ? argData : JSON.stringify(argData);
                    try {
                      part.arguments = JSON.parse(argStr);
                    } catch (e) {
                      part.arguments = { raw: argStr };
                    }
                    const argsStr = JSON.stringify(part.arguments);
                    console.log(`\x1b[34m🔧 ${part.name}: ${argsStr}\x1b[0m`);
                    stream.push({
                      type: "toolcall_end",
                      contentIndex: index,
                      toolCall: part,
                      partial: createPartial(),
                    });
                  }
                  currentMode = "text";
                  currentToolIndex++;
                  currentToolName = "";
                }
              }

              tagBuffer = tagBuffer.slice(first.idx + first.len);
              checkTags();
            } else {
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                emitDeltaByMode(tagBuffer);
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                emitDeltaByMode(safe);
                tagBuffer = tagBuffer.slice(lastAngle);
              }
            }
          };

          checkTags();
        };

        const processLine = (line: string) => {
          if (!line) {
            return;
          }

          if (line.startsWith("event: ")) {
            return; // We don't strictly need currentEvent if we trust the data structure
          }

          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              return;
            }
            if (!dataStr) {
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              // Verbose logging for debugging
              // console.log(`[DeepseekWebStream] SSE Data: ${dataStr}`);

              // Capture session/message continuity
              if (data.response_message_id) {
                if (data.response_message_id !== parentMessageMap.get(sessionKey)) {
                  parentMessageMap.set(sessionKey, data.response_message_id);
                }
              }

              // 1. Path update or explicit type for reasoning
              if (
                (data.p?.includes("reasoning") || data.type === "thinking") &&
                typeof data.v === "string"
              ) {
                pushDelta(data.v, "thinking");
                return;
              }
              if (data.type === "thinking" && typeof data.content === "string") {
                pushDelta(data.content, "thinking");
                return;
              }

              // 2. Direct string value, content path, or explicit type (XML tags might be here)
              if (
                typeof data.v === "string" &&
                (!data.p || data.p.includes("content") || data.p.includes("choices"))
              ) {
                pushDelta(data.v);
                return;
              }
              if (data.type === "text" && typeof data.content === "string") {
                pushDelta(data.content);
                return;
              }

              // 2.5 search results (if enabled)
              if (data.type === "search_result" || data.p?.includes("search_results")) {
                const searchData = data.v || data.content;
                const query =
                  typeof searchData === "string"
                    ? searchData
                    : (searchData as { query?: string })?.query;
                if (query) {
                  const searchMsg = `\n> [Researching: ${query}...]\n`;
                  if (currentMode === "thinking") {
                    emitDelta("thinking", searchMsg);
                  } else {
                    emitDelta("text", searchMsg);
                  }
                }
                return;
              }

              // 3. Nested fragments (init)
              const fragments = data.v?.response?.fragments;
              if (Array.isArray(fragments)) {
                for (const frag of fragments) {
                  if (frag.type === "THINKING" || frag.type === "reasoning") {
                    pushDelta(frag.content || "", "thinking");
                  } else if (frag.content) {
                    pushDelta(frag.content);
                  }
                }
                return;
              }

              // 4. Standard OpenAI-like choices (just in case)
              const choice = data.choices?.[0];
              if (choice) {
                if (choice.delta?.reasoning_content) {
                  pushDelta(choice.delta.reasoning_content, "thinking");
                }
                if (choice.delta?.content) {
                  pushDelta(choice.delta.content);
                }
              }
            } catch (e) {
              console.log(`⚠️ JSON错误: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }

            // Flush any remaining tag buffer
            if (tagBuffer) {
              const mode = currentMode as unknown as string;
              if (mode === "thinking") {
                emitDelta("thinking", tagBuffer);
              } else if (mode === "tool_call") {
                emitDelta("toolcall", tagBuffer);
              } else {
                emitDelta("text", tagBuffer);
              }
              tagBuffer = "";
            }
            skippingInternalTool = false;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const combined = buffer + chunk;
          const parts = combined.split("\n");
          buffer = parts.pop() || ""; // Save partial line

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        // Flush remaining buffers before finishing
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
        flushTextBuffer();
        if (thinkingFlushTimeout) {
          clearTimeout(thinkingFlushTimeout);
          thinkingFlushTimeout = null;
        }
        flushThinkingBuffer();

        const finalContent = contentParts.filter((part) => {
          if (part.type === "toolCall") {
            return !INTERNAL_TOOLS.has(part.name);
          }
          if (part.type === "thinking" && !part.thinking) {
            return false;
          }
          if (part.type === "text" && !part.text) {
            return false;
          }
          return true;
        });

        const outputTokens = Math.ceil(outputTokenCount / 4);
        const stopReason = accumulatedToolCalls.length > 0 ? "🔧 tool" : "✓ stop";

        const toolCallParts = finalContent.filter((p) => p.type === "toolCall");
        let toolInfo = "";
        if (toolCallParts.length > 0) {
          const toolSummary = toolCallParts.map(p => p.name).join(", ");
          toolInfo = ` → ${toolSummary}`;
        }

        console.log(
          `✓ ${formatNumber(inputTokenCount)}→${formatNumber(outputTokens)} ${stopReason}${toolInfo}`,
        );

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: finalContent,
          stopReason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: inputTokenCount,
            output: Math.ceil(outputTokenCount / 4),
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: inputTokenCount + Math.ceil(outputTokenCount / 4),
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          timestamp: Date.now(),
        };
        setThinkingEnabled(assistantMessage, !!getAccumulatedReasoning());

        stream.push({
          type: "done",
          reason: assistantMessage.stopReason as "stop" | "length" | "toolUse",
          message: assistantMessage,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage,
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        } as AssistantMessageEvent);
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
