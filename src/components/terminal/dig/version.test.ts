/**
 * @file version.test.ts
 * @description Unit tests for dig solc version pick (#39)
 */
import { describe, expect, it } from "vitest";
import {
  defaultSolcVersion,
  isPinnedSolcVersion,
  normalizeSolcVersion,
  pickSolcVersion,
  solcUrlsFor
} from "./version";
import { DIG_DEFAULT_SOLC_VERSION } from "./constants";

describe("dig version pick", () => {
  it("defaults to pinned latest 0.8.x", () => {
    expect(defaultSolcVersion()).toBe(DIG_DEFAULT_SOLC_VERSION);
    expect(DIG_DEFAULT_SOLC_VERSION).toBe("0.8.37");
    expect(pickSolcVersion(undefined)).toEqual({
      ok: true,
      version: "0.8.37"
    });
  });

  it("accepts pinned versions", () => {
    expect(pickSolcVersion("0.8.28")).toEqual({ ok: true, version: "0.8.28" });
    expect(isPinnedSolcVersion("0.8.37")).toBe(true);
  });

  it("rejects unknown versions", () => {
    const r = pickSolcVersion("0.7.6");
    expect(r.ok).toBe(false);
    expect(normalizeSolcVersion("v0.8.37+commit.x")).toBe("0.8.37");
  });

  it("builds allowlisted CDN urls only", () => {
    const urls = solcUrlsFor("0.8.37");
    expect(urls.length).toBe(2);
    expect(urls[0]).toContain("binaries.soliditylang.org/wasm/");
    expect(urls[0]).toContain("soljson-v0.8.37+commit.f401782d.js");
    expect(urls[1]).toContain("jsdelivr");
    expect(solcUrlsFor("9.9.9")).toEqual([]);
  });
});
