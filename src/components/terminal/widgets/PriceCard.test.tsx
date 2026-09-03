// @vitest-environment jsdom
/**
 * @file PriceCard.test.tsx
 * @description Render tests for the price widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import PriceCard from "./PriceCard";
import type { PriceCardData } from "./PriceCard";

const theme = THEMES.matrix;

describe("PriceCard", () => {
  it("renders on-chain pool price with rate and pool address", () => {
    const data: PriceCardData = {
      kind: "price",
      mode: "onchain",
      pairAddress: "0xAbC123",
      symbolA: "USDC",
      symbolB: "WETH",
      rate: 1.2345,
      dexName: "Uniswap V3",
      chainName: "Base"
    };
    render(<PriceCard data={data} theme={theme} />);
    expect(screen.getByText(/ON-CHAIN POOL PRICE \(Uniswap V3\)/)).toBeTruthy();
    expect(screen.getByText(/1 USDC =/)).toBeTruthy();
    expect(screen.getByText(/POOL ADDRESS: 0xAbC123/)).toBeTruthy();
  });

  it("drops the pool-address footer in compact mode", () => {
    const data: PriceCardData = {
      kind: "price",
      mode: "onchain",
      pairAddress: "0xAbC123",
      symbolA: "USDC",
      symbolB: "WETH",
      rate: 1.23,
      dexName: "Uniswap V3",
      chainName: "Base"
    };
    render(<PriceCard data={data} theme={theme} compact />);
    expect(screen.queryByText(/POOL ADDRESS/)).toBeNull();
    expect(screen.getByText(/1 USDC =/)).toBeTruthy();
  });

  it("renders api price with USD + native price and 24h change", () => {
    const data: PriceCardData = {
      kind: "price",
      mode: "api",
      tokenSymbol: "USDC",
      quoteSymbol: "WETH",
      dex: "uniswap",
      chain: "base",
      priceUsd: "0.9999",
      priceNative: "0.00042",
      h24: 1.5
    };
    render(<PriceCard data={data} theme={theme} />);
    expect(screen.getByText(/DEXSCREENER API PRICE \(UNISWAP\)/)).toBeTruthy();
    expect(screen.getByText(/\$0\.9999/)).toBeTruthy();
    expect(screen.getByText(/\+1\.5%/)).toBeTruthy();
  });

  it("shows N/A when price fields are missing", () => {
    const data: PriceCardData = { kind: "price", mode: "api" };
    render(<PriceCard data={data} theme={theme} />);
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
  });
});
