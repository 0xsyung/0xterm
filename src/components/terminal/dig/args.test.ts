/**
 * @file args.test.ts
 * @description Dig CLI arg tokenizer / parser (#40)
 */
import { describe, expect, it } from "vitest";
import {
  extractCallArgs,
  extractDeployArgs,
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

  it("handles quoted strings and empty input", () => {
    expect(tokenizeDigArgs(['"it\'s"'])).toEqual(["it's"]);
    expect(tokenizeDigArgs([])).toEqual([]);
    expect(tokenizeDigArgs(["  "])).toEqual([]);
  });

  it("resolves backslash escapes inside quotes", () => {
    expect(tokenizeDigArgs(['"a\\"b"'])).toEqual(['a"b']);
  });

  it("returns null on unbalanced brackets", () => {
    expect(tokenizeDigArgs(["[1,2" ])).toBeNull();
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

  it("parses empty arrays and nested arrays", () => {
    expect(parseDigValue("[]")).toEqual([]);
    expect(parseDigValue("[[1],[2,3]]")).toEqual([[1n], [2n, 3n]]);
  });

  it("parses negatives, hex, and plain strings", () => {
    expect(parseDigValue("-5")).toBe(-5n);
    expect(parseDigValue("0xdeadbeef")).toBe("0xdeadbeef");
    expect(parseDigValue("hello")).toBe("hello");
    expect(parseDigValue("false")).toBe(false);
  });

  it("leaves a non-array token as a plain string", () => {
    expect(parseDigValue("[1,2")).toBe("[1,2");
  });
});

describe("extractCallArgs", () => {
  it("pulls --value", () => {
    const r = extractCallArgs(["dig", "send", "mint", "1", "--value", "100"]);
    expect(r.fn).toBe("mint");
    expect(r.args).toEqual(["1"]);
    expect(r.valueWei).toBe(100n);
  });

  it("pulls --value= form", () => {
    const r = extractCallArgs(["dig", "call", "set", "--value=50"]);
    expect(r.fn).toBe("set");
    expect(r.args).toEqual([]);
    expect(r.valueWei).toBe(50n);
  });

  it("errors on a non-numeric --value", () => {
    const r = extractCallArgs(["dig", "call", "set", "--value", "abc"]);
    expect(r.error).toBe("arg");
    const r2 = extractCallArgs(["dig", "call", "set", "--value="]);
    expect(r2.error).toBe("arg");
  });

  it("treats a missing fn as undefined", () => {
    const r = extractCallArgs(["dig"]);
    expect(r.fn).toBeUndefined();
    expect(r.args).toEqual([]);
  });
});

describe("extractDeployArgs", () => {
  it("splits contract name from ctor args", () => {
    const r = extractDeployArgs(["dig", "deploy", "Counter", "42"]);
    expect(r.contractArg).toBe("Counter");
    expect(r.ctorArgs).toEqual(["42"]);
    expect(r.valueWei).toBeUndefined();
  });

  it("handles --args and --value forms", () => {
    const r = extractDeployArgs(["dig", "deploy", "--args", "42", "--value", "7"]);
    expect(r.contractArg).toBeUndefined();
    expect(r.ctorArgs).toEqual(["42"]);
    expect(r.valueWei).toBe(7n);

    const r2 = extractDeployArgs(["dig", "deploy", "Counter", "--value=9"]);
    expect(r2.contractArg).toBe("Counter");
    expect(r2.ctorArgs).toEqual([]);
    expect(r2.valueWei).toBe(9n);
  });

  it("errors on bad --value", () => {
    const r = extractDeployArgs(["dig", "deploy", "--value", "x"]);
    expect(r.error).toBe("arg");
    const r2 = extractDeployArgs(["dig", "deploy", "--value=abc"]);
    expect(r2.error).toBe("arg");
  });

  it("treats a leading non-flag token as the contract name", () => {
    const r = extractDeployArgs(["dig", "deploy", '"oops']);
    expect(r.contractArg).toBe('"oops');
    expect(r.ctorArgs).toEqual([]);
  });
});
