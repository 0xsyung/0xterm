/**
 * @file dexscreener.ts
 * @description Shared DexScreener pair resolve / refresh helpers (#15, #8)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export const DEXSCREENER_API = "https://api.dexscreener.com";

export type DexPair = {
  chainId: string;
  dexId?: string;
  pairAddress: string;
  priceUsd?: string | number | null;
  priceNative?: string | number | null;
  liquidity?: { usd?: number | null } | null;
  volume?: { h24?: number | null } | null;
  priceChange?: { h24?: number | null } | null;
  baseToken?: { symbol?: string; address?: string };
  quoteToken?: { symbol?: string; address?: string };
};

const USD_QUOTES = new Set(["USDC", "USDT", "USD", "DAI", "USDC.E", "USDC.e"]);
const SEARCH_USD_QUOTES = new Set(["USDC", "USDT", "USD", "USDC.E", "USDC.e"]);
const MAJORS = new Set(["ETH", "BTC", "SOL"]);
const LIQUIDITY_FLOOR = 50_000;

export const isUsdQuote = (sym: string | undefined | null): boolean => {
  if (!sym) return false;
  const u = sym.toUpperCase();
  return USD_QUOTES.has(u) || USD_QUOTES.has(sym);
};

export const isSearchUsdQuote = (sym: string | undefined | null): boolean => {
  if (!sym) return false;
  const u = sym.toUpperCase();
  return SEARCH_USD_QUOTES.has(u) || SEARCH_USD_QUOTES.has(sym);
};

/** Prefer USDC over USDT/USD/DAI when liquidity ties are close — USDC first in rank. */
const quoteRank = (sym: string | undefined): number => {
  const u = (sym || "").toUpperCase();
  if (u === "USDC" || u === "USDC.E") return 0;
  if (u === "USDT") return 1;
  if (u === "USD") return 2;
  if (u === "DAI") return 3;
  return 9;
};

export const parsePriceUsd = (p: DexPair): number | null => {
  const raw = p.priceUsd;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
};

