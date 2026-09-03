/**
 * @file constants.test.ts
 * @description Unit tests for theme resolution, DEX registry, and token constants
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  COMMON_TOKENS,
  DEX_REGISTRY,
  THEMES,
  THEME_ALIASES,
  THEME_ORDER,
  isKnownThemeInput,
  resolveChain,
  resolveThemeKey
} from "./constants";

describe("resolveThemeKey", () => {
  it.each(THEME_ORDER)("returns identity for key %s", (key) => {
    expect(resolveThemeKey(key)).toBe(key);
  });

  it.each([
    ["MATRIX", "matrix"],
    ["Amber", "amber"],
    ["IBM3270", "ibm3270"],
    ["Bloomberg", "bloomberg"],
    ["Macintosh", "macintosh"],
    ["DOS", "dos"],
    ["TeleType", "teletype"],
    ["VOID", "void"]
  ])("resolves case-insensitive key %s to %s", (raw, expected) => {
    expect(resolveThemeKey(raw)).toBe(expected);
  });

  it.each(Object.entries(THEME_ALIASES))("resolves alias %s to %s", (alias, expected) => {
    expect(resolveThemeKey(alias)).toBe(expected);
  });

  it("maps unknown input to matrix", () => {
    expect(resolveThemeKey("nonsense-theme")).toBe("matrix");
  });

  it.each([[null], [undefined], [""]])("maps %s to matrix", (raw) => {
    expect(resolveThemeKey(raw as string | null)).toBe("matrix");
  });

  it("resolves case-insensitive aliases", () => {
    expect(resolveThemeKey("GRUVBOX")).toBe("bloomberg");
    expect(resolveThemeKey("TokyoNight")).toBe("void");
  });
});

describe("isKnownThemeInput", () => {
  it("returns true for every THEME_ORDER key", () => {
    for (const k of THEME_ORDER) expect(isKnownThemeInput(k)).toBe(true);
  });

  it("returns true for every alias", () => {
    for (const k of Object.keys(THEME_ALIASES)) expect(isKnownThemeInput(k)).toBe(true);
  });

  it("returns false for unknown input", () => {
    expect(isKnownThemeInput("definitely-not-a-theme")).toBe(false);
  });
});

describe("THEME_ORDER", () => {
  it("has 8 themes matching the THEMES map keys", () => {
    expect(THEME_ORDER).toHaveLength(8);
    expect(THEME_ORDER.every((k) => k in THEMES)).toBe(true);
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_ORDER].sort());
  });

  it("defines warn/muted/phosphor/headerStyle on every theme", () => {
    for (const mode of THEME_ORDER) {
      const t = THEMES[mode];
      expect(t.warn).toBeTypeOf("string");
      expect(t.muted).toBeTypeOf("string");
      expect(t.phosphor).toBeTypeOf("string");
      expect(t.headerStyle).toBeTypeOf("string");
    }
  });
});

describe("DEX_REGISTRY[8453] (locks #7)", () => {
  const base = DEX_REGISTRY[8453];
  const univ3 = base?.find((d) => d.type === "V3");

  it("has a Uniswap V3 entry on Base", () => {
    expect(univ3).toBeDefined();
  });

  it("uses the correct V3 factory with bytecode", () => {
    expect(univ3?.factory).toBe("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
  });

  it("uses the correct V3 router", () => {
    expect(univ3?.router).toBe("0x2626664c2603336E57B271c5C0b26F421741e481");
  });

  it("uses the correct nonfungible position manager", () => {
    expect(univ3?.positionManager).toBe("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1");
  });
});

describe("COMMON_TOKENS[8453].USDC (locks #10)", () => {
  const usdc = COMMON_TOKENS[8453]?.USDC;

  it("is the native Circle USDC, not bridged USDbC", () => {
    expect(usdc?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(usdc?.address).not.toBe("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA");
  });

  it("has 6 decimals", () => {
    expect(usdc?.decimals).toBe(6);
  });
});

describe("resolveChain", () => {
  it("resolves known aliases", () => {
    expect(resolveChain("base")?.id).toBe(8453);
    expect(resolveChain("base mainnet")?.id).toBe(8453);
    expect(resolveChain("eth")?.id).toBe(1);
    expect(resolveChain("sepolia")?.id).toBe(11155111);
    expect(resolveChain("arb")?.id).toBe(42161);
    expect(resolveChain("op")?.id).toBe(10);
  });

  it("returns undefined for unknown input", () => {
    expect(resolveChain("nope")).toBeUndefined();
    expect(resolveChain("")).toBeUndefined();
    expect(resolveChain(undefined)).toBeUndefined();
  });
});
