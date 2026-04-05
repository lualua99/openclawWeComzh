import type { SessionData, SessionManagerOptions } from "./types.js";

/**
 * Manages DeepSeek chat sessions with LRU eviction and TTL expiration.
 * Provides thread-safe session storage with automatic cleanup.
 */
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private ttlMs: number;
  private maxSessions: number;
  private cleanupIntervalMs: number;
  private lastCleanup: number = 0;
  private onCleanup?: (sessionKey: string) => void;

  constructor(options: SessionManagerOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000;
    this.maxSessions = options.maxSessions ?? 100;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 5 * 60 * 1000;
  }

  setOnCleanup(callback: (sessionKey: string) => void): void {
    this.onCleanup = callback;
  }

  get(sessionKey: string): SessionData | undefined {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      return undefined;
    }
    if (Date.now() - session.lastUpdated > this.ttlMs) {
      this.delete(sessionKey);
      return undefined;
    }
    session.lastUpdated = Date.now();
    return session;
  }

  set(sessionKey: string, dsSessionId: string, parentId?: string | number): void {
    this.sessions.set(sessionKey, {
      dsSessionId,
      parentId,
      lastUpdated: Date.now(),
    });
    this.maybeCleanup();
  }

  updateParentId(sessionKey: string, parentId: string | number): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.parentId = parentId;
      session.lastUpdated = Date.now();
    }
  }

  delete(sessionKey: string): boolean {
    const deleted = this.sessions.delete(sessionKey);
    if (deleted && this.onCleanup) {
      this.onCleanup(sessionKey);
    }
    return deleted;
  }

  has(sessionKey: string): boolean {
    return this.get(sessionKey) !== undefined;
  }

  size(): number {
    return this.sessions.size;
  }

  clear(): void {
    this.sessions.clear();
  }

  getSessionKeys(): string[] {
    return Array.from(this.sessions.keys());
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs && this.sessions.size < this.maxSessions) {
      return;
    }
    this.lastCleanup = now;
    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastUpdated > this.ttlMs) {
        this.delete(key);
      }
    }

    if (this.sessions.size > this.maxSessions) {
      const sortedSessions = Array.from(this.sessions.entries())
        .toSorted((a, b) => a[1].lastUpdated - b[1].lastUpdated);

      const toRemove = this.sessions.size - this.maxSessions;
      for (let i = 0; i < toRemove; i++) {
        this.delete(sortedSessions[i][0]);
      }
    }
  }

  forceCleanup(): void {
    this.lastCleanup = 0;
    this.cleanup();
  }

  getStats(): { size: number; oldest: number | null; newest: number | null } {
    if (this.sessions.size === 0) {
      return { size: 0, oldest: null, newest: null };
    }

    let oldest = Infinity;
    let newest = -Infinity;

    for (const session of this.sessions.values()) {
      if (session.lastUpdated < oldest) {
        oldest = session.lastUpdated;
      }
      if (session.lastUpdated > newest) {
        newest = session.lastUpdated;
      }
    }

    return {
      size: this.sessions.size,
      oldest: oldest === Infinity ? null : oldest,
      newest: newest === -Infinity ? null : newest,
    };
  }
}

let globalSessionManager: SessionManager | null = null;

export function getGlobalSessionManager(): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager();
  }
  return globalSessionManager;
}

export function setGlobalSessionManager(manager: SessionManager): void {
  globalSessionManager = manager;
}
