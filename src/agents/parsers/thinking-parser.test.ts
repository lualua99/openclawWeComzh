import { describe, it, expect } from "vitest";
import { ThinkingParser } from "./thinking-parser.js";

describe("ThinkingParser", () => {
  describe("basic parsing", () => {
    it("should parse thinking tags correctly", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("Hello world");

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("Hello world");
      expect(results[0].delta).toBe("Hello world");
      expect(results[0].isComplete).toBe(false);
    });

    it("should handle think start tag", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("Before<think>Inside");

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe("Before");
      expect(results[0].delta).toBe("Before");
      expect(results[1].content).toBe("Inside");
      expect(results[1].delta).toBe("Inside");
      expect(parser.getIsInThinking()).toBe(true);
    });

    it("should handle think end tag", () => {
      const parser = new ThinkingParser();
      parser.parse("Before<think>Inside");
      const results = parser.parse("After</think>");

      const completeResults = results.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("Inside");
      expect(parser.getIsInThinking()).toBe(false);
    });

    it("should handle complete think block", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("<think>Reasoning here</think>");

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe("");
      expect(results[0].isComplete).toBe(false);
      expect(results[1].content).toBe("Reasoning here");
      expect(results[1].isComplete).toBe(true);
    });
  });

  describe("thinking tag variations", () => {
    it("should handle thinking tag", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("<thinking>Deep thought</thinking>");

      const completeResults = results.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("Deep thought");
    });

    it("should handle thought tag", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("<thought>Quick thought</thought>");

      const completeResults = results.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("Quick thought");
    });

    it("should handle malformed think>", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("\nthink>Malformed start");

      expect(parser.getIsInThinking()).toBe(true);
    });
  });

  describe("final tags", () => {
    it("should handle final start tag", () => {
      const parser = new ThinkingParser();
      parser.parse("<think>Thinking");
      const results = parser.parse("Final<final>");

      const completeResults = results.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("Thinking");
      expect(parser.getIsInThinking()).toBe(false);
    });

    it("should handle final end tag", () => {
      const parser = new ThinkingParser();
      const results = parser.parse("Text</final>");

      expect(parser.getIsInThinking()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset state", () => {
      const parser = new ThinkingParser();
      parser.parse("<think>Thinking</think>");

      expect(parser.getIsInThinking()).toBe(false);
      expect(parser.getContent()).toBe("Thinking");

      parser.reset();

      expect(parser.getIsInThinking()).toBe(true);
      expect(parser.getContent()).toBe("");
    });
  });

  describe("incremental parsing", () => {
    it("should handle incremental thinking content", () => {
      const parser = new ThinkingParser();

      const part1 = parser.parse("<think>First part");
      expect(part1).toHaveLength(1);
      expect(parser.getIsInThinking()).toBe(true);

      const part2 = parser.parse(" second part");
      expect(part2).toHaveLength(1);
      expect(part2[0].content).toBe("First part second part");

      const part3 = parser.parse(" third</think>");
      const completeResults = part3.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("First part second part third");
    });
  });

  describe("multiple thinking blocks", () => {
    it("should handle multiple thinking blocks", () => {
      const parser = new ThinkingParser();

      parser.parse("<think>First</think>");
      expect(parser.getContent()).toBe("First");

      const results = parser.parse("<think>Second</think>");
      const completeResults = results.filter((r) => r.isComplete);
      expect(completeResults).toHaveLength(1);
      expect(completeResults[0].content).toBe("Second");
    });
  });
});
