// @vitest-environment jsdom
/**
 * @file AllowancesWidget.test.tsx
 * @description Render tests for the allowances audit widget (#109)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import AllowancesWidget from "./AllowancesWidget";
import type { AllowanceAuditResult } from "../allowances";

const theme = THEMES.matrix;

const foundAudit: AllowanceAuditResult = {
  kind: "found",
  chainName: "Sepolia",
  rows: [
    {
      tokenSymbol: "USDC",
      tokenAddress: "0x2222222222222222222222222222222222222222",
      tokenDecimals: 6,
      spenderLabel: "Uniswap V3 router",
      spenderAddress: "0x3333333333333333333333333333333333333333",
      protocol: "dex",
      allowance: 1_000_000n,
      formatted: "1"
    },
    {
      tokenSymbol: "WETH",
      tokenAddress: "0x4444444444444444444444444444444444444444",
      tokenDecimals: 18,
      spenderLabel: "Uniswap V2 (Custom) router",
      spenderAddress: "0x5555555555555555555555555555555555555555",
      protocol: "dex",
      allowance: 500_000_000_000_000_000n,
      formatted: "0.5"
    }
  ],
  failed: 0
};

const noneAudit: AllowanceAuditResult = {
  kind: "none",
  chainName: "Base",
  rows: [],
  failed: 1
};

const noSpendersAudit: AllowanceAuditResult = {
  kind: "no_spenders",
  chainName: "Polygon Amoy",
  rows: [],
  failed: 0
};

describe("AllowancesWidget", () => {
  it("renders the audit header, token, spender, and formatted allowance", () => {
    render(<AllowancesWidget audit={foundAudit} theme={theme} />);
    expect(screen.getByText("ALLOWANCES")).toBeTruthy();
    expect(screen.getByText("Sepolia")).toBeTruthy();
    expect(screen.getByText("USDC")).toBeTruthy();
    expect(screen.getByText("Uniswap V3 router")).toBeTruthy();
    // formatted allowance renders
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0.5")).toBeTruthy();
    expect(screen.getByText(/allowances revoke/)).toBeTruthy();
  });

  it("shows the no-positive state without failing reads", () => {
    render(<AllowancesWidget audit={noneAudit} theme={theme} />);
    expect(screen.getByText(/No positive allowances on Base/)).toBeTruthy();
    expect(screen.getByText(/1 read\(s\) failed/)).toBeTruthy();
  });

  it("handles a chain with no registered spenders", () => {
    render(<AllowancesWidget audit={noSpendersAudit} theme={theme} />);
    expect(screen.getByText(/No known spenders on Polygon Amoy/)).toBeTruthy();
  });

  it("shows a PinButton when not pinned, and hides it when pinned", () => {
    const onPin = vi.fn();
    const { unmount } = render(
      <AllowancesWidget audit={foundAudit} theme={theme} onPin={onPin} />
    );
    expect(screen.getByTitle("Pin to right panel")).toBeTruthy();
    unmount();
    render(<AllowancesWidget audit={foundAudit} theme={theme} pinned />);
    expect(screen.queryByTitle("Pin to right panel")).toBeNull();
  });
});
