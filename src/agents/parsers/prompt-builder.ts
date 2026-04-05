import type { DeepSeekStreamContext, ToolDefinition } from "./types.js";

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

interface MessageContentPart {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  index?: number;
  id?: string;
}

interface StreamMessage {
  role: string;
  content: string | MessageContentPart[];
}

interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: string | Array<{ type: "text"; text: string }>;
}

/**
 * Builds prompt strings for DeepSeek Web API from message history.
 * Handles system prompts, tool definitions, and tool results formatting.
 */
export class PromptBuilder {
  private defaultToolInstructions: string;

  constructor(defaultToolInstructions: string = DEFAULT_TOOL_INSTRUCTIONS) {
    this.defaultToolInstructions = defaultToolInstructions;
  }

  build(
    messages: StreamMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
    sessionId: string,
    parentId?: string | number,
  ): string {
    if (!parentId) {
      return this.buildInitialPrompt(messages, systemPrompt, tools);
    } else {
      return this.buildContinuingPrompt(messages);
    }
  }

  private buildInitialPrompt(
    messages: StreamMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
  ): string {
    const historyParts: string[] = [];

    let systemPromptContent = systemPrompt;

    if (tools.length > 0) {
      let toolPrompt = this.defaultToolInstructions;
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
  }

  private buildContinuingPrompt(messages: StreamMessage[]): string {
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "toolResult") {
      const tr = lastMsg as unknown as ToolResultMessage;
      let resultText = "";
      if (Array.isArray(tr.content)) {
        for (const part of tr.content) {
          if (part.type === "text") {
            resultText += part.text;
          }
        }
      } else if (typeof tr.content === "string") {
        resultText = tr.content;
      }
      return `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
    } else {
      const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
      if (lastUserMessage) {
        if (typeof lastUserMessage.content === "string") {
          return lastUserMessage.content;
        } else if (Array.isArray(lastUserMessage.content)) {
          return lastUserMessage.content
            .filter((part) => part.type === "text")
            .map((part) => (part as { text: string }).text)
            .join("");
        }
      }
    }
    return "";
  }

  formatToolResult(toolCallId: string, toolName: string, resultText: string): string {
    return `\n<tool_response id="${toolCallId}" name="${toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
  }

  setDefaultToolInstructions(instructions: string): void {
    this.defaultToolInstructions = instructions;
  }
}
