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
import { SessionManager, getGlobalSessionManager } from "./session-manager.js";
import { PromptBuilder } from "./prompt-builder.js";
import { DeepSeekStreamAdapter } from "./deepseek-stream-adapter.js";
import {
  REGEX_THINK_START,
  REGEX_THINK_END,
  REGEX_FINAL_START,
  REGEX_FINAL_END,
  REGEX_TOOL_CALL_START,
  REGEX_TOOL_CALL_END,
  REGEX_REPLY,
  REGEX_MALFORMED_THINK,
  INTERNAL_TOOLS,
  STREAM_ADAPTER_V2,
  SESSION_TTL_MS,
  MAX_SESSIONS,
  CLEANUP_INTERVAL_MS,
} from "./types.js";

type AssistantMessageWithThinking = AssistantMessage & {
  thinking_enabled?: boolean;
};

function setThinkingEnabled(msg: AssistantMessage, enabled: boolean): AssistantMessage {
  (msg as AssistantMessageWithThinking).thinking_enabled = enabled;
  return msg;
}

const FEATURE_FLAG = STREAM_ADAPTER_V2;

interface DeepseekStreamOptions {
  searchEnabled?: boolean;
  preempt?: boolean;
  fileIds?: string[];
  signal?: AbortSignal;
}

interface DeepSeekStreamContext {
  sessionId: string;
  runId?: string;
  sessionKey?: string;
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string | Array<{
      type: string;
      text?: string;
      thinking?: string;
      name?: string;
      arguments?: string | Record<string, unknown>;
      index?: number;
      id?: string;
    }>;
  }>;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

const sessionMap = new Map<string, string>();
const parentMessageMap = new Map<string, string | number>();
const sessionTimestampMap = new Map<string, number>();

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
    }
  }
}

export function createDeepseekWebStreamFn(cookieOrJson: string): StreamFn {
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

  if (FEATURE_FLAG) {
    return createStreamFnV2(client, options as DeepSeekWebClientOptions);
  }

  return createStreamFnV1(client, options as DeepSeekWebClientOptions);
}

