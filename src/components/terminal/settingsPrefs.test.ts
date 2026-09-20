/**
 * @file settingsPrefs.test.ts
 * @description Unit tests for Settings mask / import / export helpers (#81)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  applyImportBlob,
  buildExportBlob,
  maskSecret,
  parseImportJson,
  truncateMid
} from "./settingsPrefs";

describe("maskSecret", () => {
  it("masks by default and keeps last 4", () => {
    expect(maskSecret("https://eth.alchemy.com/v2/abcdEFGH1234")).toBe(
      "••••••••1234"
    );
  });

  it("reveals when asked", () => {
    expect(maskSecret("secret-key", { reveal: true })).toBe("secret-key");
  });

  it("handles short values", () => {
    expect(maskSecret("ab")).toBe("••••••••");
    expect(maskSecret("")).toBe("");
  });
});

describe("truncateMid", () => {
  it("mid-truncates long addresses", () => {
    expect(truncateMid("0x1234567890abcdef", 4, 4)).toBe("0x12…cdef");
  });
});

describe("parseImportJson", () => {
  it("rejects invalid JSON without throwing", () => {
    const r = parseImportJson("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/);
  });

  it("rejects empty / wrong shape", () => {
    expect(parseImportJson("").ok).toBe(false);
    expect(parseImportJson("[]").ok).toBe(false);
    expect(parseImportJson("{}").ok).toBe(false);
  });

  it("accepts export-shaped blob", () => {
    const r = parseImportJson(
      JSON.stringify({ version: "1.0", preferences: { theme: "matrix" } })
    );
    expect(r.ok).toBe(true);
  });
});

describe("buildExportBlob + applyImportBlob", () => {
  it("round-trips theme, mode, rpc, tokens, channels", () => {
    const blob = buildExportBlob({
      wallet: "0xabc",
      theme: "bloomberg",
      mode: "dev",
      rpcProviders: { 1: { alchemy: "https://eth.alchemy.com/v2/KEY1234" } },
      activeRpcProviders: { 1: "alchemy" },
      customTokens: {
        1: [
          {
            id: "c_0xtoken",
            address: "0x0000000000000000000000000000000000000001" as `0x${string}`,
            symbol: "FOO",
            name: "Foo",
            decimals: 18,
            tokenType: "erc20",
            isNative: false
          }
        ]
      },
      pinned: [],
      channelStore: { channels: [], activeId: null }
    });
    expect(blob.preferences.theme).toBe("bloomberg");
    expect(blob.preferences.mode).toBe("dev");
    expect((blob.customTokens as any)?.[1]?.[0]?.symbol).toBe("FOO");

    const parsed = parseImportJson(JSON.stringify(blob));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const patch = applyImportBlob(parsed.data, { channels: [], activeId: null });
    expect(patch.theme).toBe("bloomberg");
    expect(patch.mode).toBe("dev");
    expect(patch.rpcProviders?.[1]?.alchemy).toContain("KEY1234");
    expect(patch.customTokens?.[1]?.[0]?.symbol).toBe("FOO");
  });

  it("invalid mode in preferences is ignored", () => {
    const patch = applyImportBlob(
      {
        version: "1.0",
        preferences: { mode: "nope", theme: "amber" }
      },
      { channels: [], activeId: null }
    );
    expect(patch.mode).toBeUndefined();
    expect(patch.theme).toBe("amber");
  });
});
