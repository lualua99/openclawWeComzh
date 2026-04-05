/** Distance (px) from the bottom within which we consider the user "near bottom". */
const NEAR_BOTTOM_THRESHOLD = 450;

type ScrollHost = {
  updateComplete: Promise<unknown>;
  querySelector: (selectors: string) => Element | null;
  style: CSSStyleDeclaration;
  chatScrollFrame: number | null;
  chatScrollTimeout: number | null;
  chatHasAutoScrolled: boolean;
  chatUserNearBottom: boolean;
  chatNewMessagesBelow: boolean;
  logsScrollFrame: number | null;
  logsAtBottom: boolean;
  topbarObserver: ResizeObserver | null;
};

export function scheduleChatScroll(host: ScrollHost, force = false, smooth = false) {
  if (host.chatScrollFrame) {
    cancelAnimationFrame(host.chatScrollFrame);
  }
  if (host.chatScrollTimeout != null) {
    clearTimeout(host.chatScrollTimeout);
    host.chatScrollTimeout = null;
  }
  const pickScrollTarget = () => {
    const container = host.querySelector(".chat-thread") as HTMLElement | null;
    if (container) {
      return container;
    }
    return (document.scrollingElement ?? document.documentElement) as HTMLElement | null;
  };

  const doScroll = (target: HTMLElement, retryCount: number) => {
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    const effectiveForce = force && !host.chatHasAutoScrolled;
    const shouldStick =
      effectiveForce || host.chatUserNearBottom || distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

    if (!shouldStick) {
      host.chatNewMessagesBelow = true;
      return;
    }
    if (effectiveForce) {
      host.chatHasAutoScrolled = true;
    }
    const smoothEnabled =
      smooth &&
      (typeof window === "undefined" ||
        typeof window.matchMedia !== "function" ||
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const scrollTop = target.scrollHeight;
    if (typeof target.scrollTo === "function") {
      target.scrollTo({ top: scrollTop, behavior: smoothEnabled ? "smooth" : "auto" });
    } else {
      target.scrollTop = scrollTop;
    }
    host.chatUserNearBottom = true;
    host.chatNewMessagesBelow = false;
  };

  void host.updateComplete.then(() => {
    const scrollToBottom = () => {
      const target = pickScrollTarget();
      if (!target) {
        return false;
      }
      target.scrollTop = target.scrollHeight;
      return true;
    };
    if (!scrollToBottom()) {
      setTimeout(scrollToBottom, 50);
    }
  });
}

export function scheduleLogsScroll(host: ScrollHost, force = false) {
  if (host.logsScrollFrame) {
    cancelAnimationFrame(host.logsScrollFrame);
  }
  void host.updateComplete.then(() => {
    host.logsScrollFrame = requestAnimationFrame(() => {
      host.logsScrollFrame = null;
      const container = host.querySelector(".log-stream") as HTMLElement | null;
      if (!container) {
        return;
      }
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldStick = force || distanceFromBottom < 80;
      if (!shouldStick) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
  });
}

export function handleChatScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.chatUserNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  // Clear the "new messages below" indicator when user scrolls back to bottom.
  if (host.chatUserNearBottom) {
    host.chatNewMessagesBelow = false;
  }
}

export function handleLogsScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.logsAtBottom = distanceFromBottom < 80;
}

export function resetChatScroll(host: ScrollHost) {
  host.chatHasAutoScrolled = false;
  host.chatUserNearBottom = true;
  host.chatNewMessagesBelow = false;
}

export function exportLogs(lines: string[], label: string) {
  if (lines.length === 0) {
    return;
  }
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  anchor.href = url;
  anchor.download = `openclaw-logs-${label}-${stamp}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function observeTopbar(host: ScrollHost) {
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  const topbar = host.querySelector(".topbar");
  if (!topbar) {
    return;
  }
  const update = () => {
    const { height } = topbar.getBoundingClientRect();
    host.style.setProperty("--topbar-height", `${height}px`);
  };
  update();
  host.topbarObserver = new ResizeObserver(() => update());
  host.topbarObserver.observe(topbar);
}

const SCROLL_POSITION_KEY = "chat-scroll-position";
const SCROLL_THROTTLE_MS = 300;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_INTERVAL_MS = 100;
const RESTORE_DELAY_MS = 150;

interface ScrollPositionData {
  scrollTop: number;
  scrollHeight: number;
  timestamp: number;
}

export class ScrollRestoration {
  private hasRestored = false;
  private saveTimeout: number | null = null;
  private container: HTMLElement | null = null;
  private scrollHandler = this.handleScroll.bind(this);
  private mutationObserver: MutationObserver | null = null;
  private hostElement: HTMLElement | null = null;

  init(hostElement: HTMLElement): void {
    this.hostElement = hostElement;
    if (typeof history !== "undefined") {
      history.scrollRestoration = "manual";
      console.log("[ScrollRestoration] Disabled browser native scroll restoration");
    }
    this.setupMutationObserver();
  }

  private setupMutationObserver(): void {
    if (typeof MutationObserver === "undefined" || !this.hostElement) {
      return;
    }
    const messagesContainer = this.hostElement.querySelector(".chat-messages, .chat-thread");
    if (!messagesContainer) {
      console.log("[ScrollRestoration] No messages container found for MutationObserver");
      return;
    }
    this.mutationObserver = new MutationObserver(() => {
      if (!this.hasRestored) {
        return;
      }
      console.log("[ScrollRestoration] MutationObserver detected content change, re-attempting restore");
      const container = this.hostElement?.querySelector(".chat-thread") as HTMLElement | null;
      if (container) {
        this.restoreWithRetry(container);
      }
    });
    this.mutationObserver.observe(messagesContainer, {
      childList: true,
      subtree: true,
    });
    console.log("[ScrollRestoration] MutationObserver established");
  }

  destroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.hostElement) {
      const container = this.hostElement.querySelector(".chat-thread") as HTMLElement | null;
      if (container) {
        container.removeEventListener("scroll", this.scrollHandler);
      }
    }
    this.hostElement = null;
  }

  private handleScroll(event: Event): void {
    const container = event.currentTarget as HTMLElement | null;
    if (container) {
      this.save(container);
    }
  }

  attachScrollListener(container: HTMLElement): void {
    this.container = container;
    container.addEventListener("scroll", this.scrollHandler);
    console.log("[ScrollRestoration] Scroll listener attached");
  }

  save(container: HTMLElement): void {
    if (container) {
      if (this.saveTimeout !== null) {
        return;
      }
      this.saveTimeout = window.setTimeout(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const data: ScrollPositionData = {
          scrollTop,
          scrollHeight,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(SCROLL_POSITION_KEY, JSON.stringify(data));
        console.log(`[ScrollRestoration] Saved scroll position: scrollTop=${scrollTop}, scrollHeight=${scrollHeight}`);
        this.saveTimeout = null;
      }, SCROLL_THROTTLE_MS);
    }
  }

  saveImmediate(container: HTMLElement): void {
    if (container) {
      if (this.saveTimeout !== null) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const data: ScrollPositionData = {
        scrollTop,
        scrollHeight,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SCROLL_POSITION_KEY, JSON.stringify(data));
      console.log(`[ScrollRestoration] Saved scroll position immediately: scrollTop=${scrollTop}, scrollHeight=${scrollHeight}`);
    }
  }

  restore(container: HTMLElement): void {
    if (this.hasRestored) {
      return;
    }
    const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (saved && container) {
      try {
        const data: ScrollPositionData = JSON.parse(saved);
        const targetScrollTop = data.scrollTop;
        console.log(`[ScrollRestoration] Attempting to restore scroll position: ${targetScrollTop}`);
        this.restoreWithRetry(container, targetScrollTop);
      } catch (e) {
        console.error("[ScrollRestoration] Failed to parse saved scroll position:", e);
      }
    }
  }

  private restoreWithRetry(container: HTMLElement, targetScrollTop?: number): void {
    let attempts = 0;
    const maxAttempts = MAX_RETRY_ATTEMPTS;

    if (targetScrollTop === undefined) {
      const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (!saved) {
        return;
      }
      try {
        const data: ScrollPositionData = JSON.parse(saved);
        targetScrollTop = data.scrollTop;
      } catch (e) {
        console.error("[ScrollRestoration] Failed to parse saved scroll position:", e);
        return;
      }
    }

    const tryRestore = () => {
      attempts++;
      container.scrollTop = targetScrollTop as number;
      const actualScrollTop = container.scrollTop;
      console.log(`[ScrollRestoration] Restore attempt ${attempts}/${maxAttempts}: scrollTop=${actualScrollTop}, target=${targetScrollTop}`);

      if (Math.abs(actualScrollTop - (targetScrollTop as number)) > 10 && attempts < maxAttempts) {
        requestAnimationFrame(tryRestore);
      } else {
        this.hasRestored = true;
        console.log(`[ScrollRestoration] Restore completed: scrollTop=${actualScrollTop}`);
      }
    };

    requestAnimationFrame(tryRestore);
  }

  restoreAfterRender(container: HTMLElement): void {
    if (this.hasRestored) {
      return;
    }
    const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (saved && container) {
      try {
        const data: ScrollPositionData = JSON.parse(saved);
        const targetScrollTop = data.scrollTop;
        console.log(`[ScrollRestoration] Attempting to restore after render: ${targetScrollTop}`);
        setTimeout(() => {
          this.restoreWithRetry(container, targetScrollTop);
        }, RESTORE_DELAY_MS);
      } catch (e) {
        console.error("[ScrollRestoration] Failed to parse saved scroll position:", e);
      }
    }
  }

  tryRestoreWithContainer(hostElement: HTMLElement): void {
    const container = hostElement.querySelector(".chat-thread") as HTMLElement | null;
    if (container) {
      this.attachScrollListener(container);
      this.restore(container);
    } else {
      let attempts = 0;
      const maxAttempts = MAX_RETRY_ATTEMPTS;
      const tryFindContainer = () => {
        attempts++;
        const found = hostElement.querySelector(".chat-thread") as HTMLElement | null;
        if (found) {
          this.attachScrollListener(found);
          this.restore(found);
        } else if (attempts < maxAttempts) {
          setTimeout(tryFindContainer, RETRY_INTERVAL_MS);
        } else {
          console.log("[ScrollRestoration] Container not found after max attempts");
        }
      };
      setTimeout(tryFindContainer, RETRY_INTERVAL_MS);
    }
  }

  reset(): void {
    this.hasRestored = false;
    sessionStorage.removeItem(SCROLL_POSITION_KEY);
    console.log("[ScrollRestoration] Scroll restoration state reset");
  }

  clear(): void {
    sessionStorage.removeItem(SCROLL_POSITION_KEY);
    console.log("[ScrollRestoration] Scroll position cleared");
  }
}

export const scrollRestoration = new ScrollRestoration();
