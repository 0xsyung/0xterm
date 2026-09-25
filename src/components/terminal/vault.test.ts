/**
 * @file vault.test.ts
 * @description Unit tests for ERC-4626 vault module (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { base, mainnet } from "viem/chains";
import { VAULT_REGISTRY } from "./constants";
import {
  amountWeiFor,
  encodeVaultTx,
  fetchMorphoApyBps,
  fetchVaultAsset,
  fetchVaultShow,
  lookupVault,
  previewDriftBps,
  previewForVerb,
  vaultAmountForMax,
  type VaultShowData
} from "./vault";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const STEADY = "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" as Address;
const RAW = "0x2222222222222222222222222222222222222222" as Address;

function mockClient(
  overrides: { readContract?: (args: any) => Promise<any>; call?: (args: any) => Promise<any> } = {}
): PublicClient {
  return {
    readContract: vi.fn(overrides.readContract ?? (async () => 0n)),
    call: vi.fn(overrides.call ?? (async () => ({})))
  } as unknown as PublicClient;
}

function showData(overrides: Partial<VaultShowData> = {}): VaultShowData {
  return {
    vault: STEADY,
    chainName: "Ethereum",
    asset: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, symbol: "USDC", name: "USDCoin", decimals: 6 },
    totalAssets: 1000000n,
    totalSupply: 100000000000000000000n, // 100 shares
    sharePrice: 1000000n, // 1 USDC / share (6-dec asset)
    balanceOf: 10000000000000000000n, // 10 shares
    balanceValue: 10000000n, // 10 USDC
    maxDeposit: 100000000n,
    maxMint: 100000000000000000000n,
    maxWithdraw: 100000000n,
    maxRedeem: 100000000000000000000n,
    apyBps: null,
    ...overrides
  };
}

describe("lookupVault", () => {
  it("finds a registry entry by id (case-insensitive)", () => {
    const r = lookupVault(1, "MORPHO-STEAK-USDC");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.known).toBe(true);
      expect(r.entry.address).toBe(STEADY);
    }
  });

  it("finds by name", () => {
    const r = lookupVault(1, "Steakhouse USDC");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.id).toBe("morpho-steak-usdc");
  });

  it("treats a raw address as an unknown-but-usable vault", () => {
    const r = lookupVault(1, "0x2222222222222222222222222222222222222222");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.known).toBe(false);
      expect(r.entry.address).toBe(RAW);
    }
  });

  it("fails closed on junk", () => {
    const r = lookupVault(1, "not-a-vault");
    expect(r.ok).toBe(false);
  });

  it("checksums raw addresses", () => {
    const r = lookupVault(1, "0x2222222222222222222222222222222222222222");
    if (r.ok) expect(r.entry.address).toBe(RAW);
  });

  it("returns no registry on a chain without curated vaults", () => {
    expect(VAULT_REGISTRY[base.id] || []).toHaveLength(0);
    const r = lookupVault(base.id, "morpho-steak-usdc");
    expect(r.ok).toBe(false);
  });
});

describe("fetchVaultAsset", () => {
  it("reads asset() + ERC-20 surface", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "asset") return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        if (args.functionName === "symbol") return "USDC";
        if (args.functionName === "name") return "USD Coin";
        if (args.functionName === "decimals") return 6;
        throw new Error("unexpected");
      }
    });
    const a = await fetchVaultAsset(client, STEADY);
    expect(a).toEqual({
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6
    });
  });

  it("returns null when asset() reverts (VAULT_NOT_4626)", async () => {
    const client = mockClient({ readContract: async () => { throw new Error("revert"); } });
    expect(await fetchVaultAsset(client, RAW)).toBeNull();
  });
});

describe("fetchVaultShow", () => {
  it("fills totals, share price, balances, and max*", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "asset") return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        if (args.functionName === "symbol") return "USDC";
        if (args.functionName === "name") return "USD Coin";
        if (args.functionName === "decimals") return 6;
        if (args.functionName === "totalAssets") return 1000000n;
        if (args.functionName === "totalSupply") return 100n;
        if (args.functionName === "convertToAssets") return 1000000n;
        if (args.functionName === "balanceOf") return 10n;
        if (args.functionName === "maxDeposit") return 500000000n;
        if (args.functionName === "maxMint") return 500n;
        if (args.functionName === "maxWithdraw") return 400000000n;
        if (args.functionName === "maxRedeem") return 400n;
        throw new Error("unexpected");
      }
    });
    const show = await fetchVaultShow(client, mainnet, STEADY, USER, {});
    expect(show.totalAssets).toBe(1000000n);
    expect(show.totalSupply).toBe(100n);
    expect(show.sharePrice).toBe(1000000n);
    expect(show.balanceOf).toBe(10n);
    expect(show.maxDeposit).toBe(500000000n);
    expect(show.maxRedeem).toBe(400n);
    expect(show.apyBps).toBeNull();
  });

  it("computes balanceValue from shares × share price", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "asset") return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        if (args.functionName === "symbol") return "USDC";
        if (args.functionName === "name") return "USD Coin";
        if (args.functionName === "decimals") return 6;
        if (args.functionName === "totalAssets") return 0n;
        if (args.functionName === "totalSupply") return 0n;
        if (args.functionName === "convertToAssets") return 2000000n; // 2 USDC/share
        if (args.functionName === "balanceOf") return 10000000000000000000n; // 10 shares (18 dec)
        if (args.functionName === "maxDeposit") return 0n;
        if (args.functionName === "maxMint") return 0n;
        if (args.functionName === "maxWithdraw") return 0n;
        if (args.functionName === "maxRedeem") return 0n;
        throw new Error("unexpected");
      }
    });
    const show = await fetchVaultShow(client, mainnet, STEADY, USER, {});
    // 10 shares (1e18) × 2e6 share price / 1e18 → 20e6 asset units = 20 USDC (6-dec)
    expect(show.balanceValue).toBe(20000000n);
  });

  it("degrades APY to null when the fetch fails", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "asset") return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        if (args.functionName === "symbol") return "USDC";
        if (args.functionName === "name") return "USD Coin";
        if (args.functionName === "decimals") return 6;
        return 0n;
      }
    });
    const apy = vi.fn(async () => { throw new Error("no apy"); });
    const show = await fetchVaultShow(client, mainnet, STEADY, USER, { apy });
    expect(show.apyBps).toBeNull();
  });
});

describe("encodeVaultTx", () => {
  const SEL = {
    deposit: "0x6e553f65",
    mint: "0x94bf804d",
    withdraw: "0xb460af94",
    redeem: "0xba087652"
  };

  it("deposit encodes exact assets + receiver", () => {
    const { to, data } = encodeVaultTx("deposit", STEADY, 1000000n, USER);
    expect(to).toBe(STEADY);
    expect(data.slice(0, 10)).toBe(SEL.deposit);
  });

  it("withdraw encodes assets + receiver + owner", () => {
    const { data } = encodeVaultTx("withdraw", STEADY, 1000000n, USER);
    expect(data.slice(0, 10)).toBe(SEL.withdraw);
  });

  it("mint and redeem use their exact selectors", () => {
    expect(encodeVaultTx("mint", STEADY, 1n, USER).data.slice(0, 10)).toBe(SEL.mint);
    expect(encodeVaultTx("redeem", STEADY, 1n, USER).data.slice(0, 10)).toBe(SEL.redeem);
  });
});

describe("previewForVerb", () => {
  it("reads the verb-matching preview", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "previewDeposit") return 42n;
        throw new Error("unexpected");
      }
    });
    expect(await previewForVerb(client, "deposit", STEADY, 100n)).toBe(42n);
  });

  it("returns null on revert (VAULT_NOT_4626)", async () => {
    const client = mockClient({ readContract: async () => { throw new Error("revert"); } });
    expect(await previewForVerb(client, "deposit", STEADY, 100n)).toBeNull();
  });

  it("caps at max* when verb amount is max", () => {
    const show = showData({ maxDeposit: 42n });
    expect(vaultAmountForMax("deposit", show)).toBe(42n);
    const redeem = showData({ maxRedeem: 9n });
    expect(vaultAmountForMax("redeem", redeem)).toBe(9n);
  });
});

describe("previewDriftBps", () => {
  it("reports bps drift between two previews", () => {
    expect(previewDriftBps(1000000n, 1000000n)).toBe(0);
    expect(previewDriftBps(1000000n, 1005000n)).toBe(50); // 0.5% = 50 bps
    expect(previewDriftBps(1000000n, 995000n)).toBe(50);
  });

  it("maxes out on zero denominators", () => {
    expect(previewDriftBps(0n, 100n)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("amountWeiFor", () => {
  it("parses human amounts at asset decimals", () => {
    expect(amountWeiFor("1.5", 6)).toBe(1500000n);
  });

  it("returns null on junk", () => {
    expect(amountWeiFor("abc", 6)).toBeNull();
    expect(amountWeiFor("", 6)).toBeNull();
  });
});

describe("fetchMorphoApyBps", () => {
  it("degrades to null on network failure (never blocks)", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("network"); }) as typeof fetch;
    try {
      expect(await fetchMorphoApyBps(STEADY, 1)).toBeNull();
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});

describe("VAULT_REGISTRY", () => {
  it("has the three verified Ethereum Morpho entries", () => {
    expect(VAULT_REGISTRY[1].length).toBe(3);
    for (const e of VAULT_REGISTRY[1]) {
      expect(e.protocol).toBe("morpho");
      expect(e.assetHint).toBeTruthy();
    }
  });
  it("other chains are empty (curated list only)", () => {
    expect(VAULT_REGISTRY[mainnet.id]?.length).toBe(3);
    expect(VAULT_REGISTRY[base.id]).toBeUndefined();
  });
});
