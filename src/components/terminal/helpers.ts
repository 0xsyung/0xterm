/**
 * @file helpers.ts
 * @description Pure helper functions shared by terminal commands
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address } from "viem";
import type { CustomTokenEntry, CustomTokensMap } from "./types";

/**
 * Stable dedupe key for a pinned price widget. Returns null when the payload
 * is not a price kind or lacks the parts needed to address it.
 */
export const pricePinKey = (
  cd: any,
  activeChain: number | null,
  activeDex: string | null
): string | null => {
  if (cd?.kind !== "price") return null;
  if (cd.mode === "onchain") {
    const addr = cd.pairAddress as string | undefined;
    if (!activeChain || !activeDex || !addr) return null;
    return `price:onchain:${activeChain}:${activeDex}:${addr.toLowerCase()}`;
  }
  // api mode — network slug + dex + pair tokens
  const net = (cd.chain as string) || "";
  const d = (cd.dex as string) || "";
  const q = `${cd.tokenSymbol || ""}/${cd.quoteSymbol || ""}`.toLowerCase();
  if (!net || !d || q === "/") return null;
  return `price:api:${net}:${d}:${q}`;
};

// Normalize a raw stored custom-token blob into the current list-per-chain
// shape. Accepts both the new form (chain -> array) and the legacy form
// (chain -> symbol-keyed object). Idempotent; malformed entries are dropped.
export const migrateCustomTokens = (raw: any): CustomTokensMap => {
  const out: CustomTokensMap = {};
  const toEntry = (t: any): CustomTokenEntry | null => {
    if (!t || typeof t !== "object" || !t.address) return null;
    const addr = t.address as string;
    return {
      id: typeof t.id === "string" ? t.id : `c_${addr.toLowerCase()}`,
      address: addr as Address,
      symbol: String(t.symbol ?? "?"),
      name: String(t.name ?? ""),
      decimals: typeof t.decimals === "number" ? t.decimals : undefined,
      tokenType:
        t.tokenType === "erc721"
          ? "erc721"
          : t.tokenType === "erc20"
            ? "erc20"
            : undefined,
      isNative: !!t.isNative
    };
  };
  for (const [chainIdStr, value] of Object.entries(raw ?? {})) {
    const chainId = Number(chainIdStr);
    const entries: CustomTokenEntry[] = [];
    if (Array.isArray(value)) {
      for (const t of value) {
        const e = toEntry(t);
        if (e) entries.push(e);
      }
    } else if (value && typeof value === "object") {
      // legacy: symbol-keyed token map
      for (const t of Object.values(value)) {
        const e = toEntry(t);
        if (e) entries.push(e);
      }
    }
    if (entries.length > 0) out[chainId] = entries;
  }
  return out;
};
