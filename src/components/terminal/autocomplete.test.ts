/**
 * @file autocomplete.test.ts
 * @description Unit tests for autocomplete candidate building
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  applySuggestionToInput,
  buildTokenArgCandidates,
  isTokenArgPosition
} from "./autocomplete";
import type { CustomTokenEntry } from "./types";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

function custom(symbol: string, address: string): CustomTokenEntry {
  return {
    id: `c_${address.toLowerCase()}`,
    address: address as Address,
    symbol,
    name: symbol,
    decimals: 18,
    isNative: false
  };
}

describe("isTokenArgPosition", () => {
  it("recognizes swap token args at positions 2 and 3", () => {
    expect(isTokenArgPosition("swap", 2)).toBe(true);
    expect(isTokenArgPosition("swap", 3)).toBe(true);
    expect(isTokenArgPosition("swap", 1)).toBe(false);
    expect(isTokenArgPosition("swap", 4)).toBe(false);
  });

  it("recognizes liquidity/pool command token args at positions 1 and 2", () => {
    for (const cmd of ["addliq", "provideliq", "createpool", "initialize", "initpool", "getpool", "findpool", "price"]) {
      expect(isTokenArgPosition(cmd, 1)).toBe(true);
      expect(isTokenArgPosition(cmd, 2)).toBe(true);
      expect(isTokenArgPosition(cmd, 3)).toBe(false);
    }
  });

  it("recognizes balance token arg at position 1", () => {
    expect(isTokenArgPosition("balance", 1)).toBe(true);
    expect(isTokenArgPosition("bal", 1)).toBe(true);
    expect(isTokenArgPosition("balance", 2)).toBe(false);
  });

  it("returns false for non-token commands", () => {
    expect(isTokenArgPosition("help", 1)).toBe(false);
    expect(isTokenArgPosition("deploy", 1)).toBe(false);
    expect(isTokenArgPosition("", 1)).toBe(false);
  });
});

describe("buildTokenArgCandidates", () => {
  it("includes common symbols and native symbol", () => {
    const res = buildTokenArgCandidates("balance", ["USDC", "ETH"], [], "ETH");
    expect(res).toContain("USDC");
    expect(res).toContain("ETH");
  });

  it("adds plain symbol only when unique among customs and not a common token", () => {
    const customs = [custom("FOO", A)];
    const res = buildTokenArgCandidates("balance", ["USDC"], customs, "ETH");
    expect(res).toContain("FOO"); // unique custom, no common FOO
    expect(res).toContain("FOO@0x1111…1111");
    expect(res).not.toContain("ETH@");
  });

  it("omits the plain symbol for a custom sharing a common symbol", () => {
    const customs = [custom("USDC", A)];
    const res = buildTokenArgCandidates("balance", ["USDC"], customs, "ETH");
    expect(res).toContain("USDC"); // from common
    expect(res).toContain("USDC@0x1111…1111");
    // plain custom USDC is suppressed because common USDC exists (label dedup)
    expect(res.filter((c) => c === "USDC")).toHaveLength(1);
  });

  it("omits the plain symbol when a custom symbol is ambiguous", () => {
    const customs = [custom("FOO", A), custom("FOO", B)];
    const res = buildTokenArgCandidates("balance", [], customs, "ETH");
    expect(res).toContain("FOO@0x1111…1111");
    expect(res).toContain("FOO@0x2222…2222");
    expect(res).not.toContain("FOO");
  });

  it("adds pool/api labels for the price command", () => {
    const res = buildTokenArgCandidates("price", ["USDC"], [], "ETH");
    expect(res).toContain("pool");
    expect(res).toContain("api");
  });

  it("does not add pool/api for non-price commands", () => {
    const res = buildTokenArgCandidates("balance", ["USDC"], [], "ETH");
    expect(res).not.toContain("pool");
    expect(res).not.toContain("api");
  });

  it("returns an empty array for no symbols and no customs", () => {
    expect(buildTokenArgCandidates("balance", [], [])).toEqual([]);
  });
});

describe("applySuggestionToInput", () => {
  it("appends when input ends with a space", () => {
    expect(applySuggestionToInput("balance ", "USDC", false)).toBe(
      "balance USDC"
    );
    expect(applySuggestionToInput("balance ", "USDC", true)).toBe(
      "balance USDC "
    );
  });

  it("replaces the last token when input has no trailing space", () => {
    expect(applySuggestionToInput("balance ETH", "USDC", false)).toBe(
      "balance USDC"
    );
    expect(applySuggestionToInput("balance ETH", "USDC", true)).toBe(
      "balance USDC "
    );
  });

  it("replaces the whole input when there is no space", () => {
    expect(applySuggestionToInput("ETH", "USDC", false)).toBe("USDC");
    expect(applySuggestionToInput("ETH", "USDC", true)).toBe("USDC ");
  });

  it("commits a trailing space only on commit", () => {
    expect(applySuggestionToInput("balance ", "USDC", false)).toBe(
      "balance USDC"
    );
    expect(applySuggestionToInput("balance ", "USDC", true)).toBe(
      "balance USDC "
    );
  });
});
