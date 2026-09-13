/**
 * @file encode.test.ts
 * @description Dig ABI encode/decode helpers (#40)
 */
import { describe, expect, it } from "vitest";
import {
  decodeDigReturn,
  encodeDigCall,
  formatReturnValues,
  truncateAddress
} from "./encode";
import type { DigAbiItem } from "./artifact";

const counterAbi: DigAbiItem[] = [
  {
    type: "function",
    name: "number",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }]
  },
  {
    type: "function",
    name: "increment",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "set",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256", name: "v" }],
    outputs: []
  }
];

describe("encodeDigCall", () => {
  it("encodes increment / set", () => {
    const a = encodeDigCall({
      abi: counterAbi,
      functionName: "increment",
      argTokens: []
    });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.data.startsWith("0xd09de08a")).toBe(true);

    const b = encodeDigCall({
      abi: counterAbi,
      functionName: "set",
      argTokens: ["7"]
    });
    expect(b.ok).toBe(true);

    const bad = encodeDigCall({
      abi: counterAbi,
      functionName: "nope",
      argTokens: []
    });
    expect(bad).toEqual({ ok: false, code: "bad_fn" });
  });

  it("refuses bad arity as arg", () => {
    const r = encodeDigCall({
      abi: counterAbi,
      functionName: "set",
      argTokens: []
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });
});

describe("decodeDigReturn", () => {
  it("decodes uint256", () => {
    const data =
      "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
    const r = decodeDigReturn({
      abi: counterAbi,
      functionName: "number",
      data
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(formatReturnValues(r.values)).toBe("1");
    }
  });
});

describe("truncateAddress", () => {
  it("checksum-truncates", () => {
    const t = truncateAddress("0x1234567890123456789012345678901234567890");
    expect(t).toMatch(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/);
  });
});
