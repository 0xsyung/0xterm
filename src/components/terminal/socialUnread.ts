/**
 * @file socialUnread.ts
 * @description Pure helpers for Social-tab unread baselines + badge formatting (#63)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type ThreadCounts = Record<string, number>;

/** Sum positive threadCount deltas vs baseline (per-sender). */
export function accumulateThreadUnread(
  baseline: ThreadCounts,
  fresh: ThreadCounts
): number {
  let delta = 0;
  for (const [key, count] of Object.entries(fresh)) {
    const prev = baseline[key] ?? 0;
    if (count > prev) delta += count - prev;
  }
  return delta;
}

/**
 * Apply one inbox poll snapshot.
 * First snapshot establishes baseline and never badges (no false positive).
 * Later snapshots accumulate unread, then advance baseline so the next tick
 * only counts new arrivals.
 */
export function applyThreadPoll(
  baseline: ThreadCounts | null,
  fresh: ThreadCounts,
  prevUnread: number
): {
  baseline: ThreadCounts;
  unread: number;
  delta: number;
  established: boolean;
} {
  if (baseline === null) {
    return {
      baseline: { ...fresh },
      unread: 0,
      delta: 0,
      established: true
    };
  }
  const delta = accumulateThreadUnread(baseline, fresh);
  return {
    baseline: { ...fresh },
    unread: prevUnread + delta,
    delta,
    established: false
  };
}

/**
 * Apply one board postCount poll snapshot (any new post since baseline = unread).
 */
export function applyPostCountPoll(
  baseline: number | null,
  fresh: number,
  prevUnread: number
): {
  baseline: number;
  unread: number;
  delta: number;
  established: boolean;
} {
  if (baseline === null) {
    return {
      baseline: fresh,
      unread: 0,
      delta: 0,
      established: true
    };
  }
  const delta = fresh > baseline ? fresh - baseline : 0;
  return {
    baseline: fresh,
    unread: prevUnread + delta,
    delta,
    established: false
  };
}

/** Badge label: hidden when 0, numeric ≤9, else `9+`. */
export function formatBadgeCount(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 9) return "9+";
  return String(Math.floor(n));
}

/** Pause background polls while the document is hidden. */
export function shouldRunSocialPoll(opts: {
  documentHidden: boolean;
  /** Chat contract / active channel present. */
  hasChannel?: boolean;
  surface: "inbox" | "board";
}): boolean {
  if (opts.documentHidden) return false;
  if (opts.surface === "inbox" && !opts.hasChannel) return false;
  return true;
}

export const SOCIAL_POLL_MS = 60_000;

export const PRIMARY_TAB_STORAGE_KEY = "0xterm.primaryTab";

export type PrimaryTab = "terminal" | "social";
export type SocialSubTab = "inbox" | "board";

export function loadPrimaryTab(
  storage: { getItem(key: string): string | null } | null | undefined
): PrimaryTab {
  try {
    const raw = storage?.getItem(PRIMARY_TAB_STORAGE_KEY);
    return raw === "social" ? "social" : "terminal";
  } catch {
    return "terminal";
  }
}

export function persistPrimaryTab(
  storage: { setItem(key: string, value: string): void } | null | undefined,
  tab: PrimaryTab
): void {
  try {
    storage?.setItem(PRIMARY_TAB_STORAGE_KEY, tab);
  } catch {
    // storage unavailable — in-memory tab still works
  }
}
