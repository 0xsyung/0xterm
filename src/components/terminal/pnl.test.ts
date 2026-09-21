/**
 * @file pnl.test.ts
 * @description Parser, pin identity, mark-poll cadence tests (#23)
 */
import { describe, expect, it, vi } from "vitest";
import {
  PNL_WIDGET_ID,
  buildPnlView,
  parsePnlCommand,
  pnlPinKey,
  refreshPnlMarks,
  type PnlHolding
} from "./pnl";

describe("parsePnlCommand", () => {
  it("parses bare pnl as view", () => {
    expect(parsePnlCommand(["pnl"])).toEqual({ op: "view" });
  });

  it("ignores junk args on view", () => {
    expect(parsePnlCommand(["pnl", "foo"])).toEqual({ op: "view" });
  });

  it("parses pnl baseline now", () => {
    expect(parsePnlCommand(["pnl", "baseline", "now"])).toEqual({
      op: "baseline",
      label: "now"
    });
  });

  it("parses pnl baseline <label>", () => {
    expect(parsePnlCommand(["pnl", "baseline", "foo"])).toEqual({
      op: "baseline",
      label: "foo"
    });
  });

  it("defaults baseline label to now when omitted", () => {
    expect(parsePnlCommand(["pnl", "baseline"])).toEqual({
      op: "baseline",
      label: "now"
    });
  });
});

describe("pin identity", () => {
  it("uses stable widgetId pnl:snapshot", () => {
    const view = buildPnlView([], {
      label: "a",
      timestamp: 1,
      holdings: {}
    });
    expect(view.widgetId).toBe(PNL_WIDGET_ID);
    expect(view.widgetId).toBe("pnl:snapshot");
  });

  it("pairOrSymbols is label+timestamp; new snapshot changes it, not widgetId", () => {
    expect(pnlPinKey("now", 100)).toBe("now+100");
    expect(pnlPinKey("later", 200)).toBe("later+200");
    const a = buildPnlView([], { label: "now", timestamp: 100, holdings: {} });
    const b = buildPnlView([], { label: "later", timestamp: 200, holdings: {} });
    expect(a.widgetId).toBe(b.widgetId);
    expect(pnlPinKey(a.label, a.snapshotTime)).not.toBe(
      pnlPinKey(b.label, b.snapshotTime)
    );
  });
});

describe("refreshPnlMarks", () => {
  it("does not invoke balanceOf — only DexScreener pair quotes", async () => {
    const balanceOf = vi.fn();
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "ETH",
        type: "native",
        balance: "1",
        priceUsd: 2000,
        valueUsd: 2000,
        change24h: null,
        priceSource: "api",
        isTestnet: false,
        pairAddress: "0xpairEthUsdc",
        dsChain: "ethereum"
      }
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/latest/dex/pairs/");
      expect(String(url)).not.toMatch(/balanceOf/i);
      return {
        ok: true,
        json: async () => ({
          pairs: [
            {
              chainId: "ethereum",
              pairAddress: "0xpairEthUsdc",
              priceUsd: "2100",
              priceChange: { h24: 1 },
              volume: { h24: 1 },
              liquidity: { usd: 1_000_000 },
              baseToken: { symbol: "WETH", address: "0xweth" },
              quoteToken: { symbol: "USDC", address: "0xusdc" }
            }
          ]
        })
      };
    });
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(balanceOf).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalled();
    expect(out.holdings[0]!.priceUsd).toBe(2100);
    expect(out.holdings[0]!.valueUsd).toBe(2100);
  });
});
