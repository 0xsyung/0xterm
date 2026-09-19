/**
 * @file ticker.test.ts
 * @description Unit tests for ticker prefs / command / pin key (#15)
 */
import { describe, expect, it, vi } from "vitest";
import {
  TICKER_MAX,
  TICKER_WIDGET_ID,
  applyTickerAdd,
  applyTickerRm,
  defaultTickerPrefs,
  migrateAnonTickerOnConnect,
  normalizePrefs,
  parseTickerCommand,
  tickerPinKey,
  writeTickerPrefs,
  readTickerPrefs,
  refreshTickerRows,
  resolveTickerSymbol,
  type TickerRow
} from "./ticker";
import { DEX_FETCH_FAILED_MSG } from "./dexscreener";

describe("tickerPinKey", () => {
  it("is stable ticker:watchlist regardless of symbol order", () => {
    expect(tickerPinKey()).toBe("ticker:watchlist");
    expect(tickerPinKey()).toBe(TICKER_WIDGET_ID);
  });
});

describe("parseTickerCommand", () => {
  it("parses show / add / rm / ls", () => {
    expect(parseTickerCommand(["ticker"])).toEqual({ op: "show" });
    expect(parseTickerCommand(["ticker", "ls"])).toEqual({ op: "ls" });
    expect(parseTickerCommand(["ticker", "add", "LINK"])).toEqual({
      op: "add",
      symbol: "LINK"
    });
    expect(parseTickerCommand(["ticker", "rm", "sol"])).toEqual({
      op: "rm",
      symbol: "SOL"
    });
  });

  it("parses 0x address adds", () => {
    const addr = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const r = parseTickerCommand(["ticker", "add", addr]);
    expect(r.op).toBe("add");
    if (r.op === "add") expect(r.symbol.toLowerCase()).toBe(addr.toLowerCase());
  });

  it("returns usage for bad args", () => {
    expect(parseTickerCommand(["ticker", "add"])).toEqual({ op: "usage" });
    expect(parseTickerCommand(["ticker", "nope"])).toEqual({ op: "usage" });
    expect(parseTickerCommand(["ticker", "rm"])).toEqual({ op: "usage" });
  });
});

