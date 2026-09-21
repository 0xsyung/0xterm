/**
 * @file pnl.ts
 * @description Realtime PnL widget helpers — parse, pin identity, mark refresh (#23)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain, PublicClient } from "viem";
import {
  DEXSCREENER_CHAIN,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_CHAINS,
  WRAPPED_NATIVE
} from "./constants";
import {
  fetchTokensV1,
  parsePriceUsd,
  pickDexPair,
  quoteDexScreenerPairs
} from "./dexscreener";
import { computePnl, snapKeyForHolding, type SnapshotHoldingLike } from "./pnlMath";
import { getTokenPriceUsd } from "./pricing";
import type { PortfolioHolding } from "./widgets/PortfolioWidget";

export const PNL_WIDGET_ID = "pnl:snapshot" as const;
export const PNL_REFRESH_SEC = 5;
export const PNL_BALANCE_REFRESH_MS = 60_000;
/** Search / getTokenPriceUsd fallback cadence when no pair identity. */
export const PNL_SEARCH_MARK_MS = 15_000;

export const PNL_FOOTER =
  "Mark-to-quote vs snapshot. Estimate, not realized. Not an executable quote — swap requotes at send.";
export const PNL_FOOTER_MUTED = "run 'portfolio' for per-token P/L";
export const PNL_FETCHING = "Marking to quote…";

export type PnlHolding = PortfolioHolding & {
  /** DexScreener pair identity for mark refresh (no search+pairs[0]). */
  pairAddress?: string | null;
  dsChain?: string | null;
};

export type PnlView = {
  kind: "pnl";
  widgetId: typeof PNL_WIDGET_ID;
  label: string;
  snapshotTime: number;
  netUsd: number | null;
  pnlPrice: number | null;
  pnlBalance: number | null;
  snapNav: number | null;
  stale: boolean;
  updatedAt: number;
  fetching?: boolean;
  holdings: PnlHolding[];
  snapshot: Record<string, SnapshotHoldingLike>;
};

export type ParsePnlResult =
  | { op: "view" }
  | { op: "baseline"; label: string };

/**
 * `pnl` → view. `pnl baseline [label]` → snapshot alias (default label `now`).
 * Extra junk on view is ignored (`pnl foo` still opens the widget).
 */
export const parsePnlCommand = (args: string[]): ParsePnlResult => {
  const a1 = (args[1] || "").toLowerCase();
  if (a1 === "baseline") {
    const label = args[2]?.trim() || "now";
    return { op: "baseline", label };
  }
  return { op: "view" };
};

export const pnlPinKey = (label: string, timestamp: number): string =>
  `${label}+${timestamp}`;

export const buildPnlView = (
  holdings: PnlHolding[],
  snapshot: {
    label: string;
    timestamp: number;
    holdings: Record<string, SnapshotHoldingLike>;
  },
  opts?: { stale?: boolean; fetching?: boolean; updatedAt?: number }
): PnlView => {
  const totals = computePnl(holdings, snapshot.holdings);
  return {
    kind: "pnl",
    widgetId: PNL_WIDGET_ID,
    label: snapshot.label,
    snapshotTime: snapshot.timestamp,
    netUsd: totals.netUsd,
    pnlPrice: totals.pnlPrice,
    pnlBalance: totals.pnlBalance,
    snapNav: totals.snapNav,
    stale: !!opts?.stale,
    fetching: !!opts?.fetching,
    updatedAt: opts?.updatedAt ?? Date.now(),
    holdings,
    snapshot: snapshot.holdings
  };
};

const tokenAddrForHolding = (h: PnlHolding): string | null => {
  if (h.type === "erc20" && h.address) return h.address;
  const wrapped = WRAPPED_NATIVE[h.chainId];
  if (wrapped && wrapped !== NATIVE_TOKEN_ADDRESS) return wrapped;
  return null;
};

/**
 * Re-mark holdings via pair identity / tokens/v1. Does **not** call balanceOf.
 * Returns updated holdings + whether any quote failed (STALE).
 */
