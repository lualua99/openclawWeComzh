import type { StreamAdapterOptions, ParsedToolCall, ParsedThinking } from "./types.js";
import { ToolCallParser } from "./tool-call-parser.js";
import { ThinkingParser } from "./thinking-parser.js";
import { JUNK_TOKENS, REGEX_REPLY } from "./types.js";

export type DeepSeekEventType =
  | "text_start"
  | "text_delta"
  | "thinking_start"
  | "thinking_delta"
  | "toolcall_start"
  | "toolcall_delta"
  | "toolcall_end"
  | "done"
  | "error";

export interface DeepSeekEvent {
  type: DeepSeekEventType;
  data: unknown;
  timestamp: number;
}

interface ParsedToolCallInternal extends ParsedToolCall {
  index: number;
}

/**
 * Adapts DeepSeek Web API SSE stream to structured events.
 * Implements AsyncIterable for easy integration with streaming consumers.
 * Integrates ToolCallParser and ThinkingParser for tag extraction.
 */
export class DeepSeekStreamAdapter {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private decoder: TextDecoder;
  private toolCallParser: ToolCallParser;
  private thinkingParser: ThinkingParser;
  private options: StreamAdapterOptions;

  private buffer: string = "";
  private currentMode: "text" | "thinking" | "tool_call" = "text";
  private currentToolName: string = "";
  private currentToolIndex: number = 0;
  private tagBuffer: string = "";
  private skippingInternalTool: boolean = false;
  private lastEmittedThinking: string = "";

  private accumulatedToolCalls: ParsedToolCallInternal[] = [];
  private accumulatedContent: string[] = [];
  private accumulatedReasoning: string[] = [];

  private done: boolean = false;
  private error: Error | null = null;

  private eventQueue: DeepSeekEvent[] = [];
  private resolveNext: ((event: DeepSeekEvent | null) => void) | null = null;

  private static readonly MAX_QUEUE_SIZE = 1000;
  private static readonly QUEUE_WARN_THRESHOLD = 500;

