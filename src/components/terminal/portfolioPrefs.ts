/**
 * @file portfolioPrefs.ts
 * @description Portfolio management prefs (watch addresses, hidden tokens, groups) — #22
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { getAddress, isAddress, type Address } from "viem";

export const PORTFOLIO_WATCH_MAX = 4;

export type PortfolioPrefs = {
  /** Checksummed extra read-only addresses. */
  watchAddresses: Address[];
  /** "sym" (hides on every chain) or "chainId:addr" keys. */
  hidden: string[];
  /** Display-only partitions of SELF mainnet rows. */
  groups: { name: string; keys: string[] }[];
};

export const emptyPortfolioPrefs = (): PortfolioPrefs => ({
  watchAddresses: [],
  hidden: [],
  groups: []
});

/** Normalize an address arg — checksummed when valid 0x, else null. */
export const parseWatchAddressArg = (raw: string): Address | null => {
  const t = raw.trim();
  if (isAddress(t)) return getAddress(t);
  return null;
};

/** A hide key matches a holding when it is its symbol (all chains) or its exact `chainId:addr` key. */
export const matchesHiddenKey = (
  key: string,
  holding: { chainId: number; symbol: string; address?: string }
): boolean => {
  const k = key.trim();
  if (k.toLowerCase() === holding.symbol.toLowerCase()) return true;
  if (holding.address) {
    return k.toLowerCase() === `${holding.chainId}:${holding.address.toLowerCase()}`;
  }
  return false;
};

export const isHiddenHolding = (
  prefs: PortfolioPrefs,
  holding: { chainId: number; symbol: string; address?: string }
): boolean => prefs.hidden.some((k) => matchesHiddenKey(k, holding));

export const isWatchedAddress = (
  prefs: PortfolioPrefs,
  addr: string
): boolean => {
  const a = addr.toLowerCase();
  return prefs.watchAddresses.some((w) => w.toLowerCase() === a);
};

export type PfMutation =
  | { ok: true; prefs: PortfolioPrefs; text: string }
  | { ok: false; code: string; text: string };

export const applyPfAdd = (
  prefs: PortfolioPrefs,
  addr: Address,
  self: Address | null
): PfMutation => {
  const checksummed = getAddress(addr);
  if (self && self.toLowerCase() === checksummed.toLowerCase()) {
    return { ok: false, code: "PF_DUP", text: "That's the connected wallet." };
  }
  if (isWatchedAddress(prefs, checksummed)) {
    return { ok: false, code: "PF_DUP", text: "Already watched." };
  }
  if (prefs.watchAddresses.length >= PORTFOLIO_WATCH_MAX) {
    return {
      ok: false,
      code: "PF_WATCH_FULL",
      text: `v1 watches ${PORTFOLIO_WATCH_MAX} extra addresses.`
    };
  }
  return {
    ok: true,
    prefs: { ...prefs, watchAddresses: [...prefs.watchAddresses, checksummed] },
    text: `[✓] Watching ${shortAddr(checksummed)}. Run 'pf' to see it.`
  };
};

export const applyPfRm = (
  prefs: PortfolioPrefs,
  addr: Address
): PfMutation => {
  const a = addr.toLowerCase();
  if (!prefs.watchAddresses.some((w) => w.toLowerCase() === a)) {
    return { ok: false, code: "PF_NOT_WATCHED", text: "Not on the watch list." };
  }
  const target = prefs.watchAddresses.find((w) => w.toLowerCase() === a)!;
  return {
    ok: true,
    prefs: {
      ...prefs,
      watchAddresses: prefs.watchAddresses.filter((w) => w !== target)
    },
    text: `[✓] Removed ${shortAddr(target)} from watch list.`
  };
};

/** Hide key for a holding — symbol hides on every chain, address key is precise. */
export const hideKeyForHolding = (h: {
  symbol: string;
  address?: string;
  chainId: number;
}): string => {
  if (h.address) return `${h.chainId}:${h.address.toLowerCase()}`;
  return h.symbol;
};

