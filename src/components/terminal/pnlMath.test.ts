/**
 * @file pnlMath.test.ts
 * @description Golden tests for shared computePnl (#23)
 */
import { describe, expect, it } from "vitest";
import { computePnl, pnlPricePct, snapKeyForHolding } from "./pnlMath";

const eth = {
  chainId: 1,
  symbol: "ETH",
  type: "native" as const,
  balance: "1.0",
  priceUsd: 2000,
  valueUsd: 2000,
  isTestnet: false
};

const usdc = {
  chainId: 1,
  symbol: "USDC",
  type: "erc20" as const,
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  balance: "1000",
  priceUsd: 1,
  valueUsd: 1000,
  isTestnet: false
};

const sepoliaEth = {
  chainId: 11155111,
  symbol: "ETH",
  type: "native" as const,
  balance: "5",
  priceUsd: 2000,
  valueUsd: 10000,
  isTestnet: true
};

describe("snapKeyForHolding", () => {
  it("keys natives by symbol and erc20 by lowercased address", () => {
    expect(snapKeyForHolding(eth)).toBe("1:ETH");
    expect(snapKeyForHolding(usdc)).toBe(
      "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    );
  });
});

describe("computePnl", () => {
  it("golden: 2 mainnet holdings + snapshot with a balance flow", () => {
    // Snapshot: 1 ETH @ 2100, 500 USDC @ 1 → snapNav = 2100 + 500 = 2600
    // Now: 1 ETH @ 2000 (=2000), 1000 USDC @ 1 (=1000) → net = 3000
    // PRICE P/L: ETH (2000 - 2100*1) + USDC (1000 - 1*1000) = -100 + 0 = -100
    // BAL Δ: ETH (2000 - 2100*1) + USDC (1000 - 1*500) = -100 + 500 = 400
    const snapshot = {
      "1:ETH": { price: 2100, balance: "1.0" },
      "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
        price: 1,
        balance: "500"
      }
    };
    const res = computePnl([eth, usdc], snapshot);
    expect(res.netUsd).toBe(3000);
    expect(res.pnlPrice).toBe(-100);
    expect(res.pnlBalance).toBe(400);
    expect(res.snapNav).toBe(2600);
    expect(pnlPricePct(res.pnlPrice, res.snapNav)).toBeCloseTo((-100 / 2600) * 100);
  });

  it("excludes testnet holdings from totals", () => {
    const snapshot = {
      "1:ETH": { price: 2000, balance: "1" },
      "11155111:ETH": { price: 2000, balance: "5" }
    };
    const res = computePnl([eth, sepoliaEth], snapshot);
    expect(res.netUsd).toBe(2000);
    expect(res.pnlPrice).toBe(0);
    expect(res.pnlBalance).toBe(0);
    expect(res.snapNav).toBe(2000);
  });

  it("skips rows with missing snap.price (no NaN)", () => {
    const snapshot = {
      "1:ETH": { price: null, balance: "1" },
      "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
        price: 1,
        balance: "1000"
      }
    };
    const res = computePnl([eth, usdc], snapshot);
    expect(res.netUsd).toBe(3000);
    expect(res.pnlPrice).toBe(0);
    expect(Number.isNaN(res.pnlPrice as number)).toBe(false);
    expect(res.snapNav).toBe(1000);
  });

  it("zero Δ is finite (not null)", () => {
    const snapshot = {
      "1:ETH": { price: 2000, balance: "1.0" }
    };
    const res = computePnl([eth], snapshot);
    expect(res.pnlPrice).toBe(0);
    expect(res.pnlBalance).toBe(0);
    expect(res.netUsd).toBe(2000);
  });

  it("returns nulls when no priced mainnet holdings", () => {
    const res = computePnl(
      [{ ...eth, priceUsd: null, valueUsd: null }],
      null
    );
    expect(res).toEqual({
      netUsd: null,
      pnlPrice: null,
      pnlBalance: null,
      snapNav: null
    });
  });
});
