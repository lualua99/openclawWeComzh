export interface StreamAdapterOptions {
  signal?: AbortSignal;
  onThinking?: (delta: string, full: string) => void;
  onToolCall?: (toolCall: ParsedToolCall) => void;
  onText?: (delta: string, full: string) => void;
  onError?: (error: Error) => void;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown> | string;
  raw: string;
  isComplete: boolean;
}

export interface ParsedThinking {
  content: string;
  delta: string;
  isComplete: boolean;
}

export interface ParsedText {
  content: string;
  delta: string;
}

export type StreamEventType =
  | "text_start"
  | "text_delta"
  | "text_end"
  | "thinking_start"
  | "thinking_delta"
  | "thinking_end"
  | "toolcall_start"
  | "toolcall_delta"
  | "toolcall_end"
  | "done"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

export interface ToolCallAttrs {
  id: string | null;
  name: string;
}

export interface StreamParserState {
  mode: "text" | "thinking" | "tool_call";
  currentToolName: string;
  currentToolIndex: number;
  tagBuffer: string;
  skippingInternalTool: boolean;
}

export interface SessionData {
  dsSessionId: string;
  parentId: string | number | undefined;
  lastUpdated: number;
}

export interface SessionManagerOptions {
  ttlMs?: number;
  maxSessions?: number;
  cleanupIntervalMs?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface MessageContentPart {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  index?: number;
  id?: string;
}

export interface StreamMessage {
  role: string;
  content: string | MessageContentPart[];
}

export interface DeepSeekStreamContext {
  sessionId: string;
  runId?: string;
  sessionKey?: string;
  systemPrompt: string;
  messages: StreamMessage[];
  tools: ToolDefinition[];
}

export interface DeepseekStreamOptions {
  searchEnabled?: boolean;
  preempt?: boolean;
  fileIds?: string[];
  signal?: AbortSignal;
}

export const JUNK_TOKENS = new Set([
  "<｜end▁of▁thinking｜>",
  "<|endoftext|>",
]);

export const INTERNAL_TOOLS = new Set(["web_search"]);

export const REGEX_THINK_START = /<(?:think(?:ing)?|thought)\b[^<>]*>/i;
export const REGEX_THINK_END = /<\/(?:think(?:ing)?|thought)\b[^<>]*>/i;
export const REGEX_FINAL_START = /<final\b[^<>]*>/i;
export const REGEX_FINAL_END = /<\/final\b[^<>]*>/i;
export const REGEX_TOOL_CALL_START = /<(?:tool_call|tool_response)(?:\s+[^>]*)?>/i;
export const REGEX_TOOL_CALL_END = /<\/(?:tool_call|tool_response)\b[^<>]*>/i;
export const REGEX_REPLY = /\[\[reply_to_current\]\]/i;
export const REGEX_MALFORMED_THINK = /\n?think\s*>/i;
