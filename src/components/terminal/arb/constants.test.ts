/**
 * @file constants.test.ts
 * @description arb constants unit tests (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { ARB_ERROR, ARB_EXECUTOR } from "./constants";

describe("ARB_EXECUTOR", () => {
  it("wires the sepolia deployment and nothing else", () => {
    expect(Object.keys(ARB_EXECUTOR)).toEqual(["11155111"]);
    expect(ARB_EXECUTOR[11155111]).toMatch(/^0x/);
  });
});

describe("ARB_ERROR", () => {
  it("exposes function and string entries", () => {
    expect(typeof ARB_ERROR.unsupported).toBe("function");
    expect(typeof ARB_ERROR.bad_rpc).toBe("function");
    expect(typeof ARB_ERROR.no_executor).toBe("function");
    expect(typeof ARB_ERROR.gone).toBe("string");
    expect(typeof ARB_ERROR.gas_unknown).toBe("string");
  });
});
