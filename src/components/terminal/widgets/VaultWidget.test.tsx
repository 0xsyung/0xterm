// @vitest-environment jsdom
/**
 * @file VaultWidget.test.tsx
 * @description Render tests for the pinnable ERC-4626 vault widget (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { mainnet } from "viem/chains";
import type { Address } from "viem";
import { THEMES } from "../constants";
import VaultWidget, { type VaultListRow } from "./VaultWidget";
import type { VaultShowData } from "../vault";

const theme = THEMES.matrix;
const STEADY = "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" as Address;

const show: VaultShowData = {
  vault: STEADY,
  chainName: "Ethereum",
  asset: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, symbol: "USDC", name: "USDCoin", decimals: 6 },
  totalAssets: 1000000n,
  totalSupply: 100000000000000000000n,
  sharePrice: 1000000n,
  balanceOf: 10000000000000000000n,
  balanceValue: 10000000n,
  maxDeposit: 100000000n,
  maxMint: 100000000000000000000n,
  maxWithdraw: 100000000n,
  maxRedeem: 100000000000000000000n,
  apyBps: 750
};

const rows: VaultListRow[] = [
  { id: "morpho-steak-usdc", name: "Steakhouse USDC", protocol: "morpho", address: STEADY, assetSymbol: "USDC" }
];

describe("VaultWidget", () => {
  it("renders the show screen with asset + your shares + APY estimate", () => {
    render(<VaultWidget mode="show" chain={mainnet} show={show} known theme={theme} />);
    expect(screen.getByText("0xBEEF…64CB")).toBeTruthy();
    expect(screen.getByText("USDC (USDCoin)")).toBeTruthy();
    expect(screen.getByText(/10 \(≈10 USDC\)/)).toBeTruthy(); // your shares (10 @ 18 dec)
    expect(screen.getByText("7.50%")).toBeTruthy(); // apyBps 750 → 7.50%
    expect(screen.queryByText(/asset\(\) reverted/)).toBeNull();
  });

  it("warns on an unknown (non-registry) address", () => {
    render(<VaultWidget mode="show" chain={mainnet} show={show} known={false} theme={theme} />);
    expect(screen.getByText(/UNKNOWN ADDRESS — unaudited/)).toBeTruthy();
  });

  it("renders the registry list table", () => {
    render(<VaultWidget mode="list" chain={mainnet} listRows={rows} theme={theme} />);
    expect(screen.getByText("VAULT REGISTRY")).toBeTruthy();
    expect(screen.getByText("morpho-steak-usdc")).toBeTruthy();
    expect(screen.getByText("Steakhouse USDC")).toBeTruthy();
  });

  it("renders the empty-chain message for an empty list", () => {
    render(<VaultWidget mode="list" chain={mainnet} listRows={[]} theme={theme} />);
    expect(screen.getByText(/No curated vaults on Ethereum/)).toBeTruthy();
  });

  it("shows the share-inflation caveat on the show screen", () => {
    render(<VaultWidget mode="show" chain={mainnet} show={show} known theme={theme} />);
    expect(screen.getByText(/Share-inflation/)).toBeTruthy();
  });
});
