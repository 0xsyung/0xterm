/**
 * @file shareCard.ts
 * @description v1 ShareCard encode / decode / truncate + chrome helpers (#62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { getAddress, hexToString, isAddress, isHex, stringToHex, type Address, type Hex } from "viem";
import { SUPPORTED_CHAINS } from "./constants";

export const SHARE_HOLDING_CAP = 20;
export const SHARE_CARD_VERSION = 1 as const;
export const FEED_DEFAULT = 10;
export const FEED_MAX = 50;

export type ShareHolding = {
  symbol: string;
  amount: string;
  usd: number | null;
  chainId: number;
};

export type SharePortfolio = {
  totalUsd: number | null;
  holdings: ShareHolding[];
  moreCount: number;
};

export type SharePnl = {
  snapshotLabel: string;
  snapshotAt: number;
  totalUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
};

export type ShareCardV1 = {
  version: typeof SHARE_CARD_VERSION;
  owner: Address;
  ens: string;
  updatedAt: number;
  portfolio: SharePortfolio | null;
  pnl: SharePnl | null;
  revoked: boolean;
};

export type FeedItem = {
  owner: Address;
  ens: string;
  active: boolean;
  updatedAt: number;
  totalUsd: number | null;
  pnlPct: number | null;
};

type HoldingLike = {
  chainId: number;
  symbol: string;
  address?: string;
  type?: string;
  balance: string;
  valueUsd: number | null;
  isTestnet?: boolean;
};

type SnapshotHoldingLike = {
  price: number | null;
  balance: string;
};

/** Top 20 by USD (nulls last) + leftover count. */
export function truncateHoldings(holdings: ShareHolding[]): {
  holdings: ShareHolding[];
  moreCount: number;
} {
  const sorted = [...holdings].sort((a, b) => {
    const au = a.usd;
    const bu = b.usd;
    if (au == null && bu == null) return 0;
    if (au == null) return 1;
    if (bu == null) return -1;
    return bu - au;
  });
  if (sorted.length <= SHARE_HOLDING_CAP) {
    return { holdings: sorted, moreCount: 0 };
  }
  return {
    holdings: sorted.slice(0, SHARE_HOLDING_CAP),
    moreCount: sorted.length - SHARE_HOLDING_CAP
  };
}

export function portfolioSectionFromHoldings(
  holdings: HoldingLike[]
): SharePortfolio {
  const rows: ShareHolding[] = holdings.map((h) => ({
    symbol: h.symbol,
    amount: h.balance,
    usd: h.valueUsd,
    chainId: h.chainId
  }));
  const { holdings: top, moreCount } = truncateHoldings(rows);
  let total = 0;
  let any = false;
  for (const h of holdings) {
    if (h.isTestnet) continue;
    if (h.valueUsd != null) {
      total += h.valueUsd;
      any = true;
    }
  }
  return { totalUsd: any ? total : null, holdings: top, moreCount };
}

export function snapKeyFor(h: HoldingLike): string {
  if (h.type === "erc20" && h.address) {
    return `${h.chainId}:${h.address.toLowerCase()}`;
  }
  return `${h.chainId}:${h.symbol}`;
}

export function pnlSectionFromSnapshot(
  holdings: HoldingLike[],
  snapshot: {
    label: string;
    timestamp: number;
    holdings: Record<string, SnapshotHoldingLike>;
  }
): SharePnl {
  let totalUsd = 0;
  let anyTotal = false;
  let snapTotal = 0;
  let anySnap = false;
  for (const h of holdings) {
    if (h.isTestnet) continue;
    if (h.valueUsd != null) {
      totalUsd += h.valueUsd;
      anyTotal = true;
    }
    const snap = snapshot.holdings[snapKeyFor(h)];
    if (snap && snap.price != null) {
      snapTotal += snap.price * parseFloat(snap.balance);
      anySnap = true;
    }
  }
  const pnlUsd =
    anyTotal && anySnap ? totalUsd - snapTotal : anyTotal && !anySnap ? null : null;
  const pnlPct =
    pnlUsd != null && snapTotal !== 0 ? (pnlUsd / snapTotal) * 100 : pnlUsd === 0 ? 0 : null;
  return {
    snapshotLabel: snapshot.label,
    snapshotAt: snapshot.timestamp,
    totalUsd: anyTotal ? totalUsd : null,
    pnlUsd,
    pnlPct
  };
}

