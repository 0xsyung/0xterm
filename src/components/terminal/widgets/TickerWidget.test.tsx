// @vitest-environment jsdom
/**
 * @file TickerWidget.test.tsx
 * @description Render smoke for ticker board chrome (#15)
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import TickerWidget from "./TickerWidget";
import { TICKER_FOOTER } from "../ticker";

vi.mock("../dexscreener", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../dexscreener")>();
  return {
    ...actual,
    quoteDexScreenerPairs: vi.fn(async () => {
      const m = new Map<string, { priceUsd: number | null; change24h: number | null; volume24h: number | null }>();
      m.set("0xpairEthUsdc", { priceUsd: 2100, change24h: 1.5, volume24h: 1_000_000 });
      return m;
    })
  };
});

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
    expect(screen.getByText("UNRESOLVED")).toBeTruthy();
    expect(screen.getByText("ETH")).toBeTruthy();
  });


  it("shows UNRESOLVED badge even for long symbols (not truncated) (#87)", () => {
    render(
      <TickerWidget
        data={{
          kind: "ticker",
          widgetId: "ticker:watchlist",
          rows: [
            {
              symbol: "ZZZNOPE",
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
    expect(screen.getByText("ZZZNOPE")).toBeTruthy();
    expect(screen.getByText("UNRESOLVED")).toBeTruthy();
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

  it("drops VOL when narrow (stack band / <768)", () => {
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
              priceUsd: 1,
              change24h: 0,
              volume24h: 1e6,
              updatedAt: 1
            }
          ]
        }}
        theme={theme}
        narrow
      />
    );
    expect(screen.queryByText("VOL 24H")).toBeNull();
    expect(screen.getByText("ETH")).toBeTruthy();
  });

  it("shows the pinned label when pinned", () => {
    render(
      <TickerWidget
        data={{
          kind: "ticker",
          widgetId: "ticker:watchlist",
          rows: [],
          stale: true
        }}
        theme={theme}
        pinned
      />
    );
    expect(screen.getByText("pinned")).toBeTruthy();
  });

  it("shows the next-refresh countdown", () => {
    render(
      <TickerWidget
        data={{ kind: "ticker", widgetId: "ticker:watchlist", rows: [] }}
        theme={theme}
      />
    );
    expect(screen.getByText(/next/)).toBeTruthy();
  });

  it("self-refreshes rows when liveRefresh is enabled", async () => {
    vi.useFakeTimers();
    try {
      const onRowsUpdate = vi.fn();
      render(
        <TickerWidget
          data={{
            kind: "ticker",
            widgetId: "ticker:watchlist",
            rows: [
              {
                symbol: "ETH",
                pairAddress: "0xpairEthUsdc",
                dsChain: "ethereum",
                priceUsd: 2000,
                change24h: 1,
                volume24h: 1e6,
                updatedAt: 1
              }
            ]
          }}
          theme={theme}
          liveRefresh
          onRowsUpdate={onRowsUpdate}
        />
      );
      // Countdown starts at TICKER_REFRESH_SEC (15) — advance past the first tick.
      await vi.advanceTimersByTimeAsync(16_000);
      expect(onRowsUpdate).toHaveBeenCalled();
      expect(onRowsUpdate.mock.calls[0]?.[0][0]?.priceUsd).toBe(2100);
    } finally {
      vi.useRealTimers();
    }
  });
});