export const applyPfHide = (
  prefs: PortfolioPrefs,
  raw: string,
  activeChainId: number | null
): PfMutation => {
  const t = raw.trim();
  const parsed = parseWatchAddressArg(t);
  if (parsed) {
    if (!activeChainId) {
      return {
        ok: false,
        code: "PF_BAD_FILTER",
        text: "Set a network first to hide by address (network <name|id>)."
      };
    }
    const key = `${activeChainId}:${parsed.toLowerCase()}`;
    if (prefs.hidden.some((k) => k.toLowerCase() === key.toLowerCase())) {
      return { ok: false, code: "PF_HIDE_DUP", text: "Already hidden." };
    }
    return {
      ok: true,
      prefs: { ...prefs, hidden: [...prefs.hidden, key] },
      text: `[✓] Hidden ${shortAddr(parsed)} on this chain. Run 'pf' to see the table without it.`
    };
  }
  if (!/^[A-Za-z0-9.]+$/.test(t)) {
    return {
      ok: false,
      code: "PF_HIDE_BAD",
      text: "Use a token symbol or a 0x token address."
    };
  }
  const key = t.toUpperCase();
  if (prefs.hidden.some((k) => k.toLowerCase() === key.toLowerCase())) {
    return { ok: false, code: "PF_HIDE_DUP", text: "Already hidden." };
  }
  return {
    ok: true,
    prefs: { ...prefs, hidden: [...prefs.hidden, key] },
    text: `[✓] Hidden ${key} (all chains). Run 'pf' to see the table without it.`
  };
};

export const applyPfUnhide = (
  prefs: PortfolioPrefs,
  raw: string
): PfMutation => {
  const t = raw.trim();
  if (!t) {
    return { ok: false, code: "PF_HIDE_MISS", text: "Not hidden." };
  }
  const before = prefs.hidden.length;
  const next = prefs.hidden.filter(
    (k) => k.toLowerCase() !== t.toLowerCase()
  );
  if (next.length === before) {
    return { ok: false, code: "PF_HIDE_MISS", text: "Not hidden." };
  }
  return {
    ok: true,
    prefs: { ...prefs, hidden: next },
    text: `[✓] Unhidden ${t}.`
  };
};

export const applyPfGroup = (
  prefs: PortfolioPrefs,
  name: string,
  symbols: string[]
): PfMutation => {
  const clean = name.trim();
  if (!clean) {
    return { ok: false, code: "PF_GROUP_BAD", text: "Usage: pf group <name> <sym…>" };
  }
  const keys = symbols.map((s) => s.toUpperCase());
  if (keys.length === 0) {
    return { ok: false, code: "PF_GROUP_BAD", text: "Usage: pf group <name> <sym…>" };
  }
  const groups = prefs.groups.filter((g) => g.name !== clean);
  return {
    ok: true,
    prefs: { ...prefs, groups: [...groups, { name: clean, keys }] },
    text: `[✓] Group "${clean}" set: ${keys.join(", ")}.`
  };
};

export const applyPfUngroup = (
  prefs: PortfolioPrefs,
  name: string
): PfMutation => {
  const clean = name.trim();
  const before = prefs.groups.length;
  const groups = prefs.groups.filter((g) => g.name !== clean);
  if (groups.length === before) {
    return { ok: false, code: "PF_GROUP_MISS", text: "No such group." };
  }
  return {
    ok: true,
    prefs: { ...prefs, groups },
    text: `[✓] Group "${clean}" removed.`
  };
};

export const shortAddr = (a: string): string =>
  `${a.slice(0, 6)}…${a.slice(-4)}`;

export type PfCommand =
  | { op: "portfolio"; filter?: string }
  | { op: "add"; raw: string }
  | { op: "rm"; raw: string }
  | { op: "ls" }
  | { op: "hide"; raw: string }
  | { op: "unhide"; raw: string }
  | { op: "group"; name: string; symbols: string[] }
  | { op: "ungroup"; name: string }
  | { op: "usage" };

/**
 * Parse `pf|portfolio <subcommand|filter>`.
 * Subcommands (add/rm/ls/hide/unhide/group/ungroup) take priority over the
 * native|erc20 filter — both dialects work on either verb.
 */
