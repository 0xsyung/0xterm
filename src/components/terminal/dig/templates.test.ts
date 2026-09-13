/**
 * @file templates.test.ts
 * @description Counter template matches default solc pin (#39)
 */
import { describe, expect, it } from "vitest";
import { DIG_DEFAULT_SOLC_VERSION } from "./constants";
import { counterTemplate } from "./templates";

describe("counterTemplate", () => {
  it("emits SPDX + pragma matching default solc", () => {
    const t = counterTemplate();
    expect(t.filename).toBe("Counter.sol");
    expect(t.content).toContain("SPDX-License-Identifier: MIT");
    expect(t.content).toContain(`pragma solidity ^${DIG_DEFAULT_SOLC_VERSION}`);
    expect(t.content).toContain("function increment");
  });

  it("sanitizes invalid names", () => {
    expect(counterTemplate("123Bad").filename).toBe("Counter.sol");
    expect(counterTemplate("MyToken").filename).toBe("MyToken.sol");
  });
});