export function emptyCard(owner: Address, ens = ""): ShareCardV1 {
  return {
    version: SHARE_CARD_VERSION,
    owner: checksumAddress(owner),
    ens,
    updatedAt: Math.floor(Date.now() / 1000),
    portfolio: null,
    pnl: null,
    revoked: false
  };
}

export function mergeShareCard(
  existing: ShareCardV1 | null,
  patch: Partial<Pick<ShareCardV1, "portfolio" | "pnl" | "ens" | "owner">>
): ShareCardV1 {
  const owner = (patch.owner || existing?.owner ||
    "0x0000000000000000000000000000000000000000") as Address;
  const base = existing
    ? { ...existing, revoked: false }
    : emptyCard(owner, patch.ens ?? "");
  return {
    ...base,
    owner: checksumAddress(patch.owner || base.owner),
    ens: patch.ens !== undefined ? patch.ens : base.ens,
    updatedAt: Math.floor(Date.now() / 1000),
    portfolio: patch.portfolio !== undefined ? patch.portfolio : base.portfolio,
    pnl: patch.pnl !== undefined ? patch.pnl : base.pnl,
    revoked: false
  };
}

type WireCard = {
  v: number;
  owner: string;
  ens: string;
  updatedAt: number;
  revoked?: boolean;
  portfolio?: {
    totalUsd: number | null;
    moreCount: number;
    holdings: ShareHolding[];
  } | null;
  pnl?: {
    snapshotLabel: string;
    snapshotAt: number;
    totalUsd: number | null;
    pnlUsd: number | null;
    pnlPct: number | null;
  } | null;
};

export function encodeShareCard(card: ShareCardV1): Hex {
  const wire: WireCard = {
    v: SHARE_CARD_VERSION,
    owner: checksumAddress(card.owner),
    ens: card.ens || "",
    updatedAt: Math.floor(card.updatedAt),
    revoked: !!card.revoked,
    portfolio: card.portfolio
      ? {
          totalUsd: card.portfolio.totalUsd,
          moreCount: card.portfolio.moreCount,
          holdings: card.portfolio.holdings.slice(0, SHARE_HOLDING_CAP)
        }
      : null,
    pnl: card.pnl
      ? {
          snapshotLabel: card.pnl.snapshotLabel,
          snapshotAt: card.pnl.snapshotAt,
          totalUsd: card.pnl.totalUsd,
          pnlUsd: card.pnl.pnlUsd,
          pnlPct: card.pnl.pnlPct
        }
      : null
  };
  return stringToHex(JSON.stringify(wire));
}

export function decodeShareCard(data: Hex | string): ShareCardV1 | null {
  try {
    const raw =
      typeof data === "string" && isHex(data) ? hexToString(data as Hex) : String(data);
    if (!raw) return null;
    const wire = JSON.parse(raw) as WireCard;
    if (!wire || wire.v !== SHARE_CARD_VERSION) return null;
    if (!wire.owner || !isAddress(wire.owner)) return null;
    const holdings = Array.isArray(wire.portfolio?.holdings)
      ? wire.portfolio!.holdings
          .slice(0, SHARE_HOLDING_CAP)
          .map((h) => ({
            symbol: String(h.symbol ?? ""),
            amount: String(h.amount ?? "0"),
            usd: typeof h.usd === "number" && Number.isFinite(h.usd) ? h.usd : null,
            chainId: Number(h.chainId) || 0
          }))
      : [];
    const moreCount = Math.max(0, Number(wire.portfolio?.moreCount) || 0);
    const portfolio = wire.portfolio
      ? {
          totalUsd:
            typeof wire.portfolio.totalUsd === "number" &&
            Number.isFinite(wire.portfolio.totalUsd)
              ? wire.portfolio.totalUsd
              : null,
          holdings,
          moreCount
        }
      : null;
    const pnl = wire.pnl
      ? {
          snapshotLabel: String(wire.pnl.snapshotLabel ?? ""),
          snapshotAt: Number(wire.pnl.snapshotAt) || 0,
          totalUsd:
            typeof wire.pnl.totalUsd === "number" && Number.isFinite(wire.pnl.totalUsd)
              ? wire.pnl.totalUsd
              : null,
          pnlUsd:
            typeof wire.pnl.pnlUsd === "number" && Number.isFinite(wire.pnl.pnlUsd)
              ? wire.pnl.pnlUsd
              : null,
          pnlPct:
            typeof wire.pnl.pnlPct === "number" && Number.isFinite(wire.pnl.pnlPct)
              ? wire.pnl.pnlPct
              : null
        }
      : null;
    return {
      version: SHARE_CARD_VERSION,
      owner: checksumAddress(wire.owner),
      ens: String(wire.ens ?? ""),
      updatedAt: Number(wire.updatedAt) || 0,
      portfolio,
      pnl,
      revoked: !!wire.revoked
    };
  } catch {
    return null;
  }
}

