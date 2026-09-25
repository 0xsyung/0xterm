/**
 * @file portfolioPrefs.test.ts
 * @description Unit tests for portfolio management prefs (#22)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  PORTFOLIO_WATCH_MAX,
  applyPfAdd,
  applyPfGroup,
  applyPfHide,
  applyPfRm,
  applyPfUngroup,
  applyPfUnhide,
  emptyPortfolioPrefs,
  isHiddenHolding,
  matchesHiddenKey,
  normalizePortfolioPrefs,
  parsePfCommand,
  parseWatchAddressArg,
  readPortfolioPrefs,
  writePortfolioPrefs,
  type PortfolioPrefs
} from "./portfolioPrefs";

const SELF = "0x1111111111111111111111111111111111111111" as Address;
const ALICE = "0x2222222222222222222222222222222222222222" as Address;
const BOB = "0x3333333333333333333333333333333333333333" as Address;
const CAROL = "0x4444444444444444444444444444444444444444" as Address;
const DAVE = "0x5555555555555555555555555555555555555555" as Address;

describe("parseWatchAddressArg", () => {
  it("checksums a valid 0x address", () => {
    expect(parseWatchAddressArg("0x2222222222222222222222222222222222222222")).toBe(ALICE);
  });
  it("rejects non-addresses", () => {
    expect(parseWatchAddressArg("alice.eth")).toBeNull();
    expect(parseWatchAddressArg("nope")).toBeNull();
    expect(parseWatchAddressArg("")).toBeNull();
  });
});

describe("parsePfCommand", () => {
  it("parses the bare portfolio / pf alias", () => {
    expect(parsePfCommand(["portfolio"])).toEqual({ op: "portfolio" });
    expect(parsePfCommand(["pf"])).toEqual({ op: "portfolio" });
  });
  it("parses the native / erc20 filters", () => {
    expect(parsePfCommand(["portfolio", "native"])).toEqual({ op: "portfolio", filter: "native" });
    expect(parsePfCommand(["portfolio", "ERC20"])).toEqual({ op: "portfolio", filter: "erc20" });
  });
  it("parses subcommands", () => {
    expect(parsePfCommand(["pf", "add", "0xabc"])).toEqual({ op: "add", raw: "0xabc" });
    expect(parsePfCommand(["pf", "rm", "0xabc"])).toEqual({ op: "rm", raw: "0xabc" });
    expect(parsePfCommand(["pf", "remove", "0xabc"])).toEqual({ op: "rm", raw: "0xabc" });
    expect(parsePfCommand(["pf", "ls"])).toEqual({ op: "ls" });
    expect(parsePfCommand(["pf", "hide", "USDC"])).toEqual({ op: "hide", raw: "USDC" });
    expect(parsePfCommand(["pf", "unhide", "USDC"])).toEqual({ op: "unhide", raw: "USDC" });
    expect(parsePfCommand(["pf", "show", "USDC"])).toEqual({ op: "unhide", raw: "USDC" });
    expect(parsePfCommand(["pf", "group", "stables", "USDC", "USDT", "DAI"])).toEqual({
      op: "group",
      name: "stables",
      symbols: ["USDC", "USDT", "DAI"]
    });
    expect(parsePfCommand(["pf", "ungroup", "stables"])).toEqual({ op: "ungroup", name: "stables" });
  });
  it("falls through to usage on junk / incomplete subcommands", () => {
    expect(parsePfCommand(["pf", "bogus"])).toEqual({ op: "usage" });
    expect(parsePfCommand(["pf", "add"])).toEqual({ op: "usage" });
    expect(parsePfCommand(["pf", "rm"])).toEqual({ op: "usage" });
    expect(parsePfCommand(["pf", "hide"])).toEqual({ op: "usage" });
    expect(parsePfCommand(["pf", "group", "name"])).toEqual({ op: "usage" });
  });
});

describe("applyPfAdd / applyPfRm", () => {
  it("adds a watch address, checksummed", () => {
    const res = applyPfAdd(emptyPortfolioPrefs(), ALICE, SELF);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.watchAddresses).toEqual([ALICE]);
  });
  it("rejects the connected wallet (self)", () => {
    const res = applyPfAdd(emptyPortfolioPrefs(), SELF, SELF);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_DUP");
  });
  it("rejects duplicates", () => {
    const one = applyPfAdd(emptyPortfolioPrefs(), ALICE, SELF);
    const res = one.ok ? applyPfAdd(one.prefs, ALICE, SELF) : one;
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_DUP");
  });
  it("enforces the 4-address v1 cap", () => {
    let prefs = emptyPortfolioPrefs();
    for (const a of [ALICE, BOB, CAROL, DAVE]) {
      const r = applyPfAdd(prefs, a, SELF);
      if (r.ok) prefs = r.prefs;
    }
    expect(prefs.watchAddresses.length).toBe(PORTFOLIO_WATCH_MAX);
    const res = applyPfAdd(prefs, "0x6666666666666666666666666666666666666666" as Address, SELF);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_WATCH_FULL");
  });
  it("removes a watch address", () => {
    const added = applyPfAdd(emptyPortfolioPrefs(), ALICE, SELF);
    const prefs = added.ok ? added.prefs : emptyPortfolioPrefs();
    const res = applyPfRm(prefs, ALICE);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.watchAddresses).toEqual([]);
  });
  it("rejects removing an address that isn't watched", () => {
    const res = applyPfRm(emptyPortfolioPrefs(), ALICE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_NOT_WATCHED");
  });
});

describe("hidden keys", () => {
  it("matches a symbol hide across chains", () => {
    expect(matchesHiddenKey("USDC", { chainId: 8453, symbol: "usdc" })).toBe(true);
    expect(matchesHiddenKey("USDC", { chainId: 8453, symbol: "USDC", address: "0xabc" })).toBe(true);
    expect(matchesHiddenKey("USDC", { chainId: 8453, symbol: "ETH" })).toBe(false);
  });
  it("matches a chain:addr key only on that address", () => {
    expect(matchesHiddenKey("8453:0xabc", { chainId: 8453, symbol: "USDC", address: "0xABC" })).toBe(true);
    expect(matchesHiddenKey("8453:0xabc", { chainId: 1, symbol: "USDC", address: "0xABC" })).toBe(false);
  });
  it("isHiddenHolding checks prefs", () => {
    const prefs: PortfolioPrefs = { watchAddresses: [], hidden: ["USDC", "1:0xweth"], groups: [] };
    expect(isHiddenHolding(prefs, { chainId: 137, symbol: "USDC" })).toBe(true);
    expect(isHiddenHolding(prefs, { chainId: 1, symbol: "WETH", address: "0xWETH" })).toBe(true);
    expect(isHiddenHolding(prefs, { chainId: 8453, symbol: "ETH" })).toBe(false);
  });
});

describe("applyPfHide / applyPfUnhide", () => {
  it("hides a symbol on all chains", () => {
    const res = applyPfHide(emptyPortfolioPrefs(), "USDC", 8453);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.hidden).toContain("USDC");
  });
  it("hides a 0x address scoped to the active chain", () => {
    const res = applyPfHide(emptyPortfolioPrefs(), ALICE, 8453);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.hidden).toEqual(["8453:0x2222222222222222222222222222222222222222"]);
  });
  it("requires a network before hiding by address", () => {
    const res = applyPfHide(emptyPortfolioPrefs(), ALICE, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_BAD_FILTER");
  });
  it("unhides a symbol or key", () => {
    const hidden = applyPfHide(emptyPortfolioPrefs(), "USDC", 8453);
    const prefs = hidden.ok ? hidden.prefs : emptyPortfolioPrefs();
    const res = applyPfUnhide(prefs, "usdc");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.hidden).toEqual([]);
  });
  it("unhide on a non-hidden key reports a miss", () => {
    const res = applyPfUnhide(emptyPortfolioPrefs(), "USDC");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_HIDE_MISS");
  });
});

describe("applyPfGroup / applyPfUngroup", () => {
  it("sets a group and uppercases keys", () => {
    const res = applyPfGroup(emptyPortfolioPrefs(), "stables", ["usdc", "USDT", "dai"]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.groups).toEqual([{ name: "stables", keys: ["USDC", "USDT", "DAI"] }]);
  });
  it("replaces a group with the same name", () => {
    const a = applyPfGroup(emptyPortfolioPrefs(), "stables", ["USDC"]);
    const b = a.ok ? applyPfGroup(a.prefs, "stables", ["DAI"]) : a;
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.prefs.groups).toEqual([{ name: "stables", keys: ["DAI"] }]);
  });
  it("removes a group", () => {
    const a = applyPfGroup(emptyPortfolioPrefs(), "stables", ["USDC"]);
    const prefs = a.ok ? a.prefs : emptyPortfolioPrefs();
    const res = applyPfUngroup(prefs, "stables");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefs.groups).toEqual([]);
  });
  it("ungroup on a missing group reports a miss", () => {
    const res = applyPfUngroup(emptyPortfolioPrefs(), "nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PF_GROUP_MISS");
  });
});

describe("read / write / normalize", () => {
  it("round-trips prefs via the wallet blob", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      }
    };
    const prefs: PortfolioPrefs = {
      watchAddresses: [ALICE, BOB],
      hidden: ["USDC"],
      groups: [{ name: "stables", keys: ["USDC", "DAI"] }]
    };
    writePortfolioPrefs(storage, prefs, SELF);
    expect(readPortfolioPrefs(storage, SELF)).toEqual(prefs);
  });
  it("returns empty prefs when nothing is stored", () => {
    expect(readPortfolioPrefs(null, SELF)).toEqual(emptyPortfolioPrefs());
    expect(readPortfolioPrefs({ getItem: () => null }, SELF)).toEqual(emptyPortfolioPrefs());
  });
  it("normalize caps watch addresses at 4 and drops junk", () => {
    const raw = {
      watchAddresses: [ALICE, BOB, CAROL, DAVE, "0x6666666666666666666666666666666666666666", "junk", ALICE],
      hidden: ["USDC", "usdc"],
      groups: [{ name: "g", keys: ["a", "b"] }]
    };
    const n = normalizePortfolioPrefs(raw);
    expect(n.watchAddresses.length).toBe(4);
    expect(n.hidden).toEqual(["USDC"]);
    expect(n.groups).toEqual([{ name: "g", keys: ["A", "B"] }]);
  });
  it("normalize rejects malformed groups", () => {
    expect(normalizePortfolioPrefs({ groups: [{ name: "", keys: ["a"] }, { name: "x", keys: [] }, "junk"] }).groups).toEqual([]);
  });
});
