/**
 * @file errors.test.ts
 * @description arb error resolver unit tests (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { arbErrorText } from "./errors";

describe("arbErrorText", () => {
  it("returns the string entry for a literal code", () => {
    expect(arbErrorText("gone")).toContain("arb.gone");
  });

  it("passes the param to a function entry", () => {
    expect(arbErrorText("unsupported", "sepolia")).toContain("sepolia");
    expect(arbErrorText("bad_rpc", "https://rpc.invalid")).toContain(
      "https://rpc.invalid"
    );
    expect(arbErrorText("no_executor", "42161")).toContain("42161");
  });
});
