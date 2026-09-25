/**
 * @file vault.ts
 * @description ERC-4626 vault reads, planning, and tx encoding (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
  type Chain,
  type PublicClient
} from "viem";
import { VAULT_REGISTRY, erc4626Abi, erc20Abi } from "./constants";
import type { VaultEntry } from "./types";

// v1 is ERC-4626 only. Every 4626 function below is the canonical EIP signature
// (rounding favors the vault), so the preview matching the chosen verb is the
// authoritative min-out — never convertTo*.

export type VaultVerb = "deposit" | "mint" | "withdraw" | "redeem";

export type VaultOp = {
  verb: VaultVerb;
  vault: Address;
  amountHuman: string; // assets or shares depending on verb
  amountWei: bigint;
  chainId: number;
};

// Intent shape for #24 `plan` (unsigned; rebuild calldata at run).
export type VaultPlanStep = {
  kind: "vault";
  op: VaultVerb;
  chainId: number;
  vault: Address;
  amountHuman: string;
  amountWei: string;
  previewAtAdd: { sharesOrAssets: string; quotedAt: number };
};

export type VaultLookup =
  | { ok: true; entry: VaultEntry; known: true }
  | { ok: true; entry: VaultEntry; known: false } // raw address, not in registry
  | { ok: false; code: "VAULT_NOT_FOUND" };

export function lookupVault(chainId: number, raw: string): VaultLookup {
  const q = raw.trim();
  if (isAddress(q)) {
    const addr = getAddress(q);
    const entry = (VAULT_REGISTRY[chainId] || []).find(
      (e) => e.address.toLowerCase() === addr.toLowerCase()
    );
    return entry
      ? { ok: true, entry, known: true }
      : {
          ok: true,
          entry: { id: "raw", name: q, address: addr, protocol: "erc4626" },
          known: false
        };
  }
  const lq = q.toLowerCase();
  for (const e of VAULT_REGISTRY[chainId] || []) {
    if (e.id.toLowerCase() === lq || e.name.toLowerCase() === lq)
      return { ok: true, entry: e, known: true };
  }
  return { ok: false, code: "VAULT_NOT_FOUND" };
}

export type VaultAsset = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
};

// Read the underlying asset() plus its ERC-20 surface. If asset() reverts the
// address is not a usable 4626 — fail closed (VAULT_NOT_4626).
export async function fetchVaultAsset(
  client: PublicClient,
  vault: Address
): Promise<VaultAsset | null> {
  try {
    const [addr, symbol, name, decimals] = await Promise.all([
      client.readContract({
        address: vault,
        abi: erc4626Abi,
        functionName: "asset"
      }) as Promise<Address>,
      client.readContract({
        address: vault,
        abi: erc20Abi,
        functionName: "symbol"
      }) as Promise<string>,
      client.readContract({
        address: vault,
        abi: erc20Abi,
        functionName: "name"
      }) as Promise<string>,
      client.readContract({
        address: vault,
        abi: erc20Abi,
        functionName: "decimals"
      }) as Promise<number>
    ]);
    return { address: addr, symbol, name, decimals };
  } catch {
    return null;
  }
}

export type VaultShowData = {
  vault: Address;
  chainName: string;
  asset: VaultAsset | null;
  totalAssets: bigint | null;
  totalSupply: bigint | null;
  sharePrice: bigint | null; // convertToAssets(1 share unit)
  balanceOf: bigint | null;
  balanceValue: bigint | null; // convertToAssets(balanceOf)
  maxDeposit: bigint | null;
  maxMint: bigint | null;
  maxWithdraw: bigint | null;
  maxRedeem: bigint | null;
  apyBps: number | null; // estimate, degrades to null
};

// One show = asset + 4 max* + 2 totals + share price + balance reads, plus an
// optional APY fetch (fails to null, never blocks).
export async function fetchVaultShow(
  client: PublicClient,
  chain: Chain,
  vault: Address,
  user: Address,
  deps: { apy?: (vault: Address, chainId: number) => Promise<number | null> }
): Promise<VaultShowData> {
  const asset = await fetchVaultAsset(client, vault);
  const shareDecimals = 18n;
  const settled = await Promise.allSettled([
    asset
      ? client.readContract({
          address: vault,
          abi: erc4626Abi,
          functionName: "totalAssets"
        })
      : Promise.resolve(0n),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "totalSupply"
    }),
    asset
      ? client.readContract({
          address: vault,
          abi: erc4626Abi,
          functionName: "convertToAssets",
          args: [10n ** shareDecimals]
        })
      : Promise.resolve(0n),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "balanceOf",
      args: [user]
    }),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "maxDeposit",
      args: [user]
    }),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "maxMint",
      args: [user]
    }),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "maxWithdraw",
      args: [user]
    }),
    client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "maxRedeem",
      args: [user]
    })
  ]) as PromiseSettledResult<bigint>[];

  const get = (i: number) =>
    settled[i].status === "fulfilled" ? settled[i].value : null;
  const totalAssets = get(0);
  const totalSupply = get(1);
  const sharePrice = get(2);
  const balanceOf = get(3);
  const maxDeposit = get(4);
  const maxMint = get(5);
  const maxWithdraw = get(6);
  const maxRedeem = get(7);

  let balanceValue: bigint | null = null;
  if (balanceOf !== null && sharePrice !== null) {
    balanceValue = (balanceOf * sharePrice) / 10n ** shareDecimals;
  }

  let apyBps: number | null = null;
  if (deps.apy) {
    try {
      apyBps = await deps.apy(vault, chain.id);
    } catch {
      apyBps = null;
    }
  }

  return {
    vault,
    chainName: chain.name,
    asset,
    totalAssets,
    totalSupply,
    sharePrice,
    balanceOf,
    balanceValue,
    maxDeposit,
    maxMint,
    maxWithdraw,
    maxRedeem,
    apyBps
  };
}

// Morpho APY estimate, degraded to null on any failure. Returns basis points
// (e.g. 750 = 7.5%). The v1 endpoints differ per vault version; try v1 then
// the generic vaults endpoint and label the result an estimate in the UI.
export async function fetchMorphoApyBps(
  vault: Address,
  chainId: number
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.morpho.org/v0/vaults-v1/${chainId}:${vault}/state`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { share_price_ray?: string; last_indexed_block?: string };
    };
    // No net APY is directly indexed; derive a rough yield proxy from
    // total_assets growth is not available per-baseline, so keep this a
    // placeholder that degrades to "—" until a public net-apy field exists.
    void json;
    return null;
  } catch {
    return null;
  }
}

// Exact-amount tx for a verb. `deposit`/`mint` spend asset (approve to vault);
// `withdraw`/`redeem` burn shares from msg.sender. Receiver/owner = user.
export function encodeVaultTx(
  verb: VaultVerb,
  vault: Address,
  amountWei: bigint,
  user: Address
): { to: Address; data: `0x${string}`; value: `0x${string}` } {
  let data: `0x${string}`;
  if (verb === "deposit")
    data = encodeFunctionData({
      abi: erc4626Abi,
      functionName: "deposit",
      args: [amountWei, user]
    });
  else if (verb === "mint")
    data = encodeFunctionData({
      abi: erc4626Abi,
      functionName: "mint",
      args: [amountWei, user]
    });
  else if (verb === "withdraw")
    data = encodeFunctionData({
      abi: erc4626Abi,
      functionName: "withdraw",
      args: [amountWei, user, user]
    });
  else
    data = encodeFunctionData({
      abi: erc4626Abi,
      functionName: "redeem",
      args: [amountWei, user, user]
    });
  return { to: vault, data, value: "0x0" };
}

// The preview that matches the verb — the only min-out that honors vault fees.
// Returns null when the preview read fails (fail closed → VAULT_NOT_4626).
export async function previewForVerb(
  client: PublicClient,
  verb: VaultVerb,
  vault: Address,
  amountWei: bigint
): Promise<bigint | null> {
  const fn = `preview${verb[0].toUpperCase()}${verb.slice(1)}` as
    | "previewDeposit"
    | "previewMint"
    | "previewWithdraw"
    | "previewRedeem";
  try {
    const out = (await client.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: fn,
      args: [amountWei]
    })) as bigint;
    return out;
  } catch {
    return null;
  }
}

export function vaultAmountForMax(
  verb: VaultVerb,
  show: VaultShowData
): bigint | null {
  if (verb === "deposit") return show.maxDeposit;
  if (verb === "mint") return show.maxMint;
  if (verb === "withdraw") return show.maxWithdraw;
  return show.maxRedeem;
}

export function amountWeiFor(
  raw: string,
  decimals: number
): bigint | null {
  try {
    return parseUnits(raw, decimals);
  } catch {
    return null;
  }
}

// Drift guard: the widget preview at build time vs the re-sim before send.
// v1 aborts when the preview moved more than `maxBps` (default 50 bps).
export function previewDriftBps(before: bigint, after: bigint): number {
  if (before <= 0n || after <= 0n) return Number.MAX_SAFE_INTEGER;
  const diff = after > before ? after - before : before - after;
  return Number((diff * 10000n) / before);
}

export const VAULT_USAGE =
  "Usage: vault list | vault show <addr|id|name> | vault deposit <vault> <amount|max> | vault mint <vault> <amount|max> | vault withdraw <vault> <amount|max> | vault redeem <vault> <amount|max> | vault approve <vault> <amount|0> | vault help";