  constructor(
    stream: ReadableStream<Uint8Array>,
    options: StreamAdapterOptions = {},
  ) {
    this.reader = stream.getReader();
    this.decoder = new TextDecoder();
    this.toolCallParser = new ToolCallParser();
    this.thinkingParser = new ThinkingParser();
    this.options = options;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<DeepSeekEvent> {
    while (!this.done) {
      const event = await this.nextEvent();
      if (event === null) {
        break;
      }
      yield event;
    }
  }

  private nextEvent(): Promise<DeepSeekEvent | null> {
    return new Promise((resolve) => {
      if (this.eventQueue.length > 0) {
        resolve(this.eventQueue.shift()!);
        return;
      }
      if (this.error) {
        const event: DeepSeekEvent = {
          type: "error",
          data: this.error,
          timestamp: Date.now(),
        };
        this.done = true;
        resolve(event);
        return;
      }
      this.resolveNext = resolve;
      this.pump();
    });
  }

  private async pump(): Promise<void> {
    try {
      while (this.eventQueue.length === 0 && !this.done) {
        const { done, value } = await this.reader.read();
        if (done) {
          this.processEnd();
          break;
        }
        const chunk = this.decoder.decode(value, { stream: true });
        this.processChunk(chunk);
      }
    } catch (e) {
      this.error = e instanceof Error ? e : new Error(String(e));
      if (this.resolveNext) {
        const event: DeepSeekEvent = {
          type: "error",
          data: this.error,
          timestamp: Date.now(),
        };
        this.resolveNext(event);
        this.resolveNext = null;
      }
    }
  }

  private processChunk(chunk: string): void {
    const combined = this.buffer + chunk;
    const parts = combined.split("\n");
    this.buffer = parts.pop() || "";

    for (const part of parts) {
      this.processLine(part.trim());
    }
  }

  private processLine(line: string): void {
    if (!line) {
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
        this.processSSEData(data);
      } catch (e) {
        console.warn(`[DeepSeekStreamAdapter] JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private processSSEData(data: Record<string, unknown>): void {
    if (
      (data.p?.includes("reasoning") || data.type === "thinking") &&
      typeof data.v === "string"
    ) {
      this.pushDelta(data.v, "thinking");
      return;
    }
    if (data.type === "thinking" && typeof data.content === "string") {
      this.pushDelta(data.content, "thinking");
      return;
    }

    if (
      typeof data.v === "string" &&
      (!data.p || data.p.includes("content") || data.p.includes("choices"))
    ) {
      this.pushDelta(data.v);
      return;
    }
    if (data.type === "text" && typeof data.content === "string") {
      this.pushDelta(data.content);
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
        this.pushDelta(searchMsg);
      }
      return;
    }

    const fragments = data.v?.response?.fragments;
    if (Array.isArray(fragments)) {
      for (const frag of fragments) {
        if (frag.type === "THINKING" || frag.type === "reasoning") {
          this.pushDelta(frag.content || "", "thinking");
        } else if (frag.content) {
          this.pushDelta(frag.content);
        }
      }
      return;
    }

    const choice = data.choices?.[0];
    if (choice) {
      if (choice.delta?.reasoning_content) {
        this.pushDelta(choice.delta.reasoning_content, "thinking");
      }
      if (choice.delta?.content) {
        this.pushDelta(choice.delta.content);
      }
    }
  }

  private pushDelta(delta: string, forceType?: "text" | "thinking"): void {
    if (!delta) {
      return;
    }

    if (JUNK_TOKENS.has(delta)) {
      return;
    }

    if (forceType === "thinking") {
      this.emitThinkingDelta(delta);
      return;
    }

    this.tagBuffer += delta;
    this.checkTags();
  }

  private checkTags(): void {
    const toolCallStartMatch = this.tagBuffer.match(/<(?:tool_call|tool_response)(?:\s+[^>]*)?>/i);
    const toolCallEndMatch = this.tagBuffer.match(/<\/(?:tool_call|tool_response)\b[^<>]*>/i);
    const replyMatch = this.tagBuffer.match(REGEX_REPLY);

    const indices: Array<{
      type: "tool_call_start" | "tool_call_end" | "reply_marker";
      idx: number;
      len: number;
      attrs?: Record<string, string | null>;
    }> = [];

    if (toolCallStartMatch) {
      const attrs = this.toolCallParser.extractToolCallAttrs(toolCallStartMatch[0]);
      indices.push({
        type: "tool_call_start",
        idx: toolCallStartMatch.index!,
        len: toolCallStartMatch[0].length,
        attrs,
      });
    }
    if (toolCallEndMatch) {
      indices.push({
        type: "tool_call_end",
        idx: toolCallEndMatch.index!,
        len: toolCallEndMatch[0].length,
      });
    }
    if (replyMatch) {
      indices.push({
        type: "reply_marker",
        idx: replyMatch.index!,
        len: replyMatch[0].length,
      });
    }

    if (indices.length === 0) {
      const lastAngle = this.tagBuffer.lastIndexOf("<");
      if (lastAngle === -1) {
        this.emitByMode(this.tagBuffer);
        this.tagBuffer = "";
      } else if (lastAngle > 0) {
        const safe = this.tagBuffer.slice(0, lastAngle);
        this.emitByMode(safe);
        this.tagBuffer = this.tagBuffer.slice(lastAngle);
      }
      return;
    }

    const sortedIndices = indices
      .filter((tag) => tag.idx !== -1)
      .toSorted((a, b) => a.idx - b.idx);

    const first = sortedIndices[0];
    const before = this.tagBuffer.slice(0, first.idx);

    if (before) {
      this.emitByMode(before);
    }

    if (first.type === "tool_call_start") {
      const attrs = first.attrs || { id: null, name: "" };
      const toolName = attrs.name || "";
      if (this.toolCallParser.isInternalTool(toolName)) {
        this.skippingInternalTool = true;
        this.currentMode = "text";
      } else {
        this.currentMode = "tool_call";
        this.currentToolName = toolName;
        const toolId = attrs.id || `call_${Date.now()}_${this.currentToolIndex}`;
        const toolCall: ParsedToolCallInternal = {
          id: toolId,
          name: toolName,
          arguments: {},
          raw: "",
          isComplete: false,
          index: this.currentToolIndex,
        };
        this.accumulatedToolCalls.push(toolCall);
        this.emitToolCallStart(toolCall);
      }
    } else if (first.type === "tool_call_end") {
      if (this.skippingInternalTool) {
        this.skippingInternalTool = false;
        this.currentMode = "text";
      } else {
        const currentToolCall = this.accumulatedToolCalls[this.currentToolIndex];
        if (currentToolCall) {
          const completed = this.toolCallParser.completeToolCall(currentToolCall);
          this.accumulatedToolCalls[this.currentToolIndex] = completed;
          this.emitToolCallEnd(completed);
        }
        this.currentMode = "text";
        this.currentToolIndex++;
        this.currentToolName = "";
      }
    } else if (first.type === "reply_marker") {
      this.currentMode = "text";
    }

    this.tagBuffer = this.tagBuffer.slice(first.idx + first.len);
    this.checkTags();
  }

  private emitByMode(delta: string): void {
    if (this.skippingInternalTool) {
      return;
    }

    const thinkingResults = this.thinkingParser.parse(delta);
    for (const result of thinkingResults) {
      if (result.isComplete) {
        const event: DeepSeekEvent = {
          type: "thinking_delta",
          data: { content: result.content, delta: "", isComplete: true },
          timestamp: Date.now(),
        };
        this.emitEvent(event);
      } else if (result.delta) {
        if (this.thinkingParser.getIsInThinking()) {
          if (this.options.onThinking) {
            this.options.onThinking(result.delta, result.content);
          }
          const event: DeepSeekEvent = {
            type: "thinking_delta",
            data: { content: result.content, delta: result.delta, isComplete: false },
            timestamp: Date.now(),
          };
          this.emitEvent(event);
        } else {
          if (this.options.onText) {
            this.options.onText(result.delta, result.content);
          }
          const event: DeepSeekEvent = {
            type: "text_delta",
            data: { content: result.content, delta: result.delta },
            timestamp: Date.now(),
          };
          this.emitEvent(event);
        }
        this.accumulatedContent.push(result.delta);
      }
    }
  }

  private emitThinkingDelta(delta: string): void {
    this.currentMode = "thinking";
    const previous = this.lastEmittedThinking;
    const fullThinking = previous + delta;
    this.lastEmittedThinking = fullThinking;

    if (this.options.onThinking) {
      this.options.onThinking(delta, fullThinking);
    }

    const event: DeepSeekEvent = {
      type: "thinking_delta",
      data: { content: fullThinking, delta },
      timestamp: Date.now(),
    };
    this.emitEvent(event);
    this.accumulatedReasoning.push(delta);
  }

  private emitToolCallStart(toolCall: ParsedToolCallInternal): void {
    const event: DeepSeekEvent = {
      type: "toolcall_start",
      data: toolCall,
      timestamp: Date.now(),
    };
    this.emitEvent(event);
  }

  private emitToolCallEnd(toolCall: ParsedToolCallInternal): void {
    const event: DeepSeekEvent = {
      type: "toolcall_end",
      data: toolCall,
      timestamp: Date.now(),
    };
    this.emitEvent(event);

    if (this.options.onToolCall) {
      this.options.onToolCall(toolCall);
    }
  }

  private emitEvent(event: DeepSeekEvent): void {
    if (this.eventQueue.length >= DeepSeekStreamAdapter.MAX_QUEUE_SIZE) {
      console.warn(`[DeepSeekStreamAdapter] Event queue overflow (${this.eventQueue.length}), dropping oldest events`);
      this.eventQueue.shift();
    } else if (this.eventQueue.length >= DeepSeekStreamAdapter.QUEUE_WARN_THRESHOLD) {
      console.warn(`[DeepSeekStreamAdapter] Event queue growing large (${this.eventQueue.length}/${DeepSeekStreamAdapter.MAX_QUEUE_SIZE})`);
    }

    if (this.resolveNext) {
      this.resolveNext(event);
      this.resolveNext = null;
    } else {
      this.eventQueue.push(event);
    }
  }

  private processEnd(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer.trim());
    }

    if (this.tagBuffer) {
      if (this.currentMode === "thinking") {
        this.emitThinkingDelta(this.tagBuffer);
      } else if (this.currentMode === "tool_call") {
        const toolCall = this.accumulatedToolCalls[this.currentToolIndex];
        if (toolCall) {
          toolCall.raw += this.tagBuffer;
        }
      } else {
        this.emitByMode(this.tagBuffer);
      }
      this.tagBuffer = "";
    }

    const event: DeepSeekEvent = {
      type: "done",
      data: {
        content: this.accumulatedContent.join(""),
        reasoning: this.accumulatedReasoning.join(""),
        toolCalls: this.accumulatedToolCalls,
      },
      timestamp: Date.now(),
    };
    this.emitEvent(event);
    this.done = true;
  }

  getAccumulatedContent(): string {
    return this.accumulatedContent.join("");
  }

  getAccumulatedReasoning(): string {
    return this.accumulatedReasoning.join("");
  }

  getToolCalls(): ParsedToolCall[] {
    return this.accumulatedToolCalls;
  }

  abort(): void {
    this.reader.cancel().catch(() => {});
    this.done = true;
    this.error = new Error("Aborted");

    if (this.resolveNext) {
      this.resolveNext(null);
      this.resolveNext = null;
    }
  }
}
