/**
 * @file artifact.test.ts
 * @description Unit tests for dig artifact pin helpers (#39)
 */
import { describe, expect, it } from "vitest";
import {
  abiFunctionCount,
  abiFunctionNames,
  bytecodeByteLength,
  digArtifactPinKey,
  digArtifactPinTitle,
  formatCompileSummary,
  pickArtifact,
  summarizeCompile,
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

  it("lists function names", () => {
    expect(abiFunctionNames(sample.abi)).toEqual(["increment", "set"]);
  });

  it("summarizes a clean build", () => {
    const s = summarizeCompile("0.8.37", [sample], 0, 0);
    expect(s.solcVersion).toBe("0.8.37");
    expect(s.contractNames).toEqual(["Counter"]);
    expect(formatCompileSummary(s)).toContain("ok — dig bytecode");
  });

  it("formats errors and warnings", () => {
    const s = summarizeCompile("0.8.37", [], 2, 1);
    const out = formatCompileSummary(s);
    expect(out).toContain("errors: 2");
    expect(out).toContain("warnings: 1");
  });
});
