/**
 * @file encode.test.ts
 * @description Dig ABI encode/decode helpers (#40/#6)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import {
  checksumAddr,
  decodeDigLogs,
  decodeDigReturn,
  encodeDigCall,
  encodeDigDeploy,
  findAbiFunction,
  formatReturnValues,
  isViewLike,
  toViemAbi,
  truncateAddress,
  truncateHex
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

const richAbi: DigAbiItem[] = [
  {
    type: "function",
    name: "set",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "a" },
      { type: "int256", name: "b" },
      { type: "address", name: "c" },
      { type: "bool", name: "d" },
      { type: "string", name: "e" },
      { type: "bytes", name: "f" },
      { type: "uint256[]", name: "g" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "pureFn",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "bool", name: "" }]
  },
  {
    type: "event",
    name: "Incremented",
    inputs: [{ type: "uint256", name: "value", indexed: false }]
  }
];

const ADDR = "0x1234567890123456789012345678901234567890";

describe("toViemAbi / findAbiFunction / isViewLike", () => {
  it("casts abi and finds functions by name", () => {
    expect(Array.isArray(toViemAbi(counterAbi))).toBe(true);
    const fn = findAbiFunction(counterAbi, "set");
    expect(fn?.name).toBe("set");
    expect(findAbiFunction(counterAbi, "nope")).toBeNull();
  });

  it("isViewLike only for view/pure", () => {
    expect(isViewLike(findAbiFunction(counterAbi, "number")!)).toBe(true);
    expect(isViewLike(findAbiFunction(richAbi, "pureFn")!)).toBe(true);
    expect(isViewLike(findAbiFunction(counterAbi, "increment")!)).toBe(false);
  });
});

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

  it("coerces every scalar/array type from tokens", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: [
        "42",
        "-5",
        ADDR,
        "true",
        "hello",
        "0xdeadbeef",
        "[1,2,3]"
      ]
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a bad address token", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: ["1", "2", "not-an-address", "true", "x", "0x", "[]"]
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });

  it("rejects a non-boolean bool token", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: ["1", "2", ADDR, "1", "x", "0x", "[]"]
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });

  it("rejects a non-integer int token", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: ["1", "abc", ADDR, "true", "x", "0x", "[]"]
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });

  it("rejects a non-hex bytes token", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: ["1", "2", ADDR, "true", "x", "zzz", "[]"]
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });

  it("rejects a bad array inner token", () => {
    const r = encodeDigCall({
      abi: richAbi,
      functionName: "set",
      argTokens: ["1", "2", ADDR, "true", "x", "0x", "[abc]"]
    });
    expect(r).toEqual({ ok: false, code: "arg" });
  });
});

describe("encodeDigDeploy", () => {
  const bytecode = "0x608060405234801561001057600080fd5b50" as `0x${string}`;

  it("encodes a constructor call with args", () => {
    const deployAbi: DigAbiItem[] = [
      { type: "constructor", inputs: [{ type: "address", name: "owner" }] }
    ];
    const r = encodeDigDeploy({
      abi: deployAbi,
      bytecode,
      argTokens: [ADDR]
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.startsWith("0x")).toBe(true);
  });

  it("encodes with an empty constructor and no tokens", () => {
    const deployAbi: DigAbiItem[] = [{ type: "constructor", inputs: [] }];
    const r = encodeDigDeploy({ abi: deployAbi, bytecode, argTokens: [] });
    expect(r.ok).toBe(true);
  });

  it("refuses tokens when there is no constructor", () => {
    const r = encodeDigDeploy({ abi: [], bytecode, argTokens: [ADDR] });
    expect(r).toEqual({ ok: false, code: "arg" });
  });

  it("refuses an arity mismatch", () => {
    const deployAbi: DigAbiItem[] = [
      { type: "constructor", inputs: [{ type: "address", name: "owner" }] }
    ];
    const r = encodeDigDeploy({ abi: deployAbi, bytecode, argTokens: [] });
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

  it("returns raw on undecodable data", () => {
    const r = decodeDigReturn({
      abi: counterAbi,
      functionName: "number",
      data: "0xdeadbeef" as `0x${string}`
    });
    expect(r).toEqual({ ok: false, raw: "0xdeadbeef" });
  });
});

describe("decodeDigLogs", () => {
  it("decodes a matching event into name=value pairs", () => {
    const topics = encodeEventTopics({
      abi: toViemAbi(richAbi),
      eventName: "Incremented"
    }) as [`0x${string}`, ...`0x${string}`[]];
    const data = encodeAbiParameters([{ type: "uint256", name: "" }], [42n]);
    const out = decodeDigLogs(richAbi, [{ topics, data }]);
    expect(out[0]?.eventName).toBe("Incremented");
    expect(out[0]?.argsSummary).toBe("value=42");
  });

  it("falls back to a truncated topic0 on decode failure", () => {
    const out = decodeDigLogs(richAbi, [
      { topics: ["0xdeadbeef" as `0x${string}`], data: "0x" as `0x${string}` }
    ]);
    expect(out[0]?.eventName).toBe("log");
    expect(out[0]?.argsSummary).toBe("0xdeadbeef");
  });
});

describe("formatReturnValues", () => {
  it("formats scalars, arrays, objects, and fallbacks", () => {
    expect(formatReturnValues([1n])).toBe("1");
    expect(formatReturnValues([true])).toBe("true");
    expect(formatReturnValues([ADDR])).toBe("0x1234…7890");
    expect(formatReturnValues(["hello"])).toBe("hello");
    expect(formatReturnValues([[1n, 2n]])).toBe("[1, 2]");
    expect(formatReturnValues([{ a: 1n }])).toBe('{"a":"1"}');
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(formatReturnValues([circ])).toBe("[object Object]");
  });
});

describe("truncateAddress / truncateHex / checksumAddr", () => {
  it("checksum-truncates", () => {
    const t = truncateAddress(ADDR);
    expect(t).toMatch(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/);
  });

  it("passes short invalid addresses through", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });

  it("truncates long hex and keeps short hex", () => {
    expect(truncateHex("0x1234567890abcdef")).toBe("0x123456…cdef");
    expect(truncateHex("0x1234")).toBe("0x1234");
  });

  it("checksums a valid address", () => {
    expect(checksumAddr(ADDR)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
