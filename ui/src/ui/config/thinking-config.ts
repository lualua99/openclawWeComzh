export interface ThinkingConfig {
  debounceMs: number;
  maxContentLength: number;
}

export const DEFAULT_THINKING_CONFIG: ThinkingConfig = {
  debounceMs: 100,
  maxContentLength: 50000,
};

export function getThinkingConfig(): ThinkingConfig {
  if (typeof window !== "undefined" && (window as unknown as { __THINKING_CONFIG?: ThinkingConfig }).__THINKING_CONFIG) {
    return (window as unknown as { __THINKING_CONFIG: ThinkingConfig }).__THINKING_CONFIG;
  }
  return DEFAULT_THINKING_CONFIG;
}

export function setThinkingConfig(config: Partial<ThinkingConfig>): void {
  if (typeof window !== "undefined") {
    (window as unknown as { __THINKING_CONFIG: ThinkingConfig }).__THINKING_CONFIG = {
      ...DEFAULT_THINKING_CONFIG,
      ...config,
    };
  }
}
