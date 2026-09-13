/**
 * @file gas.test.ts
 * @description Dig gas formatting (#40)
 */
import { describe, expect, it } from "vitest";
import { formatGas, formatGasEstimateLine, formatGasWeiSuffix } from "./gas";

describe("formatGas", () => {
  it("prints decimal string", () => {
    expect(formatGas(21000n)).toBe("21000");
    expect(formatGas(0)).toBe("0");
  });
});

describe("formatGasEstimateLine", () => {
  it("matches Stephy one-liner", () => {
    expect(formatGasEstimateLine("increment", 42123n)).toBe(
      "[✓] ESTIMATE increment  42123"
    );
  });
});

describe("formatGasWeiSuffix", () => {
  it("returns muted wei when price known", () => {
    expect(formatGasWeiSuffix(2n, 3n)).toBe("· 6 wei");
    expect(formatGasWeiSuffix(2n, null)).toBeNull();
  });
});
