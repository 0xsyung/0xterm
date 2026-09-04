/**
 * @file poolPrice.test.ts
 * @description Unit tests for on-chain pool price ratio
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { getPoolPriceRatio } from "./poolPrice";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

type ReadOverride = (args: any) => Promise<any>;

function mockClient(readContract: ReadOverride): PublicClient {
  return { readContract: vi.fn(readContract) } as unknown as PublicClient;
}

describe("getPoolPriceRatio", () => {
  // Pool: token0 = WETH(18), token1 = USDC(6), reserves = [1 WETH, 2000 USDC].
  const RES = [10n ** 18n, 2000n * 10n ** 6n];

  it("computes the V2 ratio when tokenA is token1", async () => {
    // tokenA = USDC (token1) → 1 USDC = 1/2000 WETH = 0.0005.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "getReserves") return RES;
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V2",
      pairAddress: "0xpair",
      tokenAAddress: USDC as `0x${string}`,
      tokenADecimals: 6,
      tokenBDecimals: 18
    });
    expect(ratio).toBeCloseTo(0.0005, 9);
  });

  it("computes the V2 ratio when tokenA is token0", async () => {
    // tokenA = WETH (token0) → 1 WETH = 2000 USDC.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "getReserves") return RES;
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V2",
      pairAddress: "0xpair",
      tokenAAddress: WETH as `0x${string}`,
      tokenADecimals: 18,
      tokenBDecimals: 6
    });
    expect(ratio).toBeCloseTo(2000, 6);
  });

  it("picks the right reserve when token0 is token1's side", async () => {
    // Pool: token0 = USDC(6), token1 = WETH(18), reserves = [2000 USDC, 1 WETH].
    // tokenA = WETH (token1) → 1 WETH = 2000 USDC.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return USDC;
      if (args.functionName === "getReserves") return [2000n * 10n ** 6n, 10n ** 18n, 0n];
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V2",
      pairAddress: "0xpair",
      tokenAAddress: WETH as `0x${string}`,
      tokenADecimals: 18,
      tokenBDecimals: 6
    });
    expect(ratio).toBeCloseTo(2000, 6);
  });

  it("throws when the reserve for token A is zero", async () => {
    // tokenA = USDC (token1), reserve1 = 0 → formattedA = 0 → throws.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "getReserves") return [10n ** 18n, 0n, 0n];
      throw new Error("unexpected");
    });
    await expect(
      getPoolPriceRatio(client, {
        dexType: "V2",
        pairAddress: "0xpair",
        tokenAAddress: USDC as `0x${string}`,
        tokenADecimals: 6,
        tokenBDecimals: 18
      })
    ).rejects.toThrow("Pool reserve for token A is zero.");
  });

  it("computes the V3 ratio when tokenA is token0", async () => {
    // sqrtPriceX96 = 2^96 → sqrtPrice = 1 → raw 1; both 18-dec → ratio 1.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V3",
      pairAddress: "0xpool",
      tokenAAddress: WETH as `0x${string}`,
      tokenADecimals: 18,
      tokenBDecimals: 18
    });
    expect(ratio).toBeCloseTo(1, 9);
  });

  it("inverts the V3 ratio when tokenA is token1", async () => {
    // tokenA = USDC (token1), tokenB = WETH (token0). sqrt=1 → raw 1 * 10^(18-6)
    // = 1e12 (WETH per USDC raw); tokenA is token1 → 1/1e12.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V3",
      pairAddress: "0xpool",
      tokenAAddress: USDC as `0x${string}`,
      tokenADecimals: 6,
      tokenBDecimals: 18
    });
    expect(ratio).toBeCloseTo(1e-12, 24);
  });

  it("scales the V3 ratio by the token decimal difference", async () => {
    // tokenA = USDC (token0), tokenB = WETH (token1). sqrt=1 → raw 1 * 10^(6-18)
    // = 1e-12 USDC per WETH.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return USDC;
      if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V3",
      pairAddress: "0xpool",
      tokenAAddress: USDC as `0x${string}`,
      tokenADecimals: 6,
      tokenBDecimals: 18
    });
    expect(ratio).toBeCloseTo(1e-12, 24);
  });

  it("inverts when V3 tokenA is token1 and token0 is USDC", async () => {
    // token0 = USDC, token1 = WETH. tokenA = WETH (token1). sqrt=1 → raw USDC-in-
    // WETH = 1e-12; tokenA is token1 → 1/1e-12 = 1e12.
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return USDC;
      if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
      throw new Error("unexpected");
    });
    const ratio = await getPoolPriceRatio(client, {
      dexType: "V3",
      pairAddress: "0xpool",
      tokenAAddress: WETH as `0x${string}`,
      tokenADecimals: 18,
      tokenBDecimals: 6
    });
    expect(ratio).toBeCloseTo(1e12, 0);
  });

  it("throws when the V3 pool has zero liquidity", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "token0") return WETH;
      if (args.functionName === "slot0") return [0n, 0, 0, 0, 0, 0, 0, 0];
      throw new Error("unexpected");
    });
    await expect(
      getPoolPriceRatio(client, {
        dexType: "V3",
        pairAddress: "0xpool",
        tokenAAddress: WETH as `0x${string}`,
        tokenADecimals: 18,
        tokenBDecimals: 6
      })
    ).rejects.toThrow("Pool has zero liquidity.");
  });
});
