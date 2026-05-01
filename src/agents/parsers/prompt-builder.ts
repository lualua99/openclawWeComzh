import type { DeepSeekStreamContext, ToolDefinition } from "./types.js";
import { DEFAULT_TOOL_INSTRUCTIONS } from "./types.js";

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
      const toolResults = messages.filter((m) => m.role === "toolResult");
      let resultText = "";

      for (const tr of toolResults) {
        const trMsg = tr as unknown as ToolResultMessage;
        if (Array.isArray(trMsg.content)) {
          for (const part of trMsg.content) {
            if (part.type === "text") {
              resultText += `<tool_response id="${trMsg.toolCallId}" name="${trMsg.toolName}">\n${part.text}\n</tool_response>\n\n`;
            }
          }
        } else if (typeof trMsg.content === "string") {
          resultText += `<tool_response id="${trMsg.toolCallId}" name="${trMsg.toolName}">\n${trMsg.content}\n</tool_response>\n\n`;
        }
      }

      if (resultText) {
        return `${resultText}Please proceed based on these tool results.`;
      }
    }

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
    return "";
  }

  formatToolResult(toolCallId: string, toolName: string, resultText: string): string {
    return `\n<tool_response id="${toolCallId}" name="${toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
  }

  setDefaultToolInstructions(instructions: string): void {
    this.defaultToolInstructions = instructions;
  }
}
