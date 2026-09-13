/**
 * @file vm.test.ts
 * @description VM deploy + call Counter happy path (#40)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { encodeFunctionData, decodeFunctionResult } from "viem";
import { resetDigVm, vmCall, vmDeploy } from "./vm";
import type { DigAbiItem } from "./artifact";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(dir, "fixtures/counter.json"), "utf8")
) as {
  creation: `0x${string}`;
  abi: DigAbiItem[];
};

describe("dig vm Counter", () => {
  beforeEach(async () => {
    await resetDigVm();
  });

  it("deploy → increment → number returns 1", async () => {
    const dep = await vmDeploy(fixture.creation);
    expect(dep.ok).toBe(true);
    if (!dep.ok) return;
    expect(dep.createdAddress).toBeTruthy();

    const inc = encodeFunctionData({
      abi: fixture.abi as any,
      functionName: "increment"
    });
    const s1 = await vmCall({ to: dep.createdAddress!, data: inc });
    expect(s1.ok).toBe(true);

    const num = encodeFunctionData({
      abi: fixture.abi as any,
      functionName: "number"
    });
    const s2 = await vmCall({ to: dep.createdAddress!, data: num });
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    const decoded = decodeFunctionResult({
      abi: fixture.abi as any,
      functionName: "number",
      data: s2.returnData
    });
    expect(decoded).toBe(1n);
    expect(s1.ok && s1.gasUsed > 0n).toBe(true);
  });

  it("captureTrace records structLog-style steps on send", async () => {
    const dep = await vmDeploy(fixture.creation);
    expect(dep.ok).toBe(true);
    if (!dep.ok) return;
    const inc = encodeFunctionData({
      abi: fixture.abi as any,
      functionName: "increment"
    });
    const s1 = await vmCall({
      to: dep.createdAddress!,
      data: inc,
      captureTrace: true
    });
    expect(s1.ok).toBe(true);
    expect(s1.trace && s1.trace.length).toBeGreaterThan(10);
    expect(s1.trace![0]!.op).toBeTruthy();
    expect(s1.trace![0]!.pc).toBe(0);
  });
});
