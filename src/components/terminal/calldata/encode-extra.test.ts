/**
 * @file encode-extra.test.ts
 * @description extra calldata encoder coverage — array/bytes/bool coercion (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { encodeCalldata } from "./encode";

const TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

describe("encodeCalldata coercion paths", () => {
  it("encodes an address[] arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
      args: ["1", "0", `[${TOKEN},0x2222222222222222222222222222222222222222]`, TOKEN, "100"],
    });
    expect(r.ok).toBe(true);
  });

  it("encodes a bool arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "setPaused(bool)",
      args: ["true"],
    });
    expect(r.ok).toBe(true);
  });

  it("encodes a bytes arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "setData(bytes)",
      args: ["0xdeadbeef"],
    });
    expect(r.ok).toBe(true);
  });

  it("encodes a string arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "setName(string)",
      args: ["hello"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects malformed bytes", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "setData(bytes)",
      args: ["not-hex"],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("arg");
  });

  it("rejects a non-bool for a bool arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "setPaused(bool)",
      args: ["not-a-bool"],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("arg");
  });

  it("rejects a non-array for an array arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
      args: ["1", "0", TOKEN, TOKEN, "100"],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("arg");
  });
});
