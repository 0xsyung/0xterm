/**
 * @file ticker.ts
 * @description Crypto ticker watchlist: prefs, resolve, refresh, command parse (#15)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { isAddress, getAddress, type Address } from "viem";
import {
  COMMON_TOKENS,
  DEXSCREENER_CHAIN,
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE
} from "./constants";
import {
  fetchSearchPairs,
  fetchTokensV1,
  pickDexPair,
  preferChainsForSymbol,
  quoteDexScreenerPairs,
  type DexPair
} from "./dexscreener";

export const TICKER_MAX = 12;
export const TICKER_DEFAULT_SYMBOLS = ["ETH", "BTC", "SOL"] as const;
export const TICKER_REFRESH_SEC = 15;
export const TICKER_WIDGET_ID = "ticker:watchlist";
export const TICKER_ANON_KEY = "0xterm_ticker_anon";
export const TICKER_FOOTER =
  "Estimates via DexScreener. Not an executable quote. Swap uses a fresh quote at send.";

export type TickerRowIdentity = {
  pairAddress: string | null;
  dsChain: string | null;
  tokenAddress?: string;
  quoteSymbol?: string;
  dexId?: string;
};

export type TickerRow = TickerRowIdentity & {
  symbol: string;
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  updatedAt: number | null;
};

export type TickerPrefs = {
  symbols: string[];
  rows: Record<string, TickerRowIdentity>;
};

export const tickerPinKey = (): string => TICKER_WIDGET_ID;

export const defaultTickerPrefs = (): TickerPrefs => ({
  symbols: [...TICKER_DEFAULT_SYMBOLS],
  rows: {}
});

export const normalizeSymbol = (raw: string): string => {
  const t = raw.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return getAddress(t);
  return t.toUpperCase();
};

export const isValidTickerSym = (raw: string): boolean => {
  const t = raw.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return true;
  return /^[A-Za-z0-9.]+$/.test(t) && t.length > 0 && t.length <= 32;
};

export type TickerCommand =
  | { op: "show" }
  | { op: "ls" }
  | { op: "add"; symbol: string }
  | { op: "rm"; symbol: string }
  | { op: "usage" };

export const parseTickerCommand = (args: string[]): TickerCommand => {
  // args[0] is "ticker"
  const sub = (args[1] || "").toLowerCase();
  if (!sub) return { op: "show" };
  if (sub === "ls" || sub === "list") return { op: "ls" };
  if (sub === "add") {
    if (!args[2] || !isValidTickerSym(args[2])) return { op: "usage" };
    return { op: "add", symbol: normalizeSymbol(args[2]) };
  }
  if (sub === "rm" || sub === "remove" || sub === "del") {
    if (!args[2] || !isValidTickerSym(args[2])) return { op: "usage" };
    return { op: "rm", symbol: normalizeSymbol(args[2]) };
  }
  return { op: "usage" };
};

export const applyTickerAdd = (
  prefs: TickerPrefs,
  symbol: string
):
  | { ok: true; prefs: TickerPrefs }
  | { ok: false; code: "TICKER_DUP" | "TICKER_FULL" } => {
  const sym = normalizeSymbol(symbol);
  const existing = prefs.symbols.map((s) => s.toUpperCase());
  if (existing.includes(sym.toUpperCase()) || prefs.symbols.includes(sym)) {
    return { ok: false, code: "TICKER_DUP" };
  }
  // address compare case-insensitive
  if (
    prefs.symbols.some(
      (s) => s.toLowerCase() === sym.toLowerCase()
    )
  ) {
    return { ok: false, code: "TICKER_DUP" };
  }
  if (prefs.symbols.length >= TICKER_MAX) {
    return { ok: false, code: "TICKER_FULL" };
  }
  return {
    ok: true,
    prefs: { ...prefs, symbols: [...prefs.symbols, sym] }
  };
};

export const applyTickerRm = (
  prefs: TickerPrefs,
  symbol: string
): TickerPrefs => {
  const sym = normalizeSymbol(symbol);
  const nextSymbols = prefs.symbols.filter(
    (s) => s.toLowerCase() !== sym.toLowerCase()
  );
  const nextRows = { ...prefs.rows };
  for (const k of Object.keys(nextRows)) {
    if (k.toLowerCase() === sym.toLowerCase()) delete nextRows[k];
  }
  return { symbols: nextSymbols, rows: nextRows };
};

export const readTickerPrefs = (
  storage: Pick<Storage, "getItem"> | null | undefined,
  address?: string | null
): TickerPrefs => {
  try {
    if (address) {
      const raw = storage?.getItem(`0xterm_user_${address.toLowerCase()}`);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs?.ticker && Array.isArray(prefs.ticker.symbols)) {
          return normalizePrefs(prefs.ticker);
        }
      }
    }
    const anon = storage?.getItem(TICKER_ANON_KEY);
    if (anon) {
      const parsed = JSON.parse(anon);
      if (parsed && Array.isArray(parsed.symbols)) return normalizePrefs(parsed);
    }
  } catch {
    // fall through
  }
  return defaultTickerPrefs();
};

export const writeTickerPrefs = (
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  prefs: TickerPrefs,
  address?: string | null
): void => {
  const normalized = normalizePrefs(prefs);
  try {
    if (address) {
      const key = `0xterm_user_${address.toLowerCase()}`;
      const existing = storage?.getItem(key);
      const blob = existing ? JSON.parse(existing) : {};
      blob.ticker = normalized;
      storage?.setItem(key, JSON.stringify(blob));
    } else {
      storage?.setItem(TICKER_ANON_KEY, JSON.stringify(normalized));
    }
  } catch {
    // quota / privacy
  }
};

/** On connect: if wallet prefs have no ticker yet, copy anon → wallet once. */
export const migrateAnonTickerOnConnect = (
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  address: string
): TickerPrefs => {
  const key = `0xterm_user_${address.toLowerCase()}`;
  try {
    const existing = storage?.getItem(key);
    const blob = existing ? JSON.parse(existing) : {};
    if (blob.ticker && Array.isArray(blob.ticker.symbols)) {
      return normalizePrefs(blob.ticker);
    }
    const anonRaw = storage?.getItem(TICKER_ANON_KEY);
    if (anonRaw) {
      const anon = JSON.parse(anonRaw);
      if (anon && Array.isArray(anon.symbols)) {
        const prefs = normalizePrefs(anon);
        blob.ticker = prefs;
        storage?.setItem(key, JSON.stringify(blob));
        return prefs;
      }
    }
    const defaults = defaultTickerPrefs();
    blob.ticker = defaults;
    storage?.setItem(key, JSON.stringify(blob));
    return defaults;
  } catch {
    return defaultTickerPrefs();
  }
};