describe("applyTickerAdd / rm / max 12", () => {
  it("rejects duplicates", () => {
    const prefs = defaultTickerPrefs();
    expect(applyTickerAdd(prefs, "ETH")).toEqual({
      ok: false,
      code: "TICKER_DUP"
    });
  });

  it("enforces max 12", () => {
    let prefs = { symbols: [] as string[], rows: {} };
    for (let i = 0; i < TICKER_MAX; i++) {
      const r = applyTickerAdd(prefs, `T${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) prefs = r.prefs;
    }
    expect(applyTickerAdd(prefs, "OVERFLOW")).toEqual({
      ok: false,
      code: "TICKER_FULL"
    });
  });

  it("removes by symbol case-insensitively", () => {
    const prefs = defaultTickerPrefs();
    const next = applyTickerRm(prefs, "sol");
    expect(next.symbols).toEqual(["ETH", "BTC"]);
  });
});

describe("prefs persistence", () => {
  it("reads/writes anon and migrates on connect when wallet empty", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      }
    };
    writeTickerPrefs(storage, { symbols: ["ETH", "LINK"], rows: {} }, null);
    expect(readTickerPrefs(storage, null).symbols).toEqual(["ETH", "LINK"]);

    const addr = "0xabcDEF0000000000000000000000000000000001";
    const migrated = migrateAnonTickerOnConnect(storage, addr);
    expect(migrated.symbols).toEqual(["ETH", "LINK"]);
    const wallet = JSON.parse(store[`0xterm_user_${addr.toLowerCase()}`]);
    expect(wallet.ticker.symbols).toEqual(["ETH", "LINK"]);

    // second connect does not overwrite existing wallet ticker
    writeTickerPrefs(storage, { symbols: ["BTC"], rows: {} }, null);
    const again = migrateAnonTickerOnConnect(storage, addr);
    expect(again.symbols).toEqual(["ETH", "LINK"]);
  });

  it("normalizePrefs caps at 12 and drops junk", () => {
    const prefs = normalizePrefs({
      symbols: ["eth", "!!!", "BTC", "eth"],
      rows: { ETH: { pairAddress: "0x1", dsChain: "ethereum" } }
    });
    expect(prefs.symbols[0]).toBe("ETH");
    expect(prefs.symbols).toContain("BTC");
    expect(prefs.rows.ETH.pairAddress).toBe("0x1");
  });
});

describe("refreshTickerRows", () => {
  it("hits /pairs/ not /search", async () => {
    const rows: TickerRow[] = [
      {
        symbol: "ETH",
        pairAddress: "0xethusdc",
        dsChain: "ethereum",
        priceUsd: 2000,
        change24h: 1,
        volume24h: 1e6,
        updatedAt: 1
      }
    ];
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/latest/dex/pairs/");
      expect(String(url)).not.toContain("/search");
      return {
        ok: true,
        json: async () => ({
          pairs: [
            {
              chainId: "ethereum",
              pairAddress: "0xethusdc",
              priceUsd: "2384.1",
              priceChange: { h24: -2.76 },
              volume: { h24: 1.79e6 }
            }
          ]
        })
      };
    });
    const out = await refreshTickerRows(rows, fetchMock as unknown as typeof fetch);
    expect(out.rows[0].priceUsd).toBe(2384.1);
    expect(out.stale).toBe(false);
  });
});

describe("refreshTickerRows partial failure (#84)", () => {
  it("does not mark entire board stale when a single symbol fails", async () => {
    const rows: TickerRow[] = [
      {
        symbol: "ETH",
        pairAddress: "0xethusdc",
        dsChain: "ethereum",
        priceUsd: 2000,
        change24h: 1,
        volume24h: 1e6,
        updatedAt: 1
      },
      {
        symbol: "LINK",
        pairAddress: "0xlinkusdc",
        dsChain: "ethereum",
        priceUsd: 10,
        change24h: 2,
        volume24h: 1e5,
        updatedAt: 1
      }
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        pairs: [
          {
            chainId: "ethereum",
            pairAddress: "0xethusdc",
            priceUsd: "2384.1",
            priceChange: { h24: -2.76 },
            volume: { h24: 1.79e6 }
          }
          // LINK missing from response → keep last marks
        ]
      })
    }));
    const out = await refreshTickerRows(rows, fetchMock as unknown as typeof fetch);
    expect(out.rows[0].priceUsd).toBe(2384.1);
    expect(out.rows[1].priceUsd).toBe(10); // last mark kept
    expect(out.stale).toBe(false);
  });

  it("marks board stale only when every refresh fails", async () => {
    const rows: TickerRow[] = [
      {
        symbol: "ETH",
        pairAddress: "0xethusdc",
        dsChain: "ethereum",
        priceUsd: 2000,
        change24h: 1,
        volume24h: 1e6,
        updatedAt: 1
      },
      {
        symbol: "BTC",
        pairAddress: "0xbtcusdc",
        dsChain: "ethereum",
        priceUsd: 60000,
        change24h: 0,
        volume24h: 1e7,
        updatedAt: 1
      }
    ];
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const out = await refreshTickerRows(rows, fetchMock as unknown as typeof fetch);
    expect(out.rows[0].priceUsd).toBe(2000);
    expect(out.rows[1].priceUsd).toBe(60000);
    expect(out.stale).toBe(true);
    expect(out.messages.some((m) => /ad-?blocker/i.test(m))).toBe(false);
    expect(out.messages).toContain(DEX_FETCH_FAILED_MSG);
  });
});

describe("resolveTickerSymbol error copy (#84)", () => {
  it("does not say ad-blocker for generic Failed to fetch", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const out = await resolveTickerSymbol(
      "LINK",
      1,
      fetchMock as unknown as typeof fetch
    );
    expect(out.unresolved).toBe(true);
    expect(out.error || "").not.toMatch(/ad-?blocker/i);
    expect(out.error).toBe(DEX_FETCH_FAILED_MSG);
  });
});
