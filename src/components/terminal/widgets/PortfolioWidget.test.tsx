// @vitest-environment jsdom
/**
 * @file PortfolioWidget.test.tsx
 * @description Render tests for the portfolio table sections/groups (#22)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import PortfolioWidget, { type PortfolioHolding } from "./PortfolioWidget";

const theme = THEMES.matrix;

const selfEth: PortfolioHolding = {
  chainName: "Ethereum",
  chainId: 1,
  symbol: "ETH",
  type: "native",
  balance: "1.5",
  priceUsd: 3000,
  valueUsd: 4500,
  change24h: 2.5,
  priceSource: "api",
  isTestnet: false,
  account: "self"
};

const selfUsdc: PortfolioHolding = {
  chainName: "Base",
  chainId: 8453,
  symbol: "USDC",
  type: "erc20",
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  balance: "100",
  priceUsd: 1,
  valueUsd: 100,
  change24h: 0,
  priceSource: "api",
  isTestnet: false,
  account: "self"
};

const watchEth: PortfolioHolding = {
  chainName: "Ethereum",
  chainId: 1,
  symbol: "ETH",
  type: "native",
  balance: "2",
  priceUsd: 3000,
  valueUsd: 6000,
  change24h: 2.5,
  priceSource: "api",
  isTestnet: false,
  account: "0x2222222222222222222222222222222222222222"
};

const testnetEth: PortfolioHolding = {
  chainName: "Sepolia",
  chainId: 11155111,
  symbol: "ETH",
  type: "native",
  balance: "10",
  priceUsd: null,
  valueUsd: null,
  change24h: null,
  priceSource: "—",
  isTestnet: true,
  account: "self"
};

describe("PortfolioWidget", () => {
  it("renders SELF section with net USD and Δ24H", () => {
    render(<PortfolioWidget holdings={[selfEth, selfUsdc]} theme={theme} />);
    expect(screen.getByText("SELF")).toBeTruthy();
    expect(screen.getByText("ETH")).toBeTruthy();
    expect(screen.getByText("USDC")).toBeTruthy();
    expect(screen.getByText("+2.5%")).toBeTruthy();
    expect(screen.getByText(/USD estimates \(DexScreener \/ on-chain pool\)\. Not an executable quote\./)).toBeTruthy();
  });

  it("renders a WATCH section per extra address (no P/L)", () => {
    render(
      <PortfolioWidget
        holdings={[selfEth, watchEth]}
        snapshot={{ "1:ETH": { price: 2800, balance: "1" } }}
        theme={theme}
      />
    );
    expect(screen.getByText(/WATCH 0x2222…2222/)).toBeTruthy();
  });

  it("renders TESTNET (NOT REAL VALUE) as muted, not the primary section", () => {
    render(<PortfolioWidget holdings={[testnetEth]} theme={theme} />);
    expect(screen.getByText(/TESTNET \(NOT REAL VALUE\)/)).toBeTruthy();
  });

  it("renders group headers when groups are provided", () => {
    render(
      <PortfolioWidget
        holdings={[selfEth, selfUsdc]}
        groups={[{ name: "stables", keys: ["USDC"] }]}
        theme={theme}
      />
    );
    expect(screen.getByText("stables")).toBeTruthy();
    expect(screen.getByText("OTHER")).toBeTruthy();
  });

  it("shows the hidden count line", () => {
    render(<PortfolioWidget holdings={[selfEth]} hiddenCount={2} theme={theme} />);
    expect(screen.getByText(/2 hidden/)).toBeTruthy();
  });

  it("compact mode hides BALANCE / PRICE SRC / BAL Δ columns", () => {
    render(
      <PortfolioWidget
        holdings={[selfEth, selfUsdc]}
        snapshot={{ "1:ETH": { price: 2800, balance: "1" } }}
        theme={theme}
        compact
      />
    );
    expect(screen.queryByText("PRICE SRC")).toBeNull();
    expect(screen.queryByText("BAL Δ")).toBeNull();
  });
});