export const refreshPnlMarks = async (
  holdings: PnlHolding[],
  fetchImpl: typeof fetch = fetch
): Promise<{ holdings: PnlHolding[]; stale: boolean }> => {
  const byChain = new Map<string, string[]>();
  const needTokens = new Map<string, string[]>(); // dsChain -> token addrs

  for (const h of holdings) {
    if (h.isTestnet) continue;
    if (h.pairAddress && h.dsChain) {
      const list = byChain.get(h.dsChain) || [];
      list.push(h.pairAddress);
      byChain.set(h.dsChain, list);
      continue;
    }
    const slug = DEXSCREENER_CHAIN[h.chainId];
    const addr = tokenAddrForHolding(h);
    if (slug && addr) {
      const list = needTokens.get(slug) || [];
      list.push(addr);
      needTokens.set(slug, list);
    }
  }

  const quoted = new Map<
    string,
    { priceUsd: number | null; pairAddress?: string; dsChain?: string }
  >();
  let refreshedAny = false;
  let failedAny = false;

  for (const [chain, addrs] of byChain) {
    try {
      const map = await quoteDexScreenerPairs(chain, addrs, fetchImpl);
      for (const a of addrs) {
        const q = map.get(a.toLowerCase());
        if (q) {
          quoted.set(`pair:${chain}:${a.toLowerCase()}`, {
            priceUsd: q.priceUsd,
            pairAddress: a,
            dsChain: chain
          });
          refreshedAny = true;
        } else {
          failedAny = true;
        }
      }
    } catch {
      failedAny = true;
    }
  }

  for (const [slug, addrs] of needTokens) {
    try {
      const uniq = [...new Set(addrs.map((a) => a.toLowerCase()))];
      const pairs = await fetchTokensV1(slug, uniq, fetchImpl);
      for (const addr of uniq) {
        const forToken = pairs.filter(
          (p) =>
            p.baseToken?.address?.toLowerCase() === addr ||
            p.quoteToken?.address?.toLowerCase() === addr
        );
        const picked = pickDexPair(forToken.length ? forToken : pairs, {
          symbol: addr,
          allowDai: true,
          preferChains: [slug],
          majorGuard: true
        });
        if (picked) {
          quoted.set(`token:${slug}:${addr}`, {
            priceUsd: parsePriceUsd(picked),
            pairAddress: picked.pairAddress,
            dsChain: picked.chainId || slug
          });
          refreshedAny = true;
        } else {
          failedAny = true;
        }
      }
    } catch {
      failedAny = true;
    }
  }

  const next = holdings.map((h) => {
    if (h.isTestnet) return h;
    if (h.pairAddress && h.dsChain) {
      const q = quoted.get(`pair:${h.dsChain}:${h.pairAddress.toLowerCase()}`);
      if (!q || q.priceUsd === null) return h;
      const bal = parseFloat(h.balance);
      return {
        ...h,
        priceUsd: q.priceUsd,
        valueUsd: Number.isFinite(bal) ? q.priceUsd * bal : null,
        priceSource: "api"
      };
    }
    const slug = DEXSCREENER_CHAIN[h.chainId];
    const addr = tokenAddrForHolding(h);
    if (!slug || !addr) return h;
    const q = quoted.get(`token:${slug}:${addr.toLowerCase()}`);
    if (!q || q.priceUsd === null) return h;
    const bal = parseFloat(h.balance);
    return {
      ...h,
      priceUsd: q.priceUsd,
      valueUsd: Number.isFinite(bal) ? q.priceUsd * bal : null,
      priceSource: "api",
      pairAddress: q.pairAddress ?? h.pairAddress,
      dsChain: q.dsChain ?? h.dsChain
    };
  });

  const stale = failedAny && !refreshedAny;
  return { holdings: next, stale };
};

/**
 * Attach pair identities via tokens/v1 once (after balance fetch) so later
 * 5s marks can use quoteDexScreenerPairs. Never uses search pairs[0].
 */