function createStreamFnV1(
  client: DeepSeekWebClient,
  options: DeepSeekWebClientOptions,
): StreamFn {
  return (model, context, streamOptions) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        cleanupOldSessions();

        const streamContext = context as unknown as DeepSeekStreamContext;
        const sessionKey = streamContext.sessionId || "default";
        const runId = streamContext.runId;
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
          throw new Error("No message found to send to DeepSeek web API");
        }

        const searchEnabled = streamOptions?.searchEnabled ?? true;
        const preempt = streamOptions?.preempt ?? false;
        const fileIds = streamOptions?.fileIds || [];

        const responseStream = await client.chatCompletions({
          sessionId: dsSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: model.id,
          searchEnabled,
          preempt,
          fileIds,
          signal: streamOptions?.signal,
        });

        if (!responseStream) {
          throw new Error("DeepSeek Web API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        const accumulatedContentParts: string[] = [];
        const accumulatedReasoningParts: string[] = [];
        const accumulatedToolCalls: Array<{
          type: string;
          name: string;
          arguments: string;
          index: number;
          id: string;
        }> = [];
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

        const estimateTokens = (text: string): number => {
          return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
        };

        const inputTokenCount = estimateTokens(prompt);
        let outputTokenCount = 0;

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

        let currentMode: "text" | "thinking" | "tool_call" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";
        let skippingInternalTool = false;

        const extractToolCallAttrs = (tag: string): { id: string | null; name: string } => {
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
        };

        const emitDelta = (
          type: "text" | "thinking" | "toolcall",
          delta: string,
          forceId?: string,
        ) => {
          if (delta === "" && type !== "toolcall") {
            return;
          }

          const key = type === "toolcall" ? `tool_${currentToolIndex}` : type;
          if (!indexMap.has(key)) {
            const index = nextIndex++;
            indexMap.set(key, index);

            if (type === "text") {
              contentParts[index] = { type: "text", text: "" };
              stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
            } else if (type === "thinking") {
              contentParts[index] = { type: "thinking", thinking: "" };
              stream.push({
                type: "thinking_start",
                contentIndex: index,
                partial: createPartial(),
              });
              emitThinkingEvent("", true);
            } else if (type === "toolcall") {
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
          if (type === "text") {
            (contentParts[index] as TextContent).text += delta;
            accumulatedContentParts.push(delta);
            outputTokenCount += Buffer.byteLength(delta, "utf8");
            stream.push({
              type: "text_delta",
              contentIndex: index,
              delta,
              text: delta,
              partial: createPartial(),
            } as any);
            if (runId) {
              const fullText = getAccumulatedContent();
              emitAgentEvent({
                runId,
                stream: "assistant",
                data: { text: fullText, delta },
                sessionKey: streamContext.sessionKey,
              });
            }
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            accumulatedReasoningParts.push(delta);
            stream.push({
              type: "thinking_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
            emitThinkingEvent(getAccumulatedReasoning());
          } else if (type === "toolcall") {
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
                type: "think_start",
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
              } else if (first.type === "think_end") {
                currentMode = "text";
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
                } else {
                  currentMode = "tool_call";
                  currentToolName = toolName;
                  const toolId = attrs.id || `call_${Date.now()}_${currentToolIndex}`;
                  emitDelta("toolcall", "", toolId);
                }
              } else if (first.type === "tool_call_end") {
                if (skippingInternalTool) {
                  skippingInternalTool = false;
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
                    } catch {
                      part.arguments = { raw: argStr };
                    }
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
            return;
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

              if (data.response_message_id) {
                if (data.response_message_id !== parentMessageMap.get(sessionKey)) {
                  parentMessageMap.set(sessionKey, data.response_message_id);
                }
              }

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
              console.warn(`[DeepSeek] JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }

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
          buffer = parts.pop() || "";

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        const totalTokens = inputTokenCount + Math.ceil(outputTokenCount / 4);

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

function createStreamFnV2(
  client: DeepSeekWebClient,
  options: DeepSeekWebClientOptions,
): StreamFn {
  const sessionManager = getGlobalSessionManager();
  const promptBuilder = new PromptBuilder();

  return (model, context, streamOptions) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        sessionManager.prune();

        const streamContext = context as unknown as DeepSeekStreamContext;
        const sessionKey = streamContext.sessionId || "default";
        const runId = streamContext.runId;

        let session = sessionManager.get(sessionKey);
        let dsSessionId = session?.dsSessionId;
        let parentId = session?.parentId;

        if (!dsSessionId) {
          const chatSession = await client.createChatSession();
          dsSessionId = chatSession.chat_session_id || "";
          sessionManager.set(sessionKey, dsSessionId);
          parentId = undefined;
        } else {
          sessionManager.set(sessionKey, dsSessionId, parentId);
        }

        const messages = streamContext.messages;
        const systemPrompt = streamContext.systemPrompt;
        const tools = streamContext.tools;

        const prompt = promptBuilder.build(messages, systemPrompt, tools, sessionKey, parentId);

        if (!prompt) {
          throw new Error("No message found to send to DeepSeek web API");
        }

        const searchEnabled = streamOptions?.searchEnabled ?? true;
        const preempt = streamOptions?.preempt ?? false;
        const fileIds = streamOptions?.fileIds || [];

        const responseStream = await client.chatCompletions({
          sessionId: dsSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: model.id,
          searchEnabled,
          preempt,
          fileIds,
          signal: streamOptions?.signal,
        });

        if (!responseStream) {
          throw new Error("DeepSeek Web API returned empty response body");
        }

        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];
        const accumulatedToolCalls: ToolCall[] = [];

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
          return msg;
        };

        let lastThinkingContent = "";

        const adapter = new DeepSeekStreamAdapter(responseStream, {
          signal: streamOptions?.signal,
          onThinking: (delta, full) => {
            if (!runId) return;
            lastThinkingContent = full;
            emitAgentEvent({
              runId,
              stream: "thinking",
              data: { text: full, delta },
              sessionKey: streamContext.sessionKey,
            });
          },
          onToolCall: (toolCall) => {
            if (runId) {
              emitAgentEvent({
                runId,
                stream: "tool",
                data: {
                  toolCallId: toolCall.id,
                  name: toolCall.name,
                  args: toolCall.arguments,
                  phase: "result",
                },
                sessionKey: streamContext.sessionKey,
              });
            }
          },
        });

        for await (const event of adapter) {
          switch (event.type) {
            case "text_delta": {
              const data = event.data as { content: string; delta: string };
              const key = "text";
              if (!indexMap.has(key)) {
                const index = nextIndex++;
                indexMap.set(key, index);
                contentParts[index] = { type: "text", text: "" };
                stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
              }
              const index = indexMap.get(key)!;
              (contentParts[index] as TextContent).text += data.delta;
              stream.push({
                type: "text_delta",
                contentIndex: index,
                delta: data.delta,
                text: data.delta,
                partial: createPartial(),
              } as any);
              if (runId) {
                const fullText = (contentParts[index] as TextContent).text;
                emitAgentEvent({
                  runId,
                  stream: "assistant",
                  data: { text: fullText, delta: data.delta },
                  sessionKey: streamContext.sessionKey,
                });
              }
              break;
            }
            case "thinking_delta": {
              const data = event.data as { content: string; delta: string };
              const key = "thinking";
              if (!indexMap.has(key)) {
                const index = nextIndex++;
                indexMap.set(key, index);
                contentParts[index] = { type: "thinking", thinking: "" };
                stream.push({
                  type: "thinking_start",
                  contentIndex: index,
                  partial: createPartial(),
                });
              }
              const index = indexMap.get(key)!;
              (contentParts[index] as ThinkingContent).thinking += data.delta;
              stream.push({
                type: "thinking_delta",
                contentIndex: index,
                delta: data.delta,
                partial: createPartial(),
              });
              break;
            }
            case "toolcall_start": {
              const toolCall = event.data as {
                id: string;
                name: string;
                arguments: Record<string, unknown> | string;
              };
              const index = nextIndex++;
              const toolCallPart: ToolCall = {
                type: "toolCall",
                id: toolCall.id,
                name: toolCall.name,
                arguments: toolCall.arguments,
              };
              contentParts[index] = toolCallPart;
              accumulatedToolCalls.push(toolCallPart);
              stream.push({
                type: "toolcall_start",
                contentIndex: index,
                partial: createPartial(),
              });
              break;
            }
            case "toolcall_delta": {
              const data = event.data as { content?: string; delta?: string };
              const index = accumulatedToolCalls.length - 1;
              if (index >= 0 && contentParts[index]?.type === "toolCall") {
                const delta = data.delta || "";
                const existingArgs = (contentParts[index] as ToolCall).arguments;
                if (typeof existingArgs === "string") {
                  (contentParts[index] as ToolCall).arguments = existingArgs + delta;
                }
                stream.push({
                  type: "toolcall_delta",
                  contentIndex: index,
                  delta,
                  partial: createPartial(),
                });
              }
              break;
            }
            case "toolcall_end": {
              const toolCall = event.data as {
                id: string;
                name: string;
                arguments: Record<string, unknown>;
              };
              const index = accumulatedToolCalls.length - 1;
              if (index >= 0 && contentParts[index]?.type === "toolCall") {
                (contentParts[index] as ToolCall).arguments = toolCall.arguments;
                stream.push({
                  type: "toolcall_end",
                  contentIndex: index,
                  toolCall: contentParts[index] as ToolCall,
                  partial: createPartial(),
                });
              }
              break;
            }
            case "done": {
              const data = event.data as {
                content: string;
                reasoning: string;
                toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
              };

              const finalContent = contentParts.filter((part) => {
                if (part.type === "toolCall") {
                  return !INTERNAL_TOOLS.has(part.name);
                }
                if (part.type === "thinking" && !(part as ThinkingContent).thinking) {
                  return false;
                }
                if (part.type === "text" && !(part as TextContent).text) {
                  return false;
                }
                return true;
              });

              const assistantMessage: AssistantMessage = {
                role: "assistant",
                content: finalContent,
                stopReason: (data.toolCalls && data.toolCalls.length > 0) ? "toolUse" : "stop",
                api: model.api,
                provider: model.provider,
                model: model.id,
                usage: {
                  input: Math.ceil(Buffer.byteLength(prompt, "utf8") / 4),
                  output: Math.ceil(Buffer.byteLength(data.content, "utf8") / 4),
                  cacheRead: 0,
                  cacheWrite: 0,
                  totalTokens: 0,
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                },
                timestamp: Date.now(),
              };
              setThinkingEnabled(assistantMessage, !!data.reasoning);

              stream.push({
                type: "done",
                reason: assistantMessage.stopReason as "stop" | "length" | "toolUse",
                message: assistantMessage,
              });
              break;
            }
            case "error": {
              const error = event.data as Error;
              stream.push({
                type: "error",
                reason: "error",
                error: {
                  role: "assistant",
                  content: [],
                  stopReason: "error",
                  errorMessage: error.message,
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
              break;
            }
          }
        }
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

function buildPrompt(
  messages: DeepSeekStreamContext["messages"],
  systemPrompt: string,
  tools: DeepSeekStreamContext["tools"],
  sessionId: string,
  parentMessageMap: Map<string, string | number>,
): string {
  const DEFAULT_TOOL_INSTRUCTIONS = `
## Tool Use Instructions
You are equipped with specialized tools to perform actions or retrieve information. 
To use a tool, output a specific XML tag: <tool_call id="unique_id" name="tool_name">{"arg": "value"}</tool_call>. 
Rules for tool use:
1. ALWAYS think before calling a tool. Explain your reasoning inside <think> tags.
2. The 'id' attribute should be a unique 8-character string for each call.
3. Output the tool call tag ONLY inside a <final> section if you are in reasoning mode.
4. Wait for the tool result before proceeding with further analysis.

### Special Instructions for Browser Tool
- **Profile 'openclaw' (Independent/Recommended)**: Opens a SEPARATE independent browser window. Use this for consistent, isolated sessions. Highly recommended for complex automation.
- Profile 'chrome' (Shared): Uses your existing Chrome tabs (requires extension). Use this if you need to access personal logins or already open tabs.
- **CONSISTENCY RULE**: Once you have started using a profile (or if you are switched to 'openclaw' due to connection errors), STAY with that profile for the remainder of the session. Do NOT switch back and forth as it will open redundant browser instances.

### Automation Policy
- DO NOT use the 'exec' tool to install secondary automation libraries like Playwright, Selenium, or Puppeteer if the 'browser' tool fails.
- Instead, inform the user about the connection issue or try the alternative browser profile ('openclaw').
- Installing automation tools via 'exec' is slow and redundant; the 'browser' tool is the primary way to interact with web content.

### Multi-Agent Orchestration Protocol (三阶段 FSM)
When the user gives a COMPLEX multi-step task, follow this 3-phase workflow:

#### Phase 1: PLANNING (规划阶段)
1. Call \`write_todos\` with action \`create_plan\` and a description — this creates plan with phase=planning
2. Call \`write_todos\` with action \`add_todo\` for each major step (at least 3-5 steps)
3. Present the implementation plan to the user as a structured overview
4. Tell the user: "计划已创建，请在侧边栏确认后开始执行"
5. When user sends 批准/approve/开始/确认/执行, IMMEDIATELY proceed to Phase 2

#### Phase 2: EXECUTION (执行阶段) — FULLY AUTOMATIC
Once approved, execute ALL steps without stopping:
1. Call \`write_todos(set_phase, phase="execution")\` to transition
2. For EACH todo: update status to in_progress → do the work (use browser/exec/web_fetch tools or sessions_spawn for subagents) → update status to done (pass the output as \`result\` if applicable)
3. When using \`sessions_spawn\` to delegate a complex task, the tool automatically waits for the subagent to finish and returns its output inline. You must read it and then proceed.
4. Do NOT stop between steps. Complete ALL todos in sequence automatically.

#### Phase 3: VERIFICATION (验证阶段)
After ALL todos are done:
1. Call \`write_todos(set_phase, phase="verification")\`
2. Synthesize all results into a consolidated report
3. Call \`write_todos(complete_plan)\` to finalize

Example:
\`\`\`
<tool_call id="plan0001" name="write_todos">{"action": "create_plan", "description": "Research task"}</tool_call>
<tool_call id="todo0001" name="write_todos">{"action": "add_todo", "title": "Step 1"}</tool_call>
\`\`\`

[CRITICAL]: To use a tool, you MUST output the exact XML format: 
<tool_call id="unique_id" name="tool_name">{"param": "value"}</tool_call>. 
Writing about tools in plain text WILL NOT execute them.

### Available Tools
`;

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
      const role = m.role === "assistant" ? "Assistant" : m.role === "user" ? "User" : m.role;
      let content = "";

      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === "text") {
            content += `\n${part.text}\n`;
          } else if (part.type === "thinking") {
            content += `\n${part.thinking}\n`;
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
    const messagesList = messages as Array<{ role: string; content: string | Array<{ type: string; text?: string }>; toolCallId?: string; toolName?: string }>;
    const lastMsg = messagesList[messagesList.length - 1];
    if (lastMsg.role === "toolResult") {
      const lastUserIndex = [...messagesList].toReversed().findIndex((m) => m.role === "user");
      const cutoffIndex = lastUserIndex >= 0 ? messagesList.length - lastUserIndex : 0;
      const currentRoundToolResults = messagesList.slice(cutoffIndex).filter((m) => m.role === "toolResult");
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