export function checksumAddress(addr: string): Address {
  try {
    return getAddress(addr);
  } catch {
    return addr as Address;
  }
}

/** `0xabcd…wxyz` — 0x + 4 hex + ellipsis + last 4. */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const MINUS = "\u2212";

export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  const abs = Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
  return `${value > 0 ? "+" : MINUS}$${abs}`;
}

export function formatSignedPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0%";
  const abs = Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${value > 0 ? "+" : MINUS}${abs}%`;
}

export function pnlTone(
  value: number | null | undefined
): "primary" | "warn" | "muted" {
  if (value == null || !Number.isFinite(value) || value === 0) return "muted";
  return value > 0 ? "primary" : "warn";
}

/** `2026-09-12 18:04` in local time. `ts` is unix seconds. */
export function formatUpdatedLocal(ts: number, nowMs = Date.now()): string {
  const d = new Date(ts * 1000);
  if (!Number.isFinite(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  void nowMs;
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function formatRelative(ts: number, nowMs = Date.now()): string {
  const delta = Math.floor(nowMs / 1000) - ts;
  if (!Number.isFinite(delta)) return "";
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 86400 * 30) return `${Math.floor(delta / 86400)}d ago`;
  return "";
}

export function clampFeedCount(raw: string | undefined): number {
  if (!raw || Number.isNaN(Number(raw))) return FEED_DEFAULT;
  const n = Math.floor(Number(raw));
  if (n < 1) return FEED_DEFAULT;
  return Math.min(n, FEED_MAX);
}

export function chainName(chainId: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name || `chain ${chainId}`;
}

export type ShareContractResolve =
  | { ok: true; address: Address; chainId: number }
  | { ok: false; message: string };

/**
 * Fail-closed like CHAT_FACTORY before #68: empty map → deploy tip.
 * If another chain has a preset, tip `Share is on <chain>. Type network …`.
 */
export function resolveShareContract(
  chainId: number | null | undefined,
  contracts: Record<number, string>,
  chains: readonly { id: number; name: string }[] = SUPPORTED_CHAINS
): ShareContractResolve {
  const entries = Object.entries(contracts).filter(([, a]) => !!a);
  if (chainId != null) {
    const here = contracts[chainId];
    if (here) return { ok: true, address: here as Address, chainId };
  }
  if (entries.length > 0) {
    const [idStr] = entries[0];
    const otherId = Number(idStr);
    const name = chains.find((c) => c.id === otherId)?.name || `chain ${otherId}`;
    return {
      ok: false,
      message: `[!] Share is on ${name}. Type network ${name} first.`
    };
  }
  const name =
    chainId != null
      ? chains.find((c) => c.id === chainId)?.name || `chain ${chainId}`
      : "this chain";
  return {
    ok: false,
    message: `[!] No share contract on ${name}. Operator must deploy via contracts/script/DeployPortfolioShare.s.sol and set SHARE_CONTRACT.`
  };
}

export function noShareForMsg(query: string): string {
  return `[!] No share for ${query}.`;
}

export function shareRevokedMsg(): string {
  return `[!] Share revoked.`;
}

export function formatShareAck(owner: string, ens?: string): string {
  const short = truncateAddress(owner);
  const who = ens && ens.trim() ? `${short} / ${ens.trim()}` : short;
  return `[✓] Shared portfolio as ${who} — others: look ${short}`;
}

export function formatUnshareAck(): string {
  return `[✓] Unshared.`;
}

export function formatCopiedAck(owner: string): string {
  return `[✓] Copied ${truncateAddress(owner)}`;
}

export function shareUsage(): string {
  return "Usage: share portfolio | share pnl | share [status] | share off | unshare";
}

export function lookUsage(): string {
  return "Usage: look <address | ens.eth>";
}

export function feedUsage(): string {
  return "Usage: feed [n]  (default 10, max 50)";
}

export function toFeedItem(card: ShareCardV1, active: boolean): FeedItem {
  return {
    owner: card.owner,
    ens: card.ens,
    active,
    updatedAt: card.updatedAt,
    totalUsd: card.portfolio?.totalUsd ?? card.pnl?.totalUsd ?? null,
    pnlPct: card.pnl?.pnlPct ?? null
  };
}