export const normalizePrefs = (raw: any): TickerPrefs => {
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(raw?.symbols) ? raw.symbols : []) {
    if (typeof s !== "string" || !isValidTickerSym(s)) continue;
    const n = normalizeSymbol(s);
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    symbols.push(n);
    if (symbols.length >= TICKER_MAX) break;
  }
  if (symbols.length === 0) return defaultTickerPrefs();
  const rows: Record<string, TickerRowIdentity> = {};
  const src = raw?.rows && typeof raw.rows === "object" ? raw.rows : {};
  for (const sym of symbols) {
    const id =
      src[sym] ||
      src[sym.toUpperCase()] ||
      Object.entries(src).find(
        ([k]) => k.toLowerCase() === sym.toLowerCase()
      )?.[1];
    if (id && typeof id === "object") {
      rows[sym] = {
        pairAddress:
          typeof id.pairAddress === "string" ? id.pairAddress : null,
        dsChain: typeof id.dsChain === "string" ? id.dsChain : null,
        tokenAddress:
          typeof id.tokenAddress === "string" ? id.tokenAddress : undefined,
        quoteSymbol:
          typeof id.quoteSymbol === "string" ? id.quoteSymbol : undefined,
        dexId: typeof id.dexId === "string" ? id.dexId : undefined
      };
    }
  }
  return { symbols, rows };
};

const lookupCommonToken = (
  symbol: string,
  activeChainId: number | null
): { chainId: number; address: Address; isNative: boolean } | null => {
  const upper = symbol.toUpperCase();
  const tryChain = (cid: number) => {
    const t = COMMON_TOKENS[cid]?.[upper];
    if (!t) return null;
    return {
      chainId: cid,
      address: t.address,
      isNative: t.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
    };
  };
  if (activeChainId) {
    const hit = tryChain(activeChainId);
    if (hit) return hit;
  }
  return tryChain(1);
};

const dsSlugForChain = (chainId: number): string | undefined =>
  DEXSCREENER_CHAIN[chainId];

