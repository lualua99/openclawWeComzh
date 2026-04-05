export interface ToolStreamConfig {
  limit: number;
  throttleMs: number;
  outputCharLimit: number;
}

export const DEFAULT_TOOL_STREAM_CONFIG: ToolStreamConfig = {
  limit: 50,
  throttleMs: 80,
  outputCharLimit: 120_000,
};

export function getToolStreamConfig(): ToolStreamConfig {
  if (typeof window !== "undefined" && (window as unknown as { __TOOL_STREAM_CONFIG?: ToolStreamConfig }).__TOOL_STREAM_CONFIG) {
    return (window as unknown as { __TOOL_STREAM_CONFIG: ToolStreamConfig }).__TOOL_STREAM_CONFIG;
  }
  return DEFAULT_TOOL_STREAM_CONFIG;
}

export function setToolStreamConfig(config: Partial<ToolStreamConfig>): void {
  if (typeof window !== "undefined") {
    (window as unknown as { __TOOL_STREAM_CONFIG: ToolStreamConfig }).__TOOL_STREAM_CONFIG = {
      ...DEFAULT_TOOL_STREAM_CONFIG,
      ...config,
    };
  }
}
