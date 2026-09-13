/**
 * @file dexscreener.test.ts
 * @description Unit tests for DexScreener pair pick / parsers / refresh (#15)
 */
import { describe, expect, it, vi } from "vitest";
import {
  parseTokensV1Response,
  pickDexPair,
  quoteDexScreenerPairs,
  type DexPair
} from "./dexscreener";

const junkEthWeth: DexPair = {
  chainId: "ethereum",
  dexId: "uniswap",
  pairAddress: "0xjunk",
  priceUsd: "0.000006610",
  liquidity: { usd: 120_000 },
  baseToken: { symbol: "ETH", address: "0xeth" },
  quoteToken: { symbol: "WETH", address: "0xweth" },
  volume: { h24: 1 },
  priceChange: { h24: 0 }
};

const ethUsdc: DexPair = {
  chainId: "ethereum",
  dexId: "uniswap",
  pairAddress: "0xethusdc",
  priceUsd: "2384.10",
  liquidity: { usd: 80_000_000 },
  baseToken: { symbol: "ETH", address: "0xeth" },
  quoteToken: { symbol: "USDC", address: "0xusdc" },
  volume: { h24: 1_790_000 },
  priceChange: { h24: -2.76 }
};

const ethUsdt: DexPair = {
  chainId: "ethereum",
  dexId: "uniswap",
  pairAddress: "0xethusdt",
  priceUsd: "2380.00",
  liquidity: { usd: 40_000_000 },
  baseToken: { symbol: "ETH", address: "0xeth" },
  quoteToken: { symbol: "USDT", address: "0xusdt" },
  volume: { h24: 900_000 },
  priceChange: { h24: -2.5 }
};

describe("pickDexPair", () => {
  it("never returns junk ETH/WETH <0.01 when a liquid USDC pair exists", () => {
    const picked = pickDexPair([junkEthWeth, ethUsdc], { symbol: "ETH" });
    expect(picked).not.toBeNull();
    expect(picked!.pairAddress).toBe("0xethusdc");
    expect(parseFloat(String(picked!.priceUsd))).toBeGreaterThanOrEqual(0.01);
  });

  it("prefers USDC quote over USDT when both liquid", () => {
    // USDC has higher liquidity here — also preferred by quote rank on tie
    const picked = pickDexPair([ethUsdt, ethUsdc], { symbol: "ETH" });
    expect(picked!.quoteToken?.symbol).toBe("USDC");
  });

  it("prefers USDC over ETH/WETH wrapper pairs", () => {
    const picked = pickDexPair([junkEthWeth, ethUsdc, ethUsdt], {
      symbol: "ETH"
    });
    expect(picked!.pairAddress).toBe("0xethusdc");
  });

  it("returns null for majors when only junk pairs exist", () => {
    expect(pickDexPair([junkEthWeth], { symbol: "ETH" })).toBeNull();
  });

  it("prefers solana chain for SOL", () => {
    const solEth: DexPair = {
      chainId: "ethereum",
      pairAddress: "0xsoleth",
      priceUsd: "140",
      liquidity: { usd: 60_000 },
      baseToken: { symbol: "SOL" },
      quoteToken: { symbol: "USDC" }
    };
    const solSol: DexPair = {
      chainId: "solana",
      pairAddress: "solsollp",
      priceUsd: "141",
      liquidity: { usd: 55_000 },
      baseToken: { symbol: "SOL" },
      quoteToken: { symbol: "USDC" }
    };
    const picked = pickDexPair([solEth, solSol], {
      symbol: "SOL",
      preferChains: ["solana"]
    });
    expect(picked!.chainId).toBe("solana");
  });
});

describe("parseTokensV1Response", () => {
  it("parses bare-array tokens/v1 payloads", () => {
    const arr = [ethUsdc, ethUsdt];
    expect(parseTokensV1Response(arr)).toEqual(arr);
  });

  it("also accepts {pairs} wrappers", () => {
    expect(parseTokensV1Response({ pairs: [ethUsdc] })).toEqual([ethUsdc]);
  });

  it("returns [] for junk", () => {
    expect(parseTokensV1Response(null)).toEqual([]);
    expect(parseTokensV1Response({})).toEqual([]);
    expect(parseTokensV1Response("x")).toEqual([]);
  });
});

describe("quoteDexScreenerPairs", () => {
  it("calls /latest/dex/pairs/ not /search", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/latest/dex/pairs/");
      expect(url).not.toContain("/search");
      return {
        ok: true,
        json: async () => ({
          pairs: [
            {
              ...ethUsdc,
              pairAddress: "0xethusdc"
            }
          ]
        })
      };
    });
    const map = await quoteDexScreenerPairs(
      "ethereum",
      ["0xethusdc"],
      fetchMock as unknown as typeof fetch
    );
    expect(map.get("0xethusdc")?.priceUsd).toBe(2384.1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toMatch(/\/latest\/dex\/pairs\/ethereum\/0xethusdc/);
  });
});
