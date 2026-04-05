import { getToolStreamConfig } from "../config/tool-stream-config.ts";

export interface IncrementalToolUpdate {
  toolCallId: string;
  phase: "start" | "update" | "result";
  delta?: string;
  full?: string;
}

export type ToolUpdateCallback = (update: IncrementalToolUpdate) => void;

export class ToolStreamOptimizer {
  private pendingUpdates: Map<string, IncrementalToolUpdate> = new Map();
  private throttleTimer: number | null = null;
  private callback: ToolUpdateCallback;
  private throttleMs: number;

  constructor(callback: ToolUpdateCallback) {
    this.callback = callback;
    this.throttleMs = getToolStreamConfig().throttleMs;
  }

  addUpdate(update: IncrementalToolUpdate): void {
    const existing = this.pendingUpdates.get(update.toolCallId);
    
    if (!existing) {
      this.pendingUpdates.set(update.toolCallId, update);
    } else {
      if (update.phase === "result") {
        this.pendingUpdates.set(update.toolCallId, update);
      } else if (update.phase === "update" && existing.phase === "update") {
        this.pendingUpdates.set(update.toolCallId, {
          ...update,
          delta: (existing.delta || "") + (update.delta || ""),
          full: update.full,
        });
      } else {
        this.pendingUpdates.set(update.toolCallId, update);
      }
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.throttleTimer !== null) {
      return;
    }

    this.throttleTimer = window.setTimeout(() => {
      this.flush();
    }, this.throttleMs);
  }

  private flush(): void {
    this.throttleTimer = null;

    for (const update of this.pendingUpdates.values()) {
      this.callback(update);
    }

    this.pendingUpdates.clear();
  }

  flushNow(): void {
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.flush();
  }

  updateThrottleMs(ms: number): void {
    this.throttleMs = ms;
  }

  destroy(): void {
    this.flushNow();
    this.pendingUpdates.clear();
  }
}

export function createToolStreamOptimizer(callback: ToolUpdateCallback): ToolStreamOptimizer {
  return new ToolStreamOptimizer(callback);
}
