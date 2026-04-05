import { getThinkingConfig } from "../config/thinking-config.ts";

export interface IncrementalThinkingUpdate {
  content: string;
  delta: string;
  isComplete: boolean;
}

export type ThinkingUpdateCallback = (update: IncrementalThinkingUpdate) => void;

export class ThinkingOptimizer {
  private pendingContent: string = "";
  private debounceTimer: number | null = null;
  private callback: ThinkingUpdateCallback;
  private debounceMs: number;
  private maxContentLength: number;
  private lastEmitContent: string = "";
  private isStreaming: boolean = false;

  constructor(callback: ThinkingUpdateCallback) {
    this.callback = callback;
    const config = getThinkingConfig();
    this.debounceMs = config.debounceMs;
    this.maxContentLength = config.maxContentLength;
  }

  addContent(delta: string, isComplete: boolean = false): void {
    this.isStreaming = !isComplete;
    
    if (this.pendingContent.length >= this.maxContentLength) {
      const overflow = this.pendingContent.length - this.maxContentLength + delta.length;
      this.pendingContent = this.pendingContent.slice(overflow) + delta;
    } else {
      this.pendingContent += delta;
    }

    if (isComplete) {
      this.flushNow();
      return;
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.debounceTimer !== null) {
      return;
    }

    this.debounceTimer = window.setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  private flush(): void {
    this.debounceTimer = null;

    if (this.pendingContent === this.lastEmitContent) {
      return;
    }

    const delta = this.pendingContent.slice(this.lastEmitContent.length);
    this.lastEmitContent = this.pendingContent;

    this.callback({
      content: this.pendingContent,
      delta,
      isComplete: false,
    });
  }

  flushNow(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingContent !== this.lastEmitContent) {
      const delta = this.pendingContent.slice(this.lastEmitContent.length);
      this.lastEmitContent = this.pendingContent;

      this.callback({
        content: this.pendingContent,
        delta,
        isComplete: true,
      });
    }
  }

  reset(): void {
    this.pendingContent = "";
    this.lastEmitContent = "";
    this.isStreaming = false;
    
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  updateDebounceMs(ms: number): void {
    this.debounceMs = ms;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  getContent(): string {
    return this.pendingContent;
  }

  destroy(): void {
    this.reset();
  }
}

export function createThinkingOptimizer(callback: ThinkingUpdateCallback): ThinkingOptimizer {
  return new ThinkingOptimizer(callback);
}
