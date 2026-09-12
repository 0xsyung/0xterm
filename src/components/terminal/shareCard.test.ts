/**
 * @file shareCard.test.ts
 * @description Unit tests for ShareCard v1 encode / decode / truncate (#62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  SHARE_HOLDING_CAP,
  clampFeedCount,
  decodeShareCard,
  emptyCard,
  encodeShareCard,
  formatCopiedAck,
  formatRelative,
  formatShareAck,
  formatSignedPct,
  formatSignedUsd,
  formatUnshareAck,
  formatUpdatedLocal,
  mergeShareCard,
  noShareForMsg,
  pnlSectionFromSnapshot,
  pnlTone,
  portfolioSectionFromHoldings,
  resolveShareContract,
  toFeedItem,
  truncateAddress,
  truncateHoldings
} from "./shareCard";

const ALICE = "0x3333333333333333333333333333333333333333" as Address;

describe("truncateHoldings", () => {
  it("keeps lists of 20 or fewer and moreCount 0", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      symbol: `T${i}`,
      amount: "1",
      usd: i,
      chainId: 1
    }));
    const out = truncateHoldings(rows);
    expect(out.holdings).toHaveLength(5);
    expect(out.moreCount).toBe(0);
  });

  it("truncates >20 by USD desc and reports +N more", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      symbol: `T${i}`,
      amount: "1",
      usd: i,
      chainId: 1
    }));
    const out = truncateHoldings(rows);
    expect(out.holdings).toHaveLength(SHARE_HOLDING_CAP);
    expect(out.moreCount).toBe(5);
    expect(out.holdings[0].symbol).toBe("T24");
    expect(out.holdings[19].symbol).toBe("T5");
  });

  it("sorts null usd last", () => {
    const out = truncateHoldings([
      { symbol: "A", amount: "1", usd: null, chainId: 1 },
      { symbol: "B", amount: "1", usd: 10, chainId: 1 }
    ]);
    expect(out.holdings[0].symbol).toBe("B");
    expect(out.holdings[1].symbol).toBe("A");
  });
});

describe("encode / decode v1", () => {
  it("round-trips a full card", () => {
    const card = mergeShareCard(emptyCard(ALICE, "alice.eth"), {
      portfolio: {
        totalUsd: 1234.5,
        moreCount: 3,
        holdings: [
          { symbol: "ETH", amount: "1.2", usd: 2400, chainId: 1 }
        ]
      },
      pnl: {
        snapshotLabel: "baseline",
        snapshotAt: 1700000000000,
        totalUsd: 1234.5,
        pnlUsd: 12.5,
        pnlPct: 1.01
      }
    });
    const hex = encodeShareCard(card);
    expect(hex.startsWith("0x")).toBe(true);
    const back = decodeShareCard(hex);
    expect(back).not.toBeNull();
    expect(back!.version).toBe(1);
    expect(back!.owner).toBe(ALICE);
    expect(back!.ens).toBe("alice.eth");
    expect(back!.portfolio?.totalUsd).toBe(1234.5);
    expect(back!.portfolio?.moreCount).toBe(3);
    expect(back!.portfolio?.holdings[0].symbol).toBe("ETH");
    expect(back!.pnl?.snapshotLabel).toBe("baseline");
    expect(back!.pnl?.pnlUsd).toBe(12.5);
    expect(back!.revoked).toBe(false);
  });

  it("round-trips portfolio-only and pnl-only", () => {
    const pf = mergeShareCard(null, {
      owner: ALICE,
      portfolio: { totalUsd: 1, moreCount: 0, holdings: [] }
    });
    expect(decodeShareCard(encodeShareCard(pf))?.pnl).toBeNull();
    const pnl = mergeShareCard(null, {
      owner: ALICE,
      pnl: {
        snapshotLabel: "s",
        snapshotAt: 1,
        totalUsd: 1,
        pnlUsd: 0,
        pnlPct: 0
      }
    });
    expect(decodeShareCard(encodeShareCard(pnl))?.portfolio).toBeNull();
  });

  it("returns null for garbage / empty / unknown version", () => {
    expect(decodeShareCard("0x")).toBeNull();
    expect(decodeShareCard("0x00")).toBeNull();
    expect(decodeShareCard("not-hex-or-json")).toBeNull();
    expect(decodeShareCard("0x7b2276223a327d")).toBeNull(); // {"v":2}
  });

  it("merge keeps the other section on combined-card update", () => {
    const first = mergeShareCard(null, {
      owner: ALICE,
      portfolio: { totalUsd: 10, moreCount: 0, holdings: [] }
    });
    const second = mergeShareCard(first, {
      pnl: {
        snapshotLabel: "x",
        snapshotAt: 1,
        totalUsd: 10,
        pnlUsd: 1,
        pnlPct: 10
      }
    });
    expect(second.portfolio?.totalUsd).toBe(10);
    expect(second.pnl?.snapshotLabel).toBe("x");
    expect(second.revoked).toBe(false);
  });
});

describe("portfolio / pnl builders", () => {
  it("sums mainnet usd and truncates holdings", () => {
    const holdings = [
      {
        chainId: 1,
        symbol: "ETH",
        balance: "1",
        valueUsd: 2000,
        isTestnet: false
      },
      {
        chainId: 11155111,
        symbol: "ETH",
        balance: "5",
        valueUsd: 999,
        isTestnet: true
      }
    ];
    const section = portfolioSectionFromHoldings(holdings);
    expect(section.totalUsd).toBe(2000);
    expect(section.holdings).toHaveLength(2);
  });

  it("computes pnl vs snapshot", () => {
    const holdings = [
      {
        chainId: 1,
        symbol: "ETH",
        type: "native",
        balance: "2",
        valueUsd: 4000,
        isTestnet: false
      }
    ];
    const pnl = pnlSectionFromSnapshot(holdings, {
      label: "start",
      timestamp: 1_700_000_000_000,
      holdings: { "1:ETH": { price: 1500, balance: "2" } }
    });
    expect(pnl.totalUsd).toBe(4000);
    expect(pnl.pnlUsd).toBe(1000);
    expect(pnl.pnlPct).toBeCloseTo(1000 / 3000 * 100);
    expect(pnl.snapshotLabel).toBe("start");
  });
});

describe("chrome formatters", () => {
  it("truncates checksum addresses", () => {
    expect(truncateAddress(ALICE)).toBe("0x3333…3333");
  });

  it("uses real minus for negatives", () => {
    expect(formatSignedUsd(-12.5)).toBe("−$12.50");
    expect(formatSignedPct(-3.2)).toBe("−3.2%");
    expect(formatSignedUsd(12.5)).toBe("+$12.50");
    expect(formatSignedPct(0)).toBe("0%");
    expect(formatSignedUsd(null)).toBe("—");
  });

  it("tones pnl: primary / warn / muted", () => {
    expect(pnlTone(1)).toBe("primary");
    expect(pnlTone(-1)).toBe("warn");
    expect(pnlTone(0)).toBe("muted");
    expect(pnlTone(null)).toBe("muted");
  });

  it("formats UPDATED local + relative", () => {
    const ts = Math.floor(Date.parse("2026-09-12T10:04:00Z") / 1000);
    const local = formatUpdatedLocal(ts);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(formatRelative(ts, Date.parse("2026-09-12T12:04:00Z"))).toBe("2h ago");
    expect(formatRelative(ts, Date.parse("2026-09-12T10:04:30Z"))).toBe("just now");
  });

  it("acks and empty-state copy", () => {
    expect(formatShareAck(ALICE, "alice.eth")).toBe(
      "[✓] Shared portfolio as 0x3333…3333 / alice.eth — others: look 0x3333…3333"
    );
    expect(formatShareAck(ALICE)).toBe(
      "[✓] Shared portfolio as 0x3333…3333 — others: look 0x3333…3333"
    );
    expect(formatUnshareAck()).toBe("[✓] Unshared.");
    expect(formatCopiedAck(ALICE)).toBe("[✓] Copied 0x3333…3333");
    expect(noShareForMsg("vitalik.eth")).toBe("[!] No share for vitalik.eth.");
  });

  it("clamps feed n", () => {
    expect(clampFeedCount(undefined)).toBe(10);
    expect(clampFeedCount("3")).toBe(3);
    expect(clampFeedCount("999")).toBe(50);
    expect(clampFeedCount("nope")).toBe(10);
  });

  it("toFeedItem prefers published totals", () => {
    const card = mergeShareCard(emptyCard(ALICE), {
      portfolio: { totalUsd: 9, moreCount: 0, holdings: [] },
      pnl: {
        snapshotLabel: "s",
        snapshotAt: 1,
        totalUsd: 8,
        pnlUsd: 1,
        pnlPct: 12.5
      }
    });
    const item = toFeedItem(card, true);
    expect(item.totalUsd).toBe(9);
    expect(item.pnlPct).toBe(12.5);
    expect(item.active).toBe(true);
  });
});

describe("resolveShareContract", () => {
  const chains = [
    { id: 11155111, name: "Sepolia" },
    { id: 8453, name: "Base" }
  ];

  it("fails closed when the map is empty (factory-before-#68 tip)", () => {
    const r = resolveShareContract(11155111, {}, chains);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("No share contract");
      expect(r.message).toContain("DeployPortfolioShare");
    }
  });

  it("tips the wired chain when the active chain has no contract", () => {
    const r = resolveShareContract(
      8453,
      { 11155111: ALICE },
      chains
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe(
        "[!] Share is on Sepolia. Type network Sepolia first."
      );
    }
  });

  it("returns the contract on the active chain", () => {
    const r = resolveShareContract(11155111, { 11155111: ALICE }, chains);
    expect(r).toEqual({ ok: true, address: ALICE, chainId: 11155111 });
  });
});
