/**
 * @file artifact.test.ts
 * @description Unit tests for dig artifact pin helpers (#39)
 */
import { describe, expect, it } from "vitest";
import {
  abiFunctionCount,
  bytecodeByteLength,
  digArtifactPinKey,
  digArtifactPinTitle,
  pickArtifact,
  type DigContractArtifact
} from "./artifact";

const sample: DigContractArtifact = {
  name: "Counter",
  solcVersion: "0.8.37",
  creationBytecode: "0x6080604052",
  runtimeBytecode: "0x6080604052600055",
  opcodes: "PUSH1 0x80 PUSH1 0x40 MSTORE",
  abi: [
    { type: "function", name: "increment", inputs: [], outputs: [] },
    { type: "function", name: "set", inputs: [], outputs: [] },
    { type: "constructor", inputs: [] }
  ]
};

describe("dig artifact helpers", () => {
  it("counts bytecode bytes and fns", () => {
    expect(bytecodeByteLength("0x6080604052")).toBe(5);
    expect(abiFunctionCount(sample.abi)).toBe(2);
  });

  it("builds compact pin title and key", () => {
    expect(digArtifactPinTitle(sample)).toMatch(/^Counter · \d+B · 2 fn$/);
    expect(digArtifactPinKey(sample)).toBe("dig-artifact:Counter:0.8.37");
  });

  it("picks contract by name", () => {
    const b = { ...sample, name: "Other" };
    expect(pickArtifact([sample, b], "other")?.name).toBe("Other");
    expect(pickArtifact([sample, b], undefined)?.name).toBe("Counter");
    expect(pickArtifact([], "x")).toBeNull();
  });
});
