/**
 * @file helpers.test.ts
 * @description Unit tests for pure terminal helpers
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { migrateCustomTokens, pricePinKey } from "./helpers";

describe("pricePinKey", () => {
  it("returns null for non-price payloads", () => {
    expect(pricePinKey({ kind: "swap" }, 8453, "univ3")).toBeNull();
    expect(pricePinKey(undefined, 8453, "univ3")).toBeNull();
    expect(pricePinKey(null, 8453, "univ3")).toBeNull();
  });

  it("returns null for onchain price missing required parts", () => {
    expect(pricePinKey({ kind: "price", mode: "onchain" }, 8453, "univ3")).toBeNull();
    expect(pricePinKey({ kind: "price", mode: "onchain", pairAddress: "0x" }, null, "univ3")).toBeNull();
    expect(pricePinKey({ kind: "price", mode: "onchain", pairAddress: "0x" }, 8453, null)).toBeNull();
  });

  it("builds an onchain key (lowercased address)", () => {
    expect(
      pricePinKey(
        { kind: "price", mode: "onchain", pairAddress: "0xAbC123" },
        8453,
        "univ3"
      )
    ).toBe("price:onchain:8453:univ3:0xabc123");
  });

  it("builds an api key from token/quote symbols", () => {
    expect(
      pricePinKey(
        { kind: "price", mode: "api", chain: "base", dex: "uniswap", tokenSymbol: "USDC", quoteSymbol: "WETH" },
        null,
        null
      )
    ).toBe("price:api:base:uniswap:usdc/weth");
  });

  it("returns null for api price missing required parts", () => {
    expect(
      pricePinKey({ kind: "price", mode: "api", chain: "base", dex: "uniswap" }, null, null)
    ).toBeNull();
    expect(
      pricePinKey({ kind: "price", mode: "api", chain: "", dex: "uniswap", tokenSymbol: "A", quoteSymbol: "B" }, null, null)
    ).toBeNull();
    expect(
      pricePinKey({ kind: "price", mode: "api", chain: "base", dex: "" }, null, null)
    ).toBeNull();
  });
});

describe("migrateCustomTokens", () => {
  it("converts legacy symbol-keyed maps into list form with back-filled ids", () => {
    const out = migrateCustomTokens({
      "8453": {
        USDC: { address: "0xAAAA", symbol: "USDC", name: "USD Coin", decimals: 6 },
        MOCK: { address: "0xBBBB", symbol: "MOCK", name: "Mock" }
      }
    });
    expect(out[8453]).toHaveLength(2);
    expect(out[8453][0]).toMatchObject({
      id: "c_0xaaaa",
      address: "0xAAAA",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false
    });
    expect(out[8453][1].id).toBe("c_0xbbbb");
  });

  it("normalizes array form, preserving existing ids", () => {
    const out = migrateCustomTokens({
      "1": [
        { id: "c_keep", address: "0x1234", symbol: "FOO", name: "Foo", isNative: false },
        { address: "0x5678", symbol: "BAR", name: "Bar" }
      ]
    });
    expect(out[1][0].id).toBe("c_keep");
    expect(out[1][1].id).toBe("c_0x5678");
    expect(out[1][1].isNative).toBe(false);
  });

  it("drops malformed entries", () => {
    const out = migrateCustomTokens({
      "8453": [null, { symbol: "no-address" }, { address: "0xCCC", symbol: "OK", name: "" }]
    });
    expect(out[8453]).toHaveLength(1);
    expect(out[8453][0].symbol).toBe("OK");
  });

  it("guards tokenType to known values", () => {
    const out = migrateCustomTokens({
      "1": [{ address: "0xAAA", symbol: "T", name: "", tokenType: "erc721", isNative: true }]
    });
    expect(out[1][0].tokenType).toBe("erc721");
    expect(out[1][0].isNative).toBe(true);
  });

  it("is idempotent", () => {
    const raw = {
      "8453": [
        { id: "c_0xabc", address: "0xABC", symbol: "T", name: "", decimals: 18, tokenType: "erc20", isNative: false }
      ]
    };
    expect(migrateCustomTokens(raw)).toEqual(migrateCustomTokens(migrateCustomTokens(raw)));
  });

  it("returns an empty map for nullish/empty input", () => {
    expect(migrateCustomTokens(null)).toEqual({});
    expect(migrateCustomTokens(undefined)).toEqual({});
    expect(migrateCustomTokens({})).toEqual({});
  });
});
