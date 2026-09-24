/**
 * @file parse.test.ts
 * @description fnSig parser unit tests (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { isSolidityType, parseFnSig } from "./parse";

describe("parseFnSig", () => {
  it("parses transfer(address,uint256)", () => {
    const r = parseFnSig("transfer(address,uint256)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fn.name).toBe("transfer");
    expect(r.fn.inputs).toEqual([
      { name: "arg1", type: "address" },
      { name: "arg2", type: "uint256" }
    ]);
  });

  it("parses approve with spaces", () => {
    const r = parseFnSig("approve(address , uint256)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fn.inputs?.[1]).toEqual({ name: "arg2", type: "uint256" });
  });

  it("parses zero-arg function", () => {
    const r = parseFnSig("withdraw()");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fn.inputs).toEqual([]);
  });

  it("parses dynamic array arg", () => {
    const r = parseFnSig("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fn.inputs?.[2]).toEqual({ name: "arg3", type: "address[]" });
  });

  it("rejects malformed signature", () => {
    expect(parseFnSig("transfer address uint256").ok).toBe(false);
    expect(parseFnSig("transfer(address,uint256").ok).toBe(false);
    expect(parseFnSig("").ok).toBe(false);
  });

  it("rejects unsupported type", () => {
    expect(parseFnSig("foo(uint8,tuple)").ok).toBe(false);
    expect(parseFnSig("foo(uint256,function)").ok).toBe(false);
  });

  it("rejects tuple types in v1", () => {
    expect(parseFnSig("foo((uint256,address))").ok).toBe(false);
  });
});

describe("isSolidityType", () => {
  it("accepts elementary types", () => {
    expect(isSolidityType("uint256")).toBe(true);
    expect(isSolidityType("uint8")).toBe(true);
    expect(isSolidityType("int128")).toBe(true);
    expect(isSolidityType("address")).toBe(true);
    expect(isSolidityType("bool")).toBe(true);
    expect(isSolidityType("string")).toBe(true);
    expect(isSolidityType("bytes")).toBe(true);
    expect(isSolidityType("bytes32")).toBe(true);
  });

  it("accepts arrays", () => {
    expect(isSolidityType("address[]")).toBe(true);
    expect(isSolidityType("uint256[3]")).toBe(true);
    expect(isSolidityType("uint256[][]")).toBe(true);
  });

  it("rejects junk", () => {
    expect(isSolidityType("float")).toBe(false);
    expect(isSolidityType("uint")).toBe(true); // viem/ABI treats bare uint as uint256
    expect(isSolidityType("tuple")).toBe(false);
  });
});