export const parsePfCommand = (args: string[]): PfCommand => {
  const sub = (args[1] || "").toLowerCase();
  if (!sub) return { op: "portfolio" };
  if (sub === "native" || sub === "erc20") return { op: "portfolio", filter: sub };
  if (sub === "ls" || sub === "list") return { op: "ls" };
  if (sub === "add") {
    if (!args[2]) return { op: "usage" };
    return { op: "add", raw: args[2] };
  }
  if (sub === "rm" || sub === "remove" || sub === "del" || sub === "unwatch") {
    if (!args[2]) return { op: "usage" };
    return { op: "rm", raw: args[2] };
  }
  if (sub === "hide") {
    if (!args[2]) return { op: "usage" };
    return { op: "hide", raw: args[2] };
  }
  if (sub === "unhide" || sub === "show") {
    if (!args[2]) return { op: "usage" };
    return { op: "unhide", raw: args[2] };
  }
  if (sub === "group") {
    if (!args[2] || args.length < 4) return { op: "usage" };
    return { op: "group", name: args[2], symbols: args.slice(3) };
  }
  if (sub === "ungroup") {
    if (!args[2]) return { op: "usage" };
    return { op: "ungroup", name: args[2] };
  }
  return { op: "usage" };
};

export const PF_USAGE =
  "Usage: pf | pf native | pf erc20 | pf add <address|ens> | pf rm <address|ens> | pf ls | pf hide <sym|0xaddr> | pf unhide <sym|0xaddr> | pf group <name> <sym…> | pf ungroup <name>. Portfolio also accepts these subcommands.";

/** Read PortfolioPrefs from the wallet prefs blob. */
export const readPortfolioPrefs = (
  storage: Pick<Storage, "getItem"> | null | undefined,
  address?: string | null
): PortfolioPrefs => {
  try {
    if (!address) return emptyPortfolioPrefs();
    const raw = storage?.getItem(`0xterm_user_${address.toLowerCase()}`);
    if (!raw) return emptyPortfolioPrefs();
    const prefs = JSON.parse(raw);
    return normalizePortfolioPrefs(prefs?.portfolioWatch);
  } catch {
    return emptyPortfolioPrefs();
  }
};

export const writePortfolioPrefs = (
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  prefs: PortfolioPrefs,
  address: string
): void => {
  const normalized = normalizePortfolioPrefs(prefs);
  try {
    const key = `0xterm_user_${address.toLowerCase()}`;
    const existing = storage?.getItem(key);
    const blob = existing ? JSON.parse(existing) : {};
    blob.portfolioWatch = normalized;
    storage?.setItem(key, JSON.stringify(blob));
  } catch {
    // quota / privacy
  }
};

export const normalizePortfolioPrefs = (raw: any): PortfolioPrefs => {
  if (!raw || typeof raw !== "object") return emptyPortfolioPrefs();
  const watchAddresses: Address[] = [];
  const seen = new Set<string>();
  for (const a of Array.isArray(raw.watchAddresses) ? raw.watchAddresses : []) {
    if (typeof a !== "string" || !isAddress(a)) continue;
    const c = getAddress(a);
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    watchAddresses.push(c);
    if (watchAddresses.length >= PORTFOLIO_WATCH_MAX) break;
  }
  const hidden: string[] = [];
  for (const h of Array.isArray(raw.hidden) ? raw.hidden : []) {
    if (typeof h !== "string") continue;
    if (!hidden.some((x) => x.toLowerCase() === h.toLowerCase())) hidden.push(h);
  }
  const groups: { name: string; keys: string[] }[] = [];
  for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
    if (!g || typeof g !== "object") continue;
    const name = String(g.name ?? "").trim();
    if (!name) continue;
    const rawKeys: unknown[] = Array.isArray(g.keys) ? g.keys : [];
    const keys = rawKeys
      .filter((k): k is string => typeof k === "string")
      .map((k: string) => k.toUpperCase());
    if (keys.length === 0) continue;
    if (groups.some((x) => x.name === name)) continue;
    groups.push({ name, keys });
  }
  return { watchAddresses, hidden, groups };
};
