import { describe, it, expect } from "vitest";
import { ToolCallParser } from "./tool-call-parser.js";

describe("ToolCallParser", () => {
  const parser = new ToolCallParser();

  describe("extractToolCallAttrs", () => {
    it("should extract id and name from tool_call tag", () => {
      const result = parser.extractToolCallAttrs('<tool_call id="call123" name="test_tool">');
      expect(result.id).toBe("call123");
      expect(result.name).toBe("test_tool");
    });

    it("should handle tool_call without id", () => {
      const result = parser.extractToolCallAttrs('<tool_call name="test_tool">');
      expect(result.id).toBeNull();
      expect(result.name).toBe("test_tool");
    });

    it("should handle tool_response tag", () => {
      const result = parser.extractToolCallAttrs('<tool_response id="response123">');
      expect(result.id).toBeNull();
      expect(result.name).toBe("response123");
    });

    it("should handle single quotes", () => {
      const result = parser.extractToolCallAttrs("<tool_call id='call456' name='my_tool'>");
      expect(result.id).toBe("call456");
      expect(result.name).toBe("my_tool");
    });

    it("should handle no quotes - not standard HTML, skip for now", () => {
      const result = parser.extractToolCallAttrs("<tool_call id=call789 name=another_tool>");
      expect(result.id).toBeNull();
    });
  });

  describe("isInternalTool", () => {
    it("should return true for internal tools", () => {
      expect(parser.isInternalTool("web_search")).toBe(true);
    });

    it("should return false for non-internal tools", () => {
      expect(parser.isInternalTool("browser")).toBe(false);
      expect(parser.isInternalTool("exec")).toBe(false);
    });
  });

  describe("parseArguments", () => {
    it("should parse valid JSON", () => {
      const result = parser.parseArguments('{"key": "value", "num": 123}');
      expect(result).toEqual({ key: "value", num: 123 });
    });

    it("should return raw string for invalid JSON", () => {
      const result = parser.parseArguments('not valid json');
      expect(result).toEqual({ raw: "not valid json" });
    });

    it("should handle empty string", () => {
      const result = parser.parseArguments("");
      expect(result).toEqual({});
    });

    it("should handle nested JSON", () => {
      const result = parser.parseArguments('{"outer": {"inner": "value"}}');
      expect(result).toEqual({ outer: { inner: "value" } });
    });
  });

  describe("parseToolCallStart", () => {
    it("should parse tool_call start tag", () => {
      const result = parser.parseToolCallStart('<tool_call id="call123" name="test_tool">');
      expect(result).not.toBeNull();
      expect(result?.toolId).toBe("call123");
      expect(result?.toolName).toBe("test_tool");
      expect(result?.isInternal).toBe(false);
    });

    it("should detect internal tools", () => {
      const result = parser.parseToolCallStart('<tool_call id="call123" name="web_search">');
      expect(result?.isInternal).toBe(true);
    });

    it("should return null for non-matching tag", () => {
      const result = parser.parseToolCallStart("<some_tag>");
      expect(result).toBeNull();
    });

    it("should generate unique id when not provided", () => {
      const result = parser.parseToolCallStart("<tool_call name=\"test\">");
      expect(result?.toolId).toMatch(/^call_\d+_[\w]+$/);
    });
  });

  describe("parseToolCallEnd", () => {
    it("should return true for tool_call end tag", () => {
      expect(parser.parseToolCallEnd("</tool_call>")).toBe(true);
    });

    it("should return true for tool_response end tag", () => {
      expect(parser.parseToolCallEnd("</tool_response>")).toBe(true);
    });

    it("should return false for non-matching tag", () => {
      expect(parser.parseToolCallEnd("</some_tag>")).toBe(false);
      expect(parser.parseToolCallEnd("<tool_call>")).toBe(false);
    });
  });

  describe("completeToolCall", () => {
    it("should complete tool call with parsed arguments", () => {
      const toolCall = {
        id: "call123",
        name: "test",
        arguments: {},
        raw: '{"arg1": "value1"}',
        isComplete: false,
      };
      const result = parser.completeToolCall(toolCall);
      expect(result.arguments).toEqual({ arg1: "value1" });
      expect(result.isComplete).toBe(true);
    });

    it("should handle invalid JSON in raw", () => {
      const toolCall = {
        id: "call123",
        name: "test",
        arguments: {},
        raw: "invalid json",
        isComplete: false,
      };
      const result = parser.completeToolCall(toolCall);
      expect(result.arguments).toEqual({ raw: "invalid json" });
      expect(result.isComplete).toBe(true);
    });
  });
});
