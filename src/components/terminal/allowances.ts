/**
 * @file allowances.ts
 * @description Wallet token-allowance audit + revoke planning (#109)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { formatUnits, type Address, type Chain, type PublicClient } from "viem";
import {
  COMMON_TOKENS,
  DEX_REGISTRY,
  NATIVE_TOKEN_ADDRESS,
  erc20Abi
} from "./constants";
import type { CustomTokensMap } from "./types";

// Single source of truth for the allowances command. v1 derives every spender
// from the existing DEX_REGISTRY entries (router + V3 positionManager) so the
// audit and revoke share the same addresses the app already integrates.
// v2 can append lending/vault protocols (Aave pool, Compound comptroller, …)
// here without touching the audit/revoke code.
export type AllowanceSpender = {
  label: string;
  address: Address;
  protocol: "dex" | "lending" | "vault";
};

function deriveSpenders(): Record<number, AllowanceSpender[]> {
  const out: Record<number, AllowanceSpender[]> = {};
  for (const chainIdStr of Object.keys(DEX_REGISTRY)) {
    const chainId = Number(chainIdStr);
    const seen = new Set<string>();
    const list: AllowanceSpender[] = [];
    for (const dex of DEX_REGISTRY[chainId]) {
      if (dex.router && !seen.has(dex.router.toLowerCase())) {
        seen.add(dex.router.toLowerCase());
        list.push({
          label: `${dex.name} router`,
          address: dex.router,
          protocol: "dex"
        });
      }
      if (dex.positionManager && !seen.has(dex.positionManager.toLowerCase())) {
        seen.add(dex.positionManager.toLowerCase());
        list.push({
          label: `${dex.name} position manager`,
          address: dex.positionManager,
          protocol: "dex"
        });
      }
    }
    if (list.length > 0) out[chainId] = list;
  }
  return out;
}

export const ALLOWANCE_SPENDERS: Record<number, AllowanceSpender[]> =
  deriveSpenders();

// The token view the audit checks: custom-first merged with COMMON_TOKENS by
// address (native has no allowance and is skipped). Same merge as portfolio.
export type AllowanceToken = {
  address: Address;
  symbol: string;
  decimals: number;
};

export const buildTokenView = (
  customTokens: CustomTokensMap,
  chainId: number
): AllowanceToken[] => {
  const customList = customTokens[chainId] || [];
  const commonMap = COMMON_TOKENS[chainId] || {};
  const customAddrs = new Set(customList.map((t) => t.address.toLowerCase()));
  const view = [
    ...customList,
    ...Object.values(commonMap).filter(
      (c) => !customAddrs.has(c.address.toLowerCase())
    )
  ];
  return view
    .filter((t) => t.address !== NATIVE_TOKEN_ADDRESS)
    .map((t) => ({
      address: t.address as Address,
      symbol: t.symbol,
      decimals: t.decimals ?? 18
    }));
};

export type AllowanceRow = {
  tokenSymbol: string;
  tokenAddress: Address;
  tokenDecimals: number;
  spenderLabel: string;
  spenderAddress: Address;
  protocol: "dex" | "lending" | "vault";
  allowance: bigint;
  formatted: string;
};

export type AllowanceAuditResult = {
  kind: "found" | "none" | "no_spenders";
  chainName: string;
  rows: AllowanceRow[];
  failed: number;
  filter?: string;
};

// Expand token × spender into read pairs, optionally narrowed to one symbol.
export const planAllowanceReads = (
  spenders: AllowanceSpender[],
  tokens: AllowanceToken[],
  filterSymbol?: string
): { token: AllowanceToken; spender: AllowanceSpender }[] => {
  const pairs: { token: AllowanceToken; spender: AllowanceSpender }[] = [];
  for (const token of tokens) {
    if (filterSymbol && token.symbol.toUpperCase() !== filterSymbol.toUpperCase())
      continue;
    for (const spender of spenders) {
      pairs.push({ token, spender });
    }
  }
  return pairs;
};

export const formatAllowance = (raw: bigint, decimals: number): string =>
  formatUnits(raw, decimals);

// Positive-only filter + decimals formatting, applied to read results.
export const rowsFromResults = (
  pairs: { token: AllowanceToken; spender: AllowanceSpender }[],
  results: Map<string, bigint>
): AllowanceRow[] => {
  const rows: AllowanceRow[] = [];
  for (const { token, spender } of pairs) {
    const key = `${token.address.toLowerCase()}|${spender.address.toLowerCase()}`;
    const allowance = results.get(key);
    if (allowance === undefined || allowance <= 0n) continue;
    rows.push({
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      tokenDecimals: token.decimals,
      spenderLabel: spender.label,
      spenderAddress: spender.address,
      protocol: spender.protocol,
      allowance,
      formatted: formatUnits(allowance, token.decimals)
    });
  }
  return rows;
};

export type FetchAllowanceDeps = {
  getClient: (chain: Chain) => PublicClient;
};

// Audit: read every (token × spender) allowance in parallel, keep the positive
// ones. A failed read (non-ERC-20, blocked RPC) bumps `failed` instead of
// aborting the whole audit.
export const fetchAllowanceAudit = async (
  userAddress: Address,
  targetChain: Chain,
  customTokens: CustomTokensMap,
  deps: FetchAllowanceDeps,
  filterSymbol?: string
): Promise<AllowanceAuditResult> => {
  const spenders = ALLOWANCE_SPENDERS[targetChain.id] || [];
  if (spenders.length === 0)
    return {
      kind: "no_spenders",
      chainName: targetChain.name,
      rows: [],
      failed: 0,
      filter: filterSymbol
    };

  const tokens = buildTokenView(customTokens, targetChain.id);
  const pairs = planAllowanceReads(spenders, tokens, filterSymbol);
  const client = deps.getClient(targetChain);

  const results = new Map<string, bigint>();
  let failed = 0;
  const settled = await Promise.allSettled(
    pairs.map(({ token, spender }) =>
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress, spender.address]
      }) as Promise<bigint>
    )
  );
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      const { token, spender } = pairs[i];
      results.set(
        `${token.address.toLowerCase()}|${spender.address.toLowerCase()}`,
        s.value
      );
    } else {
      failed++;
    }
  });

  const rows = rowsFromResults(pairs, results);
  return {
    kind: rows.length > 0 ? "found" : "none",
    chainName: targetChain.name,
    rows,
    failed,
    filter: filterSymbol
  };
};

// Revoke planning: one approve(spender, 0n) per positive row, in the audit's
// row order (sequential on-chain, sharing a wallet nonce per token).
export type RevokeTx = {
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  spenderAddress: Address;
  spenderLabel: string;
};

export const buildRevokeTxs = (rows: AllowanceRow[]): RevokeTx[] =>
  rows.map((r) => ({
    tokenAddress: r.tokenAddress,
    tokenSymbol: r.tokenSymbol,
    tokenDecimals: r.tokenDecimals,
    spenderAddress: r.spenderAddress,
    spenderLabel: r.spenderLabel
  }));

// Human-readable `allowances` audit output. Renders a header, per-row table,
// and a revoke hint; no positive rows → the "none" line.
export function allowanceLogText(audit: AllowanceAuditResult): string {
  if (audit.kind === "no_spenders")
    return `No known spenders on ${audit.chainName}.`;
  const filterNote = audit.filter ? ` (filter: ${audit.filter})` : "";
  if (audit.kind === "none")
    return `No positive allowances on ${audit.chainName}${filterNote}.`;
  const header = `ALLOWANCES (${audit.chainName}${filterNote})`;
  const rows = audit.rows.map((r) => {
    const addrShort = `${r.spenderAddress.slice(0, 6)}…${r.spenderAddress.slice(-4)}`;
    return `  ${r.tokenSymbol.padEnd(8)} ${r.spenderLabel.padEnd(28)} ${addrShort.padEnd(13)} ${r.formatted}`;
  });
  const hint = `  ${audit.rows.length} positive approval(s). Run 'allowances revoke' to revoke all.`;
  const failNote =
    audit.failed > 0
      ? `\n  [!] ${audit.failed} read(s) failed and were skipped.`
      : "";
  return [header, ...rows, hint, failNote].join("\n");
}