const identityFromPair = (pair: DexPair): TickerRowIdentity => ({
  pairAddress: pair.pairAddress,
  dsChain: pair.chainId,
  tokenAddress: pair.baseToken?.address,
  quoteSymbol: pair.quoteToken?.symbol,
  dexId: pair.dexId
});

const marksFromPair = (
  pair: DexPair
): Pick<TickerRow, "priceUsd" | "change24h" | "volume24h" | "updatedAt"> => {
  const priceRaw = pair.priceUsd;
  const priceUsd =
    priceRaw === undefined || priceRaw === null || priceRaw === ""
      ? null
      : (() => {
          const n =
            typeof priceRaw === "number"
              ? priceRaw
              : parseFloat(String(priceRaw));
          return Number.isFinite(n) ? n : null;
        })();
  return {
    priceUsd,
    change24h:
      typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : null,
    volume24h: typeof pair.volume?.h24 === "number" ? pair.volume.h24 : null,
    updatedAt: Date.now()
  };
};

export type ResolveResult = {
  row: TickerRow;
  unresolved: boolean;
  error?: string;
};

/**
 * Resolve once for a symbol or 0x address. Persists pair identity in the row.
 */
export const resolveTickerSymbol = async (
  symbol: string,
  activeChainId: number | null,
  fetchImpl: typeof fetch = fetch
): Promise<ResolveResult> => {
  const display = normalizeSymbol(symbol);
  const unresolved = (error?: string): ResolveResult => ({
    unresolved: true,
    error,
    row: {
      symbol: display,
      pairAddress: null,
      dsChain: null,
      priceUsd: null,
      change24h: null,
      volume24h: null,
      updatedAt: null
    }
  });

  try {
    // 0x address path → tokens/v1 on active (or ethereum) chain
    if (isAddress(display)) {
      const chainId = activeChainId && DEXSCREENER_CHAIN[activeChainId]
        ? activeChainId
        : 1;
      const slug = dsSlugForChain(chainId);
      if (!slug) return unresolved("No DexScreener chain for active network.");
      const pairs = await fetchTokensV1(slug, [display], fetchImpl);
      const picked = pickDexPair(pairs, {
        symbol: display,
        allowDai: true,
        preferChains: [slug]
      });
      if (!picked) {
        return unresolved(`No DexScreener USD pair for ${display}.`);
      }
      return {
        unresolved: false,
        row: {
          symbol: display,
          ...identityFromPair(picked),
          tokenAddress: display,
          ...marksFromPair(picked)
        }
      };
    }

    // COMMON_TOKENS path
    const common = lookupCommonToken(display, activeChainId);
    if (common) {
      const slug = dsSlugForChain(common.chainId);
      const tokenAddr = common.isNative
        ? WRAPPED_NATIVE[common.chainId] || common.address
        : common.address;
      if (slug && tokenAddr && tokenAddr !== NATIVE_TOKEN_ADDRESS) {
        const pairs = await fetchTokensV1(slug, [tokenAddr], fetchImpl);
        const picked = pickDexPair(pairs, {
          symbol: display,
          allowDai: true,
          preferChains: preferChainsForSymbol(display).length
            ? preferChainsForSymbol(display)
            : [slug],
          majorGuard: true
        });
        if (picked) {
          return {
            unresolved: false,
            row: {
              symbol: display,
              ...identityFromPair(picked),
              tokenAddress: tokenAddr,
              ...marksFromPair(picked)
            }
          };
        }
      }
      // fall through to search for majors like BTC/SOL not in COMMON, or if tokens/v1 miss
    }

    // Search fallback
    const pairs = await fetchSearchPairs(display, fetchImpl);
    const picked = pickDexPair(pairs, {
      symbol: display,
      allowDai: false,
      preferChains: preferChainsForSymbol(display),
      majorGuard: true
    });
    if (!picked) {
      return unresolved(`No DexScreener USD pair for ${display}.`);
    }
    return {
      unresolved: false,
      row: {
        symbol: display,
        ...identityFromPair(picked),
        ...marksFromPair(picked)
      }
    };
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/fetch|network|Failed to fetch/i.test(msg)) {
      return unresolved(
        "API fetch failed. Check ad-blocker vs api.dexscreener.com."
      );
    }
    return unresolved(msg);
  }
};

