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

export const STREAM_ADAPTER_V2_ENV_KEY = "OPENCLAW_STREAM_ADAPTER_V2";
export const STREAM_ADAPTER_V2 = process.env[STREAM_ADAPTER_V2_ENV_KEY] !== "false";

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const MAX_SESSIONS = 100;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export const DEFAULT_TOOL_INSTRUCTIONS = `
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
