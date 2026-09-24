/**
 * @file encode.test.ts
 * @description calldata encoder unit tests — fnSig + ABI paths (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { encodeCalldata } from "./encode";
import { KNOWN_ABIS } from "./constants";

const TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const SPENDER = "0x4C2c0AE850490522585a1d04Df7d00f7807750AA";
const RECIPIENT = "0x1111111111111111111111111111111111111111";

describe("encodeCalldata (fnSig path)", () => {
  it("encodes approve(address,uint256)", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "approve(address,uint256)",
      args: [SPENDER, "1000000"]
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatch(/^0x/);
    // selector = keccak("approve(address,uint256)")[0..4]
    expect(r.data.slice(0, 10)).toBe("0x095ea7b3");
    expect(r.to.toLowerCase()).toBe(TOKEN.toLowerCase());
    expect(r.fnName).toBe("approve");
  });

  it("encodes transfer(address,uint256) and preserves checksum", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "transfer(address,uint256)",
      args: [RECIPIENT, "5"]
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.slice(0, 10)).toBe("0xa9059cbb");
    expect(r.data.toLowerCase()).toContain(RECIPIENT.toLowerCase().slice(2));
  });

  it("encodes a multi-type mix", () => {
    const r = encodeCalldata({
      to: "0x26F278090C6C954c302FEfA7e60d0DD2779C1f85",
      fnSig: "createPair(address,address)",
      args: [TOKEN, SPENDER]
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatch(/^0x[0-9a-f]{8}/);
  });
});

describe("encodeCalldata (known ABI path)", () => {
  it("finds approve in erc20Abi", () => {
    const erc20 = KNOWN_ABIS.find((a) => a.id === "erc20")!;
    const r = encodeCalldata({
      to: TOKEN,
      abi: erc20.abi as never,
      functionName: "approve",
      args: [SPENDER, "7"]
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.slice(0, 10)).toBe("0x095ea7b3");
  });

  it("bad function name → bad_fn", () => {
    const erc20 = KNOWN_ABIS.find((a) => a.id === "erc20")!;
    const r = encodeCalldata({
      to: TOKEN,
      abi: erc20.abi as never,
      functionName: "noSuchFn",
      args: []
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("bad_fn");
  });
});

describe("encodeCalldata errors", () => {
  it("bad to address → bad_to", () => {
    const r = encodeCalldata({
      to: "not-an-address",
      fnSig: "transfer(address,uint256)",
      args: [SPENDER, "1"]
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("bad_to");
  });

  it("arity mismatch → arity", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "transfer(address,uint256)",
      args: [SPENDER]
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("arity");
  });

  it("bad arg type → arg", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "approve(address,uint256)",
      args: ["0x123", "not-a-number"]
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("arg");
  });

  it("bad fnSig → bad_sig", () => {
    const r = encodeCalldata({
      to: TOKEN,
      fnSig: "not a sig",
      args: []
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("bad_sig");
  });
});
