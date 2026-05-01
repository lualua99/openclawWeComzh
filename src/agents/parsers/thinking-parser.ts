import type { ParsedThinking, StreamParserState } from "./types.js";
import {
  REGEX_THINK_START,
  REGEX_THINK_END,
  REGEX_FINAL_START,
  REGEX_FINAL_END,
  REGEX_MALFORMED_THINK,
} from "./types.js";

/**
 * Parses thinking tags (<think>, </thinking>, [(deep_think)]) from streaming responses.
 * Supports incremental parsing with buffer accumulation.
 */
export class ThinkingParser {
  private accumulatedContent: string = "";
  private isInThinking: boolean = false;
  private thinkStartRegex: RegExp;
  private thinkEndRegex: RegExp;
  private finalStartRegex: RegExp;
  private finalEndRegex: RegExp;
  private malformedThinkRegex: RegExp;

  constructor() {
    this.thinkStartRegex = new RegExp(REGEX_THINK_START.source, REGEX_THINK_START.flags);
    this.thinkEndRegex = new RegExp(REGEX_THINK_END.source, REGEX_THINK_END.flags);
    this.finalStartRegex = new RegExp(REGEX_FINAL_START.source, REGEX_FINAL_START.flags);
    this.finalEndRegex = new RegExp(REGEX_FINAL_END.source, REGEX_FINAL_END.flags);
    this.malformedThinkRegex = new RegExp(REGEX_MALFORMED_THINK.source, REGEX_MALFORMED_THINK.flags);
  }

  /**
   * Resets the parser state for a new stream.
   */
  reset(): void {
    this.accumulatedContent = "";
    this.isInThinking = false;
  }

  getContent(): string {
    return this.accumulatedContent;
  }

  getIsInThinking(): boolean {
    return this.isInThinking;
  }

  parseTag(buffer: string): {
    type: "think_start" | "think_end" | "final_start" | "final_end" | "none";
    content: string;
    remaining: string;
    isMalformed: boolean;
  } {
    const indices: Array<{
      type: "think_start" | "think_end" | "final_start" | "final_end" | "think_start";
      idx: number;
      len: number;
    }> = [];

    const thinkStartMatch = buffer.match(this.thinkStartRegex);
    const thinkEndMatch = buffer.match(this.thinkEndRegex);
    const finalStartMatch = buffer.match(this.finalStartRegex);
    const finalEndMatch = buffer.match(this.finalEndRegex);
    const malformedThinkMatch = buffer.match(this.malformedThinkRegex);

    if (thinkStartMatch) {
      indices.push({
        type: "think_start",
        idx: thinkStartMatch.index!,
        len: thinkStartMatch[0].length,
      });
    }
    if (thinkEndMatch) {
      indices.push({
        type: "think_end",
        idx: thinkEndMatch.index!,
        len: thinkEndMatch[0].length,
      });
    }
    if (finalStartMatch) {
      indices.push({
        type: "final_start",
        idx: finalStartMatch.index!,
        len: finalStartMatch[0].length,
      });
    }
    if (finalEndMatch) {
      indices.push({
        type: "final_end",
        idx: finalEndMatch.index!,
        len: finalEndMatch[0].length,
      });
    }
    if (malformedThinkMatch) {
      indices.push({
        type: "think_start",
        idx: malformedThinkMatch.index!,
        len: malformedThinkMatch[0].length,
      });
    }

    if (indices.length === 0) {
      return {
        type: "none",
        content: "",
        remaining: buffer,
        isMalformed: false,
      };
    }

    const sortedIndices = indices
      .filter((tag) => tag.idx !== -1)
      .toSorted((a, b) => a.idx - b.idx);

    const first = sortedIndices[0];
    const before = buffer.slice(0, first.idx);
    const isMalformed = first.type === "think_start" && buffer.match(this.malformedThinkRegex) !== null;

    return {
      type: first.type,
      content: before,
      remaining: buffer.slice(first.idx + first.len),
      isMalformed,
    };
  }

  parse(delta: string): ParsedThinking[] {
    const results: ParsedThinking[] = [];
    let buffer = delta;

    while (buffer.length > 0) {
      const tagResult = this.parseTag(buffer);

      if (tagResult.content) {
        if (this.isInThinking) {
          const previousContent = this.accumulatedContent;
          this.accumulatedContent += tagResult.content;
          results.push({
            content: this.accumulatedContent,
            delta: tagResult.content,
            isComplete: false,
          });
        } else {
          results.push({
            content: tagResult.content,
            delta: tagResult.content,
            isComplete: false,
          });
        }
      }

      if (tagResult.type === "think_start") {
        this.isInThinking = true;
      } else if (tagResult.type === "think_end") {
        if (this.isInThinking) {
          results.push({
            content: this.accumulatedContent,
            delta: "",
            isComplete: true,
          });
        }
        this.isInThinking = false;
      } else if (tagResult.type === "final_start" || tagResult.type === "final_end") {
        if (this.isInThinking) {
          results.push({
            content: this.accumulatedContent,
            delta: "",
            isComplete: true,
          });
        }
        this.accumulatedContent = "";
        this.isInThinking = false;
      }

      buffer = tagResult.remaining;
    }

    return results;
  }

  getState(): StreamParserState {
    return {
      mode: this.isInThinking ? "thinking" : "text",
      currentToolName: "",
      currentToolIndex: 0,
      tagBuffer: "",
      skippingInternalTool: false,
    };
  }
}
