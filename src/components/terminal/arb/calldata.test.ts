/**
 * @file calldata.test.ts
 * @description arb calldata price-conversion unit tests (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { arbMinProfit, pricePerTokenStartFromUsd } from "./calldata";

describe("pricePerTokenStartFromUsd", () => {
  it("WETH: 1 native == 1 tokenStart (18 dec) → 1n", () => {
    expect(pricePerTokenStartFromUsd(2000, 2000, 18)).toBe(1n);
  });

  it("USDC: 1 native (2000 USD) vs 1 USDC (1 USD), 6 dec → 2e15", () => {
    // (2000/1) * 1e18 / 1e6 = 2e15 base units per native wei.
    expect(pricePerTokenStartFromUsd(2000, 1, 6)).toBe(2n * 10n ** 15n);
  });

  it("fallback to 1n when either price is missing/zero", () => {
    expect(pricePerTokenStartFromUsd(null, 1, 6)).toBe(1n);
    expect(pricePerTokenStartFromUsd(2000, null, 6)).toBe(1n);
    expect(pricePerTokenStartFromUsd(0, 1, 6)).toBe(1n);
    expect(pricePerTokenStartFromUsd(2000, 0, 6)).toBe(1n);
  });

  it("never returns 0 for a sub-penny token (floors to 1)", () => {
    // nativeToToken huge, still must be >= 1 base unit.
    expect(pricePerTokenStartFromUsd(2000, 0.0000001, 6)).toBeGreaterThan(0n);
  });
});

describe("arbMinProfit", () => {
  it("zero gas → 0 minProfit", () => {
    expect(arbMinProfit({ gasWei: 0n, pricePerTokenStart: 1n })).toBe(0n);
  });

  it("2x buffer on gas cost", () => {
    // 320k gas * 1 gwei = 320000 gwei wei... gasWei already wei.
    expect(arbMinProfit({ gasWei: 1n, pricePerTokenStart: 1n })).toBe(2n);
    expect(
      arbMinProfit({ gasWei: 10n, pricePerTokenStart: 5n })
    ).toBe(100n);
  });
});
