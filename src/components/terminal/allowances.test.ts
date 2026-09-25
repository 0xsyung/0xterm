/**
 * @file allowances.test.ts
 * @description Unit tests for the allowances audit + revoke planner (#109)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { sepolia } from "viem/chains";
import {
  ALLOWANCE_SPENDERS,
  allowanceLogText,
  buildRevokeTxs,
  buildTokenView,
  fetchAllowanceAudit,
  formatAllowance,
  planAllowanceReads,
  rowsFromResults,
  type AllowanceSpender
} from "./allowances";
import { DEX_REGISTRY, NATIVE_TOKEN_ADDRESS } from "./constants";
import type { CustomTokensMap } from "./types";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const SPENDER = "0x3333333333333333333333333333333333333333" as Address;

// Sepolia's DEX_REGISTRY: V3 (router + positionManager) + V2 (router).
const sepoliaDexes = DEX_REGISTRY[sepolia.id] || [];

describe("ALLOWANCE_SPENDERS", () => {
  it("derives every DEX router and position manager as a spender", () => {
    const spenders = ALLOWANCE_SPENDERS[sepolia.id];
    expect(spenders.length).toBeGreaterThan(0);
    // Every DEX router appears exactly once (deduped across chains/entries).
    const routerAddrs = sepoliaDexes
      .map((d) => d.router.toLowerCase())
      .filter((v, i, a) => a.indexOf(v) === i);
    for (const router of routerAddrs) {
      expect(spenders.some((s) => s.address.toLowerCase() === router)).toBe(true);
    }
    // V3 position manager is present.
    const npm = sepoliaDexes.find((d) => d.type === "V3")?.positionManager;
    if (npm) {
      expect(spenders.some((s) => s.address.toLowerCase() === npm.toLowerCase())).toBe(true);
    }
  });

  it("never duplicates a spender address across entries", () => {
    const addrs = ALLOWANCE_SPENDERS[sepolia.id].map((s) => s.address.toLowerCase());
    expect(new Set(addrs).size).toBe(addrs.length);
  });

  it("returns undefined for a chain with no DEX (e.g. Amoy)", () => {
    expect(ALLOWANCE_SPENDERS[80002]).toBeUndefined();
  });
});

describe("buildTokenView", () => {
  it("skips native, merges custom + COMMON_TOKENS by address", () => {
    const custom: CustomTokensMap = {
      [sepolia.id]: [
        { id: "c_eth", address: NATIVE_TOKEN_ADDRESS as Address, symbol: "ETH", name: "ETH", decimals: 18, isNative: true },
        { id: "c_tok", address: TOKEN, symbol: "FOO", name: "Foo", decimals: 6, isNative: false }
      ]
    };
    const view = buildTokenView(custom, sepolia.id);
    // No native entry.
    expect(view.some((t) => t.address === NATIVE_TOKEN_ADDRESS)).toBe(false);
    // Custom token present with its decimals.
    expect(view.some((t) => t.address === TOKEN && t.decimals === 6)).toBe(true);
    // COMMON_TOKENS entries present (not shadowed by a custom at same addr).
    expect(view.some((t) => t.symbol === "WETH" || t.symbol === "USDC")).toBe(true);
  });

  it("defaults missing decimals to 18", () => {
    const custom: CustomTokensMap = {
      [sepolia.id]: [
        { id: "c_x", address: TOKEN, symbol: "X", name: "X", isNative: false }
      ]
    };
    const view = buildTokenView(custom, sepolia.id);
    expect(view.find((t) => t.address === TOKEN)?.decimals).toBe(18);
  });
});

describe("planAllowanceReads", () => {
  const spenders: AllowanceSpender[] = [
    { label: "A", address: SPENDER, protocol: "dex" },
    { label: "B", address: "0x4444444444444444444444444444444444444444" as Address, protocol: "dex" }
  ];
  const tokens = [
    { address: TOKEN, symbol: "FOO", decimals: 6 },
    { address: "0x5555555555555555555555555555555555555555" as Address, symbol: "BAR", decimals: 18 }
  ];

  it("expands token × spender for every pair", () => {
    const pairs = planAllowanceReads(spenders, tokens);
    expect(pairs).toHaveLength(4);
  });

  it("filters to a single token symbol when given", () => {
    const pairs = planAllowanceReads(spenders, tokens, "foo");
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.token.symbol === "FOO")).toBe(true);
  });

  it("returns empty when the filter matches nothing", () => {
    expect(planAllowanceReads(spenders, tokens, "NOPE")).toEqual([]);
  });
});

describe("rowsFromResults + formatAllowance", () => {
  it("keeps only positive allowances with formatted decimals", () => {
    const pairs = planAllowanceReads(
      [{ label: "V3 router", address: SPENDER, protocol: "dex" }],
      [{ address: TOKEN, symbol: "USDC", decimals: 6 }]
    );
    const results = new Map<string, bigint>();
    results.set(
      `${TOKEN.toLowerCase()}|${SPENDER.toLowerCase()}`,
      1_000_000n
    );
    const rows = rowsFromResults(pairs, results);
    expect(rows).toHaveLength(1);
    expect(rows[0].formatted).toBe("1");
    expect(rows[0].spenderLabel).toBe("V3 router");
  });

  it("drops zero and missing allowances", () => {
    const pairs = planAllowanceReads(
      [
        { label: "A", address: SPENDER, protocol: "dex" },
        { label: "B", address: "0x4444444444444444444444444444444444444444" as Address, protocol: "dex" }
      ],
      [{ address: TOKEN, symbol: "FOO", decimals: 18 }]
    );
    const results = new Map<string, bigint>();
    results.set(`${TOKEN.toLowerCase()}|${SPENDER.toLowerCase()}`, 0n);
    // B is missing entirely.
    const rows = rowsFromResults(pairs, results);
    expect(rows).toHaveLength(0);
  });

  it("formatAllowance honors token decimals", () => {
    expect(formatAllowance(1_000_000_000_000_000_000n, 18)).toBe("1");
    expect(formatAllowance(500_000n, 6)).toBe("0.5");
  });
});

describe("fetchAllowanceAudit", () => {
  function mockClient(allowanceByKey: Record<string, bigint>): PublicClient {
    return {
      readContract: vi.fn(async ({ args }: any) => {
        const [owner, spender] = args as [Address, Address];
        return allowanceByKey[`${owner.toLowerCase()}|${spender.toLowerCase()}`] ?? 0n;
      })
    } as unknown as PublicClient;
  }

  it("returns no_spenders on a chain without DEXes", async () => {
    const res = await fetchAllowanceAudit(USER, { ...sepolia, id: 80002 } as any, {}, {
      getClient: () => mockClient({})
    });
    expect(res.kind).toBe("no_spenders");
  });

  it("collects positive allowances and counts failed reads", async () => {
    const router = DEX_REGISTRY[sepolia.id][0].router.toLowerCase();
    const npm = DEX_REGISTRY[sepolia.id][0].positionManager!.toLowerCase();
    const custom: CustomTokensMap = {
      [sepolia.id]: [
        { id: "c_foo", address: TOKEN, symbol: "FOO", name: "Foo", decimals: 6, isNative: false }
      ]
    };
    // First read (TOKEN → first spender) returns positive; others fail.
    const client: PublicClient = {
      readContract: vi.fn(async ({ args }: any) => {
        const [owner, spender] = args as [Address, Address];
        if (spender.toLowerCase() === router) return 5_000_000n; // 5 units @ 6 dp
        if (spender.toLowerCase() === npm) throw new Error("read failed");
        return 0n;
      })
    } as unknown as PublicClient;

    const res = await fetchAllowanceAudit(USER, sepolia, custom, {
      getClient: () => client
    }, "FOO");
    expect(res.kind).toBe("found");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].formatted).toBe("5");
    expect(res.failed).toBe(1);
  });

  it("filters by token symbol", async () => {
    const custom: CustomTokensMap = {
      [sepolia.id]: [
        { id: "c_foo", address: TOKEN, symbol: "FOO", name: "Foo", decimals: 6, isNative: false }
      ]
    };
    const res = await fetchAllowanceAudit(USER, sepolia, custom, {
      getClient: () => mockClient({})
    }, "BAR");
    expect(res.kind).toBe("none");
    expect(res.filter).toBe("BAR");
  });
});

describe("allowanceLogText", () => {
  it("reports no known spenders", () => {
    const text = allowanceLogText({
      kind: "no_spenders",
      chainName: "Polygon Amoy",
      rows: [],
      failed: 0
    });
    expect(text).toBe("No known spenders on Polygon Amoy.");
  });

  it("reports no positive allowances, with filter note", () => {
    const text = allowanceLogText({
      kind: "none",
      chainName: "Sepolia",
      rows: [],
      failed: 0,
      filter: "FOO"
    });
    expect(text).toBe("No positive allowances on Sepolia (filter: FOO).");
  });

  it("renders a table header, rows, and revoke hint", () => {
    const text = allowanceLogText({
      kind: "found",
      chainName: "Sepolia",
      rows: [
        {
          tokenSymbol: "USDC",
          tokenAddress: TOKEN,
          tokenDecimals: 6,
          spenderLabel: "Uniswap V3 router",
          spenderAddress: SPENDER,
          protocol: "dex",
          allowance: 1_000_000n,
          formatted: "1"
        }
      ],
      failed: 2
    });
    expect(text).toContain("ALLOWANCES (Sepolia)");
    expect(text).toContain("USDC");
    expect(text).toContain("Uniswap V3 router");
    expect(text).toContain("1");
    expect(text).toContain("1 positive approval(s). Run 'allowances revoke' to revoke all.");
    expect(text).toContain("2 read(s) failed and were skipped.");
  });
});

describe("buildRevokeTxs", () => {
  it("maps every positive row to an approve(spender, 0) tx", () => {
    const txs = buildRevokeTxs([
      {
        tokenSymbol: "USDC",
        tokenAddress: TOKEN,
        tokenDecimals: 6,
        spenderLabel: "V3 router",
        spenderAddress: SPENDER,
        protocol: "dex",
        allowance: 1n,
        formatted: "0.000001"
      },
      {
        tokenSymbol: "USDC",
        tokenAddress: TOKEN,
        tokenDecimals: 6,
        spenderLabel: "V3 position manager",
        spenderAddress: "0x4444444444444444444444444444444444444444" as Address,
        protocol: "dex",
        allowance: 2n,
        formatted: "0.000002"
      }
    ]);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toEqual({
      tokenAddress: TOKEN,
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      spenderAddress: SPENDER,
      spenderLabel: "V3 router"
    });
  });
});