/** Build live rows for the watchlist, resolving missing identities. */
export const buildTickerRows = async (
  prefs: TickerPrefs,
  activeChainId: number | null,
  fetchImpl: typeof fetch = fetch
): Promise<{ rows: TickerRow[]; prefs: TickerPrefs; messages: string[] }> => {
  const messages: string[] = [];
  const nextRows: Record<string, TickerRowIdentity> = { ...prefs.rows };
  const rows: TickerRow[] = [];

  for (const sym of prefs.symbols) {
    const cached = nextRows[sym] ||
      Object.entries(nextRows).find(
        ([k]) => k.toLowerCase() === sym.toLowerCase()
      )?.[1];

    if (cached?.pairAddress && cached?.dsChain) {
      rows.push({
        symbol: sym,
        pairAddress: cached.pairAddress,
        dsChain: cached.dsChain,
        tokenAddress: cached.tokenAddress,
        quoteSymbol: cached.quoteSymbol,
        dexId: cached.dexId,
        priceUsd: null,
        change24h: null,
        volume24h: null,
        updatedAt: null
      });
      continue;
    }

    const resolved = await resolveTickerSymbol(sym, activeChainId, fetchImpl);
    if (resolved.unresolved) {
      messages.push(
        resolved.error || `No DexScreener USD pair for ${sym}.`
      );
      rows.push(resolved.row);
    } else {
      nextRows[sym] = {
        pairAddress: resolved.row.pairAddress,
        dsChain: resolved.row.dsChain,
        tokenAddress: resolved.row.tokenAddress,
        quoteSymbol: resolved.row.quoteSymbol,
        dexId: resolved.row.dexId
      };
      rows.push(resolved.row);
    }
  }

  // Refresh marks for resolved rows (batch by chain)
  const refreshed = await refreshTickerRows(rows, fetchImpl);
  return {
    rows: refreshed.rows,
    prefs: { symbols: prefs.symbols, rows: nextRows },
    messages: [...messages, ...refreshed.messages]
  };
};

/**
 * Refresh marks via /pairs/ only. Never search. Keep last marks + stale on fail.
 */
export const refreshTickerRows = async (
  rows: TickerRow[],
  fetchImpl: typeof fetch = fetch
): Promise<{ rows: TickerRow[]; stale: boolean; messages: string[] }> => {
  const messages: string[] = [];
  const byChain = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.pairAddress || !r.dsChain) continue;
    const list = byChain.get(r.dsChain) || [];
    list.push(r.pairAddress);
    byChain.set(r.dsChain, list);
  }

  const quoted = new Map<string, { priceUsd: number | null; change24h: number | null; volume24h: number | null }>();
  let stale = false;

  for (const [chain, addrs] of byChain) {
    try {
      const map = await quoteDexScreenerPairs(chain, addrs, fetchImpl);
      for (const [addr, q] of map) {
        quoted.set(`${chain}:${addr.toLowerCase()}`, {
          priceUsd: q.priceUsd,
          change24h: q.change24h,
          volume24h: q.volume24h
        });
      }
      // addresses missing from response → keep last (stale if we had no prior)
      for (const a of addrs) {
        if (!map.has(a.toLowerCase())) stale = true;
      }
    } catch (e: any) {
      stale = true;
      const msg = String(e?.message || e);
      if (/DexScreener returned/.test(msg)) messages.push(msg);
      else
        messages.push(
          "API fetch failed. Check ad-blocker vs api.dexscreener.com."
        );
    }
  }

  const next = rows.map((r) => {
    if (!r.pairAddress || !r.dsChain) return r;
    const q = quoted.get(`${r.dsChain}:${r.pairAddress.toLowerCase()}`);
    if (!q) return r;
    return {
      ...r,
      priceUsd: q.priceUsd,
      change24h: q.change24h,
      volume24h: q.volume24h,
      updatedAt: Date.now()
    };
  });

  return { rows: next, stale, messages };
};

export const rowsToPrefs = (
  symbols: string[],
  rows: TickerRow[]
): TickerPrefs => {
  const map: Record<string, TickerRowIdentity> = {};
  for (const r of rows) {
    map[r.symbol] = {
      pairAddress: r.pairAddress,
      dsChain: r.dsChain,
      tokenAddress: r.tokenAddress,
      quoteSymbol: r.quoteSymbol,
      dexId: r.dexId
    };
  }
  return { symbols, rows: map };
};
