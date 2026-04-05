import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManager } from "./session-manager.js";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({
      ttlMs: 1000,
      maxSessions: 3,
      cleanupIntervalMs: 100,
    });
  });

  describe("basic operations", () => {
    it("should set and get session", () => {
      manager.set("session1", "ds_session_123", "parent_456");

      const session = manager.get("session1");
      expect(session).not.toBeUndefined();
      expect(session?.dsSessionId).toBe("ds_session_123");
      expect(session?.parentId).toBe("parent_456");
    });

    it("should return undefined for non-existent session", () => {
      const session = manager.get("nonexistent");
      expect(session).toBeUndefined();
    });

    it("should delete session", () => {
      manager.set("session1", "ds_123");
      expect(manager.has("session1")).toBe(true);

      manager.delete("session1");
      expect(manager.has("session1")).toBe(false);
    });

    it("should track size", () => {
      expect(manager.size()).toBe(0);

      manager.set("session1", "ds_1");
      expect(manager.size()).toBe(1);

      manager.set("session2", "ds_2");
      expect(manager.size()).toBe(2);
    });

    it("should clear all sessions", () => {
      manager.set("session1", "ds_1");
      manager.set("session2", "ds_2");

      manager.clear();
      expect(manager.size()).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("should expire session after TTL", async () => {
      const shortTTLManager = new SessionManager({
        ttlMs: 50,
        maxSessions: 10,
        cleanupIntervalMs: 1000,
      });

      shortTTLManager.set("session1", "ds_1");

      expect(shortTTLManager.has("session1")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortTTLManager.has("session1")).toBe(false);
    });

    it("should update lastUpdated on get", async () => {
      const shortTTLManager = new SessionManager({
        ttlMs: 100,
        maxSessions: 10,
        cleanupIntervalMs: 1000,
      });

      shortTTLManager.set("session1", "ds_1");

      await new Promise((resolve) => setTimeout(resolve, 50));

      const session = shortTTLManager.get("session1");
      expect(session).not.toBeUndefined();

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortTTLManager.has("session1")).toBe(true);
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest session when maxSessions reached", () => {
      const smallMaxManager = new SessionManager({
        ttlMs: 10000,
        maxSessions: 2,
        cleanupIntervalMs: 1000,
      });

      smallMaxManager.set("session1", "ds_1");
      smallMaxManager.set("session2", "ds_2");

      expect(smallMaxManager.has("session1")).toBe(true);
      expect(smallMaxManager.has("session2")).toBe(true);

      smallMaxManager.set("session3", "ds_3");

      expect(smallMaxManager.size()).toBe(2);
      expect(smallMaxManager.has("session1")).toBe(false);
      expect(smallMaxManager.has("session2")).toBe(true);
      expect(smallMaxManager.has("session3")).toBe(true);
    });

    it("should update LRU order on session access", () => {
      const smallMaxManager = new SessionManager({
        ttlMs: 10000,
        maxSessions: 2,
        cleanupIntervalMs: 1000,
      });

      smallMaxManager.set("session1", "ds_1");
      smallMaxManager.set("session2", "ds_2");

      smallMaxManager.get("session1");

      smallMaxManager.set("session3", "ds_3");

      expect(smallMaxManager.has("session2")).toBe(false);
      expect(smallMaxManager.has("session1")).toBe(true);
    });
  });

  describe("updateParentId", () => {
    it("should update parentId", () => {
      manager.set("session1", "ds_1", "parent_1");
      manager.updateParentId("session1", "parent_2");

      const session = manager.get("session1");
      expect(session?.parentId).toBe("parent_2");
    });

    it("should do nothing for non-existent session", () => {
      expect(() => manager.updateParentId("nonexistent", "parent")).not.toThrow();
    });
  });

  describe("callbacks", () => {
    it("should call onCleanup callback", () => {
      const cleanupFn = vi.fn();
      manager.setOnCleanup(cleanupFn);

      manager.set("session1", "ds_1");
      manager.delete("session1");

      expect(cleanupFn).toHaveBeenCalledWith("session1");
    });
  });

  describe("getStats", () => {
    it("should return correct stats", () => {
      manager.set("session1", "ds_1");

      const stats = manager.getStats();
      expect(stats.size).toBe(1);
      expect(stats.oldest).not.toBeNull();
      expect(stats.newest).not.toBeNull();
    });

    it("should return null for empty manager", () => {
      const stats = manager.getStats();
      expect(stats.size).toBe(0);
      expect(stats.oldest).toBeNull();
      expect(stats.newest).toBeNull();
    });
  });

  describe("forceCleanup", () => {
    it("should force cleanup even if interval not reached", async () => {
      const managerWithLongInterval = new SessionManager({
        ttlMs: 10000,
        maxSessions: 10,
        cleanupIntervalMs: 100000,
      });

      managerWithLongInterval.set("session1", "ds_1");
      managerWithLongInterval.set("session2", "ds_2");

      managerWithLongInterval.forceCleanup();
      expect(managerWithLongInterval.size()).toBe(2);

      const expiredManager = new SessionManager({
        ttlMs: 50,
        maxSessions: 10,
        cleanupIntervalMs: 100000,
      });

      expiredManager.set("session1", "ds_1");
      await new Promise((resolve) => setTimeout(resolve, 60));

      expiredManager.forceCleanup();
      expect(expiredManager.size()).toBe(0);
    });
  });
});
