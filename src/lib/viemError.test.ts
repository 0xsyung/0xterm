/**
 * @file viemError.test.ts
 * @description Unit tests for Viem error formatting
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { formatViemError } from "./viemError";

describe("formatViemError", () => {
  it("returns a friendly message when the user rejects", () => {
    expect(formatViemError({ message: "User rejected the request" })).toBe(
      "Transaction rejected by user."
    );
  });

  it("returns insufficient funds message", () => {
    expect(formatViemError({ message: "insufficient funds for gas * price + value" })).toBe(
      "Insufficient native balance for transaction."
    );
  });

  it("returns slippage message", () => {
    expect(
      formatViemError({ message: "execution reverted: INSUFFICIENT_OUTPUT_AMOUNT" })
    ).toBe("Slippage tolerance exceeded.");
  });

  it("returns allowance message", () => {
    expect(
      formatViemError({ message: "execution reverted: ERC20: insufficient allowance" })
    ).toBe("Insufficient ERC20 allowance. Approve tokens first.");
  });

  it("returns network error message", () => {
    expect(formatViemError({ message: "Failed to fetch" })).toBe(
      "Network Error: Failed to fetch. If using on-chain data, your RPC node may be down. If using API, check your ad-blocker."
    );
  });

  it("collapses a multiline viem error to a single line with no docs URL or args dump", () => {
    const err = {
      shortMessage: undefined,
      message:
        "The contract function \"getPool\" reverted with the following reason:\n\nContractFunctionExecutionError\n\nDocs: https://viem.sh/docs/errors\nDetails: version=v2.55.10, method=eth_call, args: [\"0x...\",\"0x...\"]\nVersion: viem@2.55.10"
    };
    const out = formatViemError(err);
    expect(out).toContain("The contract function");
    expect(out).not.toContain("viem@");
    expect(out).not.toContain("docs");
    expect(out).not.toContain("args");
    expect(out.split("\n").length).toBe(1);
  });

  it("falls back to String(err) when there is no message", () => {
    expect(formatViemError(42)).toBe("ERROR: 42");
  });

  it("prefers shortMessage over message", () => {
    expect(formatViemError({ shortMessage: "User rejected", message: "other" })).toBe(
      "Transaction rejected by user."
    );
  });
});
