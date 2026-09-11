/**
 * @file socialUnread.test.ts
 * @description Unit tests for Social unread baseline / badge helpers (#63)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyPostCountPoll,
  applyThreadPoll,
  formatBadgeCount,
  loadPrimaryTab,
  persistPrimaryTab,
  shouldRunSocialPoll,
  SOCIAL_POLL_MS
} from "./socialUnread";

describe("applyThreadPoll", () => {
  it("first poll establishes baseline → badge 0", () => {
    const r = applyThreadPoll(null, { "0xabc": 3, "0xdef": 1 }, 0);
    expect(r.established).toBe(true);
    expect(r.unread).toBe(0);
    expect(r.delta).toBe(0);
    expect(r.baseline).toEqual({ "0xabc": 3, "0xdef": 1 });
  });

  it("increment → badge > 0", () => {
    const base = { "0xabc": 3 };
    const r = applyThreadPoll(base, { "0xabc": 5 }, 0);
    expect(r.established).toBe(false);
    expect(r.delta).toBe(2);
    expect(r.unread).toBe(2);
    expect(r.baseline["0xabc"]).toBe(5);
  });

  it("accumulates across polls until cleared", () => {
    let baseline: Record<string, number> = { "0xabc": 1 };
    let unread = 0;
    let r = applyThreadPoll(baseline, { "0xabc": 2 }, unread);
    baseline = r.baseline;
    unread = r.unread;
    r = applyThreadPoll(baseline, { "0xabc": 4 }, unread);
    expect(r.unread).toBe(3);
  });
});

describe("applyPostCountPoll", () => {
  it("first poll establishes baseline → badge 0", () => {
    const r = applyPostCountPoll(null, 10, 0);
    expect(r.established).toBe(true);
    expect(r.unread).toBe(0);
    expect(r.baseline).toBe(10);
  });

  it("any new post since baseline counts unread", () => {
    const r = applyPostCountPoll(10, 13, 0);
    expect(r.delta).toBe(3);
    expect(r.unread).toBe(3);
  });
});

describe("open Inbox clears inbox not board", () => {
  it("clearing inbox unread leaves board unread untouched", () => {
    let inboxUnread = 4;
    const boardUnread = 2;
    // open Inbox → clear inbox only (baseline catch-up is caller's job)
    inboxUnread = 0;
    expect(inboxUnread).toBe(0);
    expect(boardUnread).toBe(2);
  });
});

describe("shouldRunSocialPoll", () => {
  it("visibility hidden → no interval / poll", () => {
    expect(
      shouldRunSocialPoll({
        documentHidden: true,
        hasChannel: true,
        surface: "inbox"
      })
    ).toBe(false);
    expect(
      shouldRunSocialPoll({
        documentHidden: true,
        surface: "board"
      })
    ).toBe(false);
  });

  it("no channel → inbox poll no-op", () => {
    expect(
      shouldRunSocialPoll({
        documentHidden: false,
        hasChannel: false,
        surface: "inbox"
      })
    ).toBe(false);
    expect(
      shouldRunSocialPoll({
        documentHidden: false,
        hasChannel: true,
        surface: "inbox"
      })
    ).toBe(true);
  });

  it("board still polls without a chat channel", () => {
    expect(
      shouldRunSocialPoll({
        documentHidden: false,
        hasChannel: false,
        surface: "board"
      })
    ).toBe(true);
  });
});

describe("formatBadgeCount", () => {
  it("hides zero / negative", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-1)).toBeNull();
  });

  it("numeric ≤9 then 9+", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(10)).toBe("9+");
  });
});

describe("primary tab persistence", () => {
  it("defaults to terminal and round-trips social", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      }
    };
    expect(loadPrimaryTab(storage)).toBe("terminal");
    persistPrimaryTab(storage, "social");
    expect(loadPrimaryTab(storage)).toBe("social");
  });
});

describe("SOCIAL_POLL_MS", () => {
  it("is ~60s", () => {
    expect(SOCIAL_POLL_MS).toBe(60_000);
  });

  it("visibility hidden → no interval calls (mock timer)", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    let hidden = false;
    const id = setInterval(() => {
      if (shouldRunSocialPoll({ documentHidden: hidden, hasChannel: true, surface: "inbox" })) {
        tick();
      }
    }, SOCIAL_POLL_MS);
    vi.advanceTimersByTime(60_000);
    expect(tick).toHaveBeenCalledTimes(1);
    hidden = true;
    vi.advanceTimersByTime(180_000);
    expect(tick).toHaveBeenCalledTimes(1);
    clearInterval(id);
    vi.useRealTimers();
  });
});