export const attachPairIdentities = async (
  holdings: PnlHolding[],
  fetchImpl: typeof fetch = fetch
): Promise<PnlHolding[]> => {
  const bySlug = new Map<string, { idx: number; addr: string }[]>();
  holdings.forEach((h, idx) => {
    if (h.isTestnet || h.pairAddress) return;
    const slug = DEXSCREENER_CHAIN[h.chainId];
    const addr = tokenAddrForHolding(h);
    if (!slug || !addr) return;
    const list = bySlug.get(slug) || [];
    list.push({ idx, addr });
    bySlug.set(slug, list);
  });

  const out = holdings.slice();
  for (const [slug, items] of bySlug) {
    try {
      const uniq = [...new Set(items.map((i) => i.addr.toLowerCase()))];
      const pairs = await fetchTokensV1(slug, uniq, fetchImpl);
      for (const { idx, addr } of items) {
        const lower = addr.toLowerCase();
        const forToken = pairs.filter(
          (p) =>
            p.baseToken?.address?.toLowerCase() === lower ||
            p.quoteToken?.address?.toLowerCase() === lower
        );
        const h = out[idx]!;
        const picked = pickDexPair(forToken.length ? forToken : pairs, {
          symbol: h.symbol,
          allowDai: true,
          preferChains: [slug],
          majorGuard: true
        });
        if (picked) {
          out[idx] = {
            ...h,
            pairAddress: picked.pairAddress,
            dsChain: picked.chainId || slug,
            priceUsd: parsePriceUsd(picked) ?? h.priceUsd,
            valueUsd:
              parsePriceUsd(picked) != null
                ? parsePriceUsd(picked)! * parseFloat(h.balance)
                : h.valueUsd,
            priceSource: parsePriceUsd(picked) != null ? "api" : h.priceSource
          };
        }
      }
    } catch {
      // keep existing prices
    }
  }
  return out;
};

export type ReadSnapshot = {
  label: string;
  timestamp: number;
  holdings: Record<string, SnapshotHoldingLike>;
} | null;

export const readPortfolioSnapshot = (
  storage: Storage | null,
  address: Address
): ReadSnapshot => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(`0xterm_user_${address.toLowerCase()}`);
    if (!raw) return null;
    const prefs = JSON.parse(raw);
    const snap = prefs?.portfolioSnapshot;
    if (!snap || typeof snap !== "object" || !snap.holdings) return null;
    return {
      label: String(snap.label || "untitled"),
      timestamp: Number(snap.timestamp) || 0,
      holdings: snap.holdings as Record<string, SnapshotHoldingLike>
    };
  } catch {
    return null;
  }
};

/** Format USD hero number: 2dp tabular. */
export const formatPnlUsd = (n: number | null): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  // NET USD has no forced +; callers decide. Keep absolute format here.
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`.replace(/^\+-/, "-");
};

export const formatPnlUsdSigned = (n: number | null): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
};

export const formatPnlPct = (n: number | null): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

/**
 * Fallback mark via getTokenPriceUsd (hardened in pricing.ts) — used at most
 * every PNL_SEARCH_MARK_MS for holdings still lacking pair identity.
 */
export const refreshPnlMarksViaPricing = async (
  holdings: PnlHolding[],
  getClient: (chain: Chain) => PublicClient,
  fetchImpl: typeof fetch = fetch
): Promise<PnlHolding[]> => {
  const out: PnlHolding[] = [];
  for (const h of holdings) {
    if (h.isTestnet || (h.pairAddress && h.dsChain)) {
      out.push(h);
      continue;
    }
    const chain = SUPPORTED_CHAINS.find((c) => c.id === h.chainId);
    if (!chain) {
      out.push(h);
      continue;
    }
    const addr = (tokenAddrForHolding(h) || NATIVE_TOKEN_ADDRESS) as Address;
    try {
      const price = await getTokenPriceUsd(
        chain,
        h.symbol,
        addr,
        h.type === "native",
        getClient(chain),
        fetchImpl
      );
      if (price === null) {
        out.push(h);
        continue;
      }
      const bal = parseFloat(h.balance);
      out.push({
        ...h,
        priceUsd: price,
        valueUsd: Number.isFinite(bal) ? price * bal : null,
        priceSource: "api"
      });
    } catch {
      out.push(h);
    }
  }
  return out;
};

export { snapKeyForHolding, computePnl };