export const parseLiquidityUsd = (p: DexPair): number => {
  const n = p.liquidity?.usd;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

/**
 * `/tokens/v1/{chain}/{addrs}` returns a **bare array** of pairs (not `{pairs}`).
 * Also accept `{pairs}` for resilience.
 */
export const parseTokensV1Response = (body: unknown): DexPair[] => {
  if (Array.isArray(body)) return body as DexPair[];
  if (body && typeof body === "object" && Array.isArray((body as any).pairs)) {
    return (body as any).pairs as DexPair[];
  }
  return [];
};

export const parseSearchResponse = (body: unknown): DexPair[] => {
  if (body && typeof body === "object" && Array.isArray((body as any).pairs)) {
    return (body as any).pairs as DexPair[];
  }
  if (Array.isArray(body)) return body as DexPair[];
  return [];
};

export type PickDexPairOpts = {
  symbol: string;
  /** When resolving via tokens/v1, allow DAI as quote. Search path excludes DAI per issue. */
  allowDai?: boolean;
  /** Prefer these DexScreener chainId slugs (ordered). */
  preferChains?: string[];
  /** Major guard: reject priceUsd < 0.01 for ETH/BTC/SOL. */
  majorGuard?: boolean;
};

const chainPreferenceScore = (
  chainId: string | undefined,
  prefer: string[] | undefined
): number => {
  if (!prefer || prefer.length === 0) return 0;
  const idx = prefer.findIndex(
    (c) => (chainId || "").toLowerCase() === c.toLowerCase()
  );
  return idx === -1 ? prefer.length + 1 : idx;
};

/**
 * Pick the best USD pair from candidates. Never returns junk majors with
 * priceUsd < 0.01 when a liquid USDC (etc.) pair exists. Never blindly pairs[0].
 */
export const pickDexPair = (
  pairs: DexPair[],
  opts: PickDexPairOpts
): DexPair | null => {
  if (!pairs || pairs.length === 0) return null;
  const symbol = opts.symbol.toUpperCase();
  const isMajor = MAJORS.has(symbol);
  const majorGuard = opts.majorGuard !== false && isMajor;
  const quoteOk = opts.allowDai !== false ? isUsdQuote : isSearchUsdQuote;

  let candidates = pairs.filter((p) => quoteOk(p.quoteToken?.symbol));

  // Prefer base token matching the symbol when present
  const baseMatched = candidates.filter(
    (p) => (p.baseToken?.symbol || "").toUpperCase() === symbol
  );
  if (baseMatched.length > 0) candidates = baseMatched;

  if (majorGuard) {
    const sane = candidates.filter((p) => {
      const usd = parsePriceUsd(p);
      return usd !== null && usd >= 0.01;
    });
    if (sane.length > 0) candidates = sane;
    else return null; // refuse junk majors
  }

  if (candidates.length === 0) return null;

  const anyLiquid = candidates.some((p) => parseLiquidityUsd(p) > LIQUIDITY_FLOOR);
  if (anyLiquid) {
    candidates = candidates.filter((p) => parseLiquidityUsd(p) > LIQUIDITY_FLOOR);
  }

  candidates = [...candidates].sort((a, b) => {
    const chainDelta =
      chainPreferenceScore(a.chainId, opts.preferChains) -
      chainPreferenceScore(b.chainId, opts.preferChains);
    if (chainDelta !== 0) return chainDelta;
    const liqDelta = parseLiquidityUsd(b) - parseLiquidityUsd(a);
    if (liqDelta !== 0) return liqDelta;
    return quoteRank(a.quoteToken?.symbol) - quoteRank(b.quoteToken?.symbol);
  });

  return candidates[0] ?? null;
};

export const preferChainsForSymbol = (symbol: string): string[] => {
  const s = symbol.toUpperCase();
  if (s === "SOL") return ["solana"];
  if (s === "BTC") return ["ethereum", "base", "solana", "bsc"];
  if (s === "ETH") return ["ethereum", "base"];
  return [];
};

export type QuotePairResult = {
  pair: DexPair;
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
};

/**
 * Refresh by identity: GET /latest/dex/pairs/{chainId}/{pairAddress[,…]}.
 * Never search. Never pairs[0] fallback across unrelated pairs.
 */
export const quoteDexScreenerPairs = async (
  dsChain: string,
  pairAddresses: string[],
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, QuotePairResult>> => {
  const out = new Map<string, QuotePairResult>();
  const unique = [
    ...new Set(
      pairAddresses
        .filter(Boolean)
        .map((a) => a.trim())
        .filter(Boolean)
    )
  ];
  if (!dsChain || unique.length === 0) return out;

  // DexScreener allows comma-separated ids, max 30
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    const url = `${DEXSCREENER_API}/latest/dex/pairs/${encodeURIComponent(dsChain)}/${batch.join(",")}`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`DexScreener returned ${res.status}`);
    }
    const body = await res.json();
    const pairs = parseSearchResponse(body);
    for (const wanted of batch) {
      const pair = pairs.find(
        (p) => p.pairAddress?.toLowerCase() === wanted.toLowerCase()
      );
      if (!pair) continue;
      const priceUsd = parsePriceUsd(pair);
      const change24h =
        typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : null;
      const volume24h =
        typeof pair.volume?.h24 === "number" ? pair.volume.h24 : null;
      out.set(wanted.toLowerCase(), { pair, priceUsd, change24h, volume24h });
    }
  }
  return out;
};

export const quoteDexScreenerPair = async (
  dsChain: string,
  pairAddress: string,
  fetchImpl: typeof fetch = fetch
): Promise<QuotePairResult | null> => {
  const map = await quoteDexScreenerPairs(dsChain, [pairAddress], fetchImpl);
  return map.get(pairAddress.toLowerCase()) ?? null;
};

export const fetchTokensV1 = async (
  dsChain: string,
  tokenAddresses: string[],
  fetchImpl: typeof fetch = fetch
): Promise<DexPair[]> => {
  const addrs = tokenAddresses.filter(Boolean).slice(0, 30);
  if (!dsChain || addrs.length === 0) return [];
  const url = `${DEXSCREENER_API}/tokens/v1/${encodeURIComponent(dsChain)}/${addrs.join(",")}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`DexScreener returned ${res.status}`);
  return parseTokensV1Response(await res.json());
};

export const fetchSearchPairs = async (
  query: string,
  fetchImpl: typeof fetch = fetch
): Promise<DexPair[]> => {
  const url = `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`DexScreener returned ${res.status}`);
  return parseSearchResponse(await res.json());
};

export const formatCompactVol = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const trim = (s: string) => s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  if (abs >= 1_000_000_000) return `${trim((n / 1_000_000_000).toFixed(2))}B`;
  if (abs >= 1_000_000) return `${trim((n / 1_000_000).toFixed(2))}M`;
  if (abs >= 1_000) return `${trim((n / 1_000).toFixed(1))}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const formatUsdMark = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
};

export const formatChange24h = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};
