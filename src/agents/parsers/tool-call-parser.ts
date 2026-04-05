import type { ParsedToolCall, ToolCallAttrs } from "./types.js";
import {
  REGEX_TOOL_CALL_START,
  REGEX_TOOL_CALL_END,
  INTERNAL_TOOLS,
} from "./types.js";

/**
 * Parses XML tool call tags from DeepSeek Web API responses.
 * Handles tool_call and tool_response tags with id and name attributes.
 * Provides fault-tolerant JSON argument parsing.
 */
export class ToolCallParser {
  private internalTools: Set<string>;
  private toolCallStartRegex: RegExp;
  private toolCallEndRegex: RegExp;

  /**
   * Creates a new parser with optional custom internal tools set.
   * @param internalTools - Set of tool names to treat as internal (skip in output)
   */
  constructor(internalTools: Set<string> = INTERNAL_TOOLS) {
    this.internalTools = internalTools;
    this.toolCallStartRegex = new RegExp(REGEX_TOOL_CALL_START.source, REGEX_TOOL_CALL_START.flags);
    this.toolCallEndRegex = new RegExp(REGEX_TOOL_CALL_END.source, REGEX_TOOL_CALL_END.flags);
  }

  extractToolCallAttrs(tag: string): ToolCallAttrs {
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

  isInternalTool(name: string): boolean {
    return this.internalTools.has(name);
  }

  parseArguments(argData: string): Record<string, unknown> | string {
    if (!argData || argData.trim() === "") {
      return {};
    }
    try {
      const parsed = JSON.parse(argData);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
      return { raw: argData };
    } catch {
      return { raw: argData };
    }
  }

  parseToolCallStart(tag: string): { toolId: string; toolName: string; isInternal: boolean } | null {
    const match = tag.match(this.toolCallStartRegex);
    if (!match) {
      return null;
    }
    const attrs = this.extractToolCallAttrs(tag);
    const toolName = attrs.name || "";
    const toolId = attrs.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      toolId,
      toolName,
      isInternal: this.isInternalTool(toolName),
    };
  }

  parseToolCallEnd(tag: string): boolean {
    return this.toolCallEndRegex.test(tag);
  }

  createEmptyToolCall(id: string, name: string): ParsedToolCall {
    return {
      id,
      name,
      arguments: {},
      raw: "",
      isComplete: false,
    };
  }

  completeToolCall(toolCall: ParsedToolCall): ParsedToolCall {
    const args = toolCall.raw;
    const parsedArgs = this.parseArguments(args);
    return {
      ...toolCall,
      arguments: parsedArgs,
      isComplete: true,
    };
  }
}

export function extractToolCallAttrs(tag: string): ToolCallAttrs {
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
