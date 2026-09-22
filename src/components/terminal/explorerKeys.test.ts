// @vitest-environment jsdom
/**
 * @file explorerKeys.test.ts
 * @description Unit tests for explorer API key persistence helpers (#105)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  EXPLORER_KEYS_PREF_KEY,
  asRpcShape,
  loadExplorerKeys,
  saveExplorerKeys
} from "./explorerKeys";

const WALLET = "0x1234567890123456789012345678901234567890";

beforeEach(() => {
  localStorage.clear();
});

describe("loadExplorerKeys", () => {
  it("returns an empty map when nothing is stored", () => {
    expect(loadExplorerKeys({})).toEqual({});
    expect(loadExplorerKeys(null)).toEqual({});
    expect(loadExplorerKeys()).toEqual({});
  });

  it("reads keys from the preferences bag", () => {
    const prefs = { [EXPLORER_KEYS_PREF_KEY]: { 8453: "KEY_A", 1: "KEY_B" } };
    expect(loadExplorerKeys(prefs)).toEqual({ 8453: "KEY_A", 1: "KEY_B" });
  });

  it("drops malformed entries", () => {
    const prefs = {
      [EXPLORER_KEYS_PREF_KEY]: { 8453: "KEY_A", 1: "", bad: "nope" }
    };
    expect(loadExplorerKeys(prefs)).toEqual({ 8453: "KEY_A" });
  });
});

describe("saveExplorerKeys", () => {
  it("writes into the wallet prefs blob, preserving other fields", () => {
    const prefKey = `0xterm_user_${WALLET.toLowerCase()}`;
    localStorage.setItem(prefKey, JSON.stringify({ theme: "matrix" }));
    saveExplorerKeys({ 8453: "KEY_A" }, WALLET);
    const stored = JSON.parse(localStorage.getItem(prefKey)!);
    expect(stored.theme).toBe("matrix");
    expect(stored[EXPLORER_KEYS_PREF_KEY]).toEqual({ 8453: "KEY_A" });
  });
});

describe("asRpcShape", () => {
  it("maps chainId keys to the rpc provider shape", () => {
    expect(asRpcShape({ 8453: "KEY_A" })).toEqual({
      8453: { default: "KEY_A" }
    });
  });
});
