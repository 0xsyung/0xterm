/**
 * @file args.test.ts
 * @description Dig CLI arg tokenizer / parser (#40)
 */
import { describe, expect, it } from "vitest";
import {
  extractCallArgs,
  parseDigValue,
  tokenizeDigArgs
} from "./args";

describe("tokenizeDigArgs", () => {
  it("splits words and quoted strings", () => {
    expect(tokenizeDigArgs(["hello", '"a b"', "c"])).toEqual([
      "hello",
      "a b",
      "c"
    ]);
  });

  it("keeps [a,b] arrays intact", () => {
    expect(tokenizeDigArgs(["[1,2,3]", "x"])).toEqual(["[1,2,3]", "x"]);
  });

  it("returns null on unbalanced quotes", () => {
    expect(tokenizeDigArgs(['"oops'])).toBeNull();
  });
});

describe("parseDigValue", () => {
  it("parses address / int / bool / array", () => {
    expect(parseDigValue("0x1234567890123456789012345678901234567890")).toBe(
      "0x1234567890123456789012345678901234567890"
    );
    expect(parseDigValue("42")).toBe(42n);
    expect(parseDigValue("true")).toBe(true);
    expect(parseDigValue("[1,2]")).toEqual([1n, 2n]);
  });
});

describe("extractCallArgs", () => {
  it("pulls --value", () => {
    const r = extractCallArgs(["dig", "send", "mint", "1", "--value", "100"]);
    expect(r.fn).toBe("mint");
    expect(r.args).toEqual(["1"]);
    expect(r.valueWei).toBe(100n);
  });
});
