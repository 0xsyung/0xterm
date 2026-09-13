// @vitest-environment jsdom
/**
 * @file TickerWidget.test.tsx
 * @description Render smoke for ticker board chrome (#15)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import TickerWidget from "./TickerWidget";
import { TICKER_FOOTER } from "../ticker";

const theme = THEMES.matrix;

describe("TickerWidget", () => {
  it("renders header, columns, footer, and unresolved warn", () => {
    render(
      <TickerWidget
        data={{
          kind: "ticker",
          widgetId: "ticker:watchlist",
          rows: [
            {
              symbol: "ETH",
              pairAddress: "0x1",
              dsChain: "ethereum",
              priceUsd: 2384.1,
              change24h: -2.76,
              volume24h: 1.79e6,
              updatedAt: 1
            },
            {
              symbol: "ZZZ",
              pairAddress: null,
              dsChain: null,
              priceUsd: null,
              change24h: null,
              volume24h: null,
              updatedAt: null
            }
          ]
        }}
        theme={theme}
      />
    );
    expect(screen.getByText("TICKER")).toBeTruthy();
    expect(screen.getByText("SYM")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
    expect(screen.getByText("24H")).toBeTruthy();
    expect(screen.getByText("VOL 24H")).toBeTruthy();
    expect(screen.getByText(TICKER_FOOTER)).toBeTruthy();
    expect(screen.getByText("ZZZ")).toBeTruthy();
    expect(screen.getByText("ETH")).toBeTruthy();
  });

  it("drops VOL when compact", () => {
    render(
      <TickerWidget
        data={{
          kind: "ticker",
          widgetId: "ticker:watchlist",
          rows: [],
          stale: true
        }}
        theme={theme}
        compact
      />
    );
    expect(screen.queryByText("VOL 24H")).toBeNull();
    expect(screen.getByText("STALE")).toBeTruthy();
  });
});
