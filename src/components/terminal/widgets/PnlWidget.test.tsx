// @vitest-environment jsdom
/**
 * @file PnlWidget.test.tsx
 * @description Chrome lock tests for realtime PnL card (#23)
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PnlWidget from "./PnlWidget";
import { PNL_FOOTER, PNL_FOOTER_MUTED, PNL_FETCHING } from "../pnl";

const theme = {
  text: "text-white",
  muted: "text-muted",
  primary: "text-primary",
  warn: "text-warn",
  border: "border-white",
  cardBg: "bg-black",
  rounded: "rounded",
  glow: ""
};

const baseData = {
  kind: "pnl" as const,
  widgetId: "pnl:snapshot" as const,
  label: "now",
  snapshotTime: 1_700_000_000_000,
  netUsd: 12480.22,
  pnlPrice: -132.4,
  pnlBalance: 40,
  snapNav: 12612.62,
  stale: false,
  updatedAt: Date.now(),
  holdings: [],
  snapshot: {}
};

describe("PnlWidget", () => {
  it("renders hero NET / P/L (PRICE) / BAL Δ and exact footer", () => {
    render(<PnlWidget data={baseData} theme={theme} />);
    expect(screen.getByText("PNL vs SNAPSHOT")).toBeTruthy();
    expect(screen.getByText("NET USD")).toBeTruthy();
    expect(screen.getByText("P/L (PRICE)")).toBeTruthy();
    expect(screen.getByText("BAL Δ")).toBeTruthy();
    expect(screen.getByText("ESTIMATE")).toBeTruthy();
    expect(screen.getByText(PNL_FOOTER)).toBeTruthy();
    expect(screen.getByText(PNL_FOOTER_MUTED)).toBeTruthy();
    expect(screen.getByText(/\$12,480\.22/)).toBeTruthy();
  });

  it("drops BAL Δ when compact or narrow", () => {
    const { rerender } = render(
      <PnlWidget data={baseData} theme={theme} compact />
    );
    expect(screen.queryByText("BAL Δ")).toBeNull();
    rerender(<PnlWidget data={baseData} theme={theme} narrow />);
    expect(screen.queryByText("BAL Δ")).toBeNull();
  });

  it("shows STALE on header and fetching copy", () => {
    const { rerender } = render(
      <PnlWidget data={{ ...baseData, stale: true }} theme={theme} />
    );
    expect(screen.getByText("STALE")).toBeTruthy();
    rerender(
      <PnlWidget data={{ ...baseData, fetching: true }} theme={theme} />
    );
    expect(screen.getByText(PNL_FETCHING)).toBeTruthy();
  });

  it("uses theme.warn class for negative Δ (never text-red-400)", () => {
    const { container } = render(
      <PnlWidget data={baseData} theme={theme} />
    );
    expect(container.innerHTML).not.toContain("text-red-400");
    expect(container.innerHTML).toContain("text-warn");
  });
});
