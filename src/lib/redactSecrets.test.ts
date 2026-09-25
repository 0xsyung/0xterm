/**
 * @file redactSecrets.test.ts
 * @description Client-side secret redactor (#19). Synthetic strings only — never a live key.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  redactSecrets,
  requireFeedbackConfirm,
  type SecretKind
} from "./redactSecrets";

describe("redactSecrets", () => {
  it("redacts ghp_ GitHub tokens", () => {
    const r = redactSecrets("token ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA rest");
    expect(r.text).toContain("[redacted:github_token]");
    expect(r.text).not.toContain("ghp_");
    expect(r.hits).toContain("github_token");
  });

  it("redacts github_pat_ tokens", () => {
    const r = redactSecrets("github_pat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(r.text).toBe("[redacted:github_token]");
    expect(r.hits).toContain("github_token");
  });

  it("redacts a 64-hex private key with and without 0x", () => {
    const hex = "ab".repeat(32);
    expect(redactSecrets(hex).text).toBe("[redacted:privkey]");
    expect(redactSecrets(`0x${hex}`).text).toBe("[redacted:privkey]");
    expect(redactSecrets(hex).hits).toContain("privkey");
  });

  it("does not redact a 40-hex address", () => {
    const addr = "0x1111111111111111111111111111111111111111";
    const r = redactSecrets(`the bug is at ${addr}`);
    expect(r.text).toContain(addr);
    expect(r.hits).not.toContain("privkey");
    expect(r.hits).toHaveLength(0);
  });

  it("redacts a 12-word BIP-39 seed", () => {
    const seed = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const r = redactSecrets(seed);
    expect(r.text).toBe("[redacted:seed]");
    expect(r.hits).toContain("seed");
  });

  it("redacts a 24-word BIP-39 seed", () => {
    const seed =
      "abandon ability able about above absent absorb abstract absurd abuse access accident " +
      "account accuse achieve acid acoustic acquire across act action actor actress actual";
    const r = redactSecrets(seed);
    expect(r.text).toBe("[redacted:seed]");
  });

  it("does not flag 11 words that are not a seed", () => {
    const words = Array.from({ length: 11 }, () => "notaword").join(" ");
    const r = redactSecrets(words);
    expect(r.hits).not.toContain("seed");
    expect(r.text).toBe(words);
  });

  it("flags a run of 12 real words but leaves surrounding text intact", () => {
    const r = redactSecrets("my seed is abandon ability able about above absent absorb abstract absurd abuse access accident and more");
    expect(r.text).toContain("[redacted:seed]");
    expect(r.text).toContain("my seed is");
    expect(r.text).toContain("and more");
  });

  it("redacts vault JSON by whole object", () => {
    const vault = JSON.stringify({
      ciphertextB64: "AAAA",
      version: 1
    });
    const r = redactSecrets(`vault: ${vault}`);
    expect(r.text).toBe("vault: [redacted:vault_json]");
    expect(r.hits).toContain("vault_json");
  });

  it("redacts an Alchemy RPC URL path", () => {
    const r = redactSecrets("https://eth-mainnet.g.alchemy.com/v2/abcdef1234567890");
    expect(r.text).toContain("[redacted:rpc_key]");
    expect(r.text).not.toContain("abcdef1234567890");
    expect(r.hits).toContain("rpc_key");
  });

  it("redacts an Infura RPC URL path", () => {
    const r = redactSecrets("https://mainnet.infura.io/v3/abcdef1234567890");
    expect(r.text).toContain("[redacted:rpc_key]");
    expect(r.hits).toContain("rpc_key");
  });

  it("redacts a JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const r = redactSecrets(jwt);
    expect(r.text).toBe("[redacted:jwt]");
    expect(r.hits).toContain("jwt");
  });

  it("redacts a 128+ hex blob whole (not piecemeal by privkey)", () => {
    const blob = "ff".repeat(64); // 128 hex chars
    const r = redactSecrets(`0x${blob}`);
    expect(r.text).toBe("[redacted:hex_blob]");
    expect(r.hits).toContain("hex_blob");
    expect(r.hits).not.toContain("privkey");
  });

  it("keeps a plain sentence untouched", () => {
    const s = "the price command dumped a stack on base";
    const r = redactSecrets(s);
    expect(r.text).toBe(s);
    expect(r.hits).toHaveLength(0);
  });
});

describe("requireFeedbackConfirm", () => {
  it("requires confirm for high-confidence kinds", () => {
    expect(requireFeedbackConfirm(["seed" as SecretKind])).toBe(true);
    expect(requireFeedbackConfirm(["privkey" as SecretKind])).toBe(true);
    expect(requireFeedbackConfirm(["github_token" as SecretKind])).toBe(true);
    expect(requireFeedbackConfirm(["vault_json" as SecretKind])).toBe(true);
    expect(requireFeedbackConfirm(["rpc_key" as SecretKind])).toBe(true);
  });

  it("does not require confirm for low-confidence kinds or nothing", () => {
    expect(requireFeedbackConfirm(["jwt" as SecretKind])).toBe(false);
    expect(requireFeedbackConfirm(["hex_blob" as SecretKind])).toBe(false);
    expect(requireFeedbackConfirm([])).toBe(false);
  });
});
