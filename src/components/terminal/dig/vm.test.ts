/**
 * @file vm.test.ts
 * @description VM deploy + call Counter happy path (#40)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { encodeFunctionData, decodeFunctionResult } from "viem";
import {
  digVmHardforkLabel,
  digVmTestAccount,
  resetDigVm,
  vmCall,
  vmDeploy
} from "./vm";
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

  it("captureTrace on deploy records steps", async () => {
    const dep = await vmDeploy(fixture.creation, 0n, { captureTrace: true });
    expect(dep.ok).toBe(true);
    if (!dep.ok) return;
    expect(dep.trace && dep.trace.length).toBeGreaterThan(5);
  });

  it("returns a revert when calling an invalid selector", async () => {
    const dep = await vmDeploy(fixture.creation);
    expect(dep.ok).toBe(true);
    if (!dep.ok) return;
    // Empty calldata to a contract with no fallback reverts.
    const s = await vmCall({ to: dep.createdAddress!, data: "0x" });
    expect(s.ok).toBe(false);
    expect("reason" in s && s.reason.length).toBeGreaterThan(0);
  });

  it("returns reason when deploy data cannot produce a contract", async () => {
    const s = await vmDeploy("0x1234" as `0x${string}`);
    expect(s.ok).toBe(false);
    expect("reason" in s && s.reason.length).toBeGreaterThan(0);
  });

  it("creates a fresh address when runtime is empty", async () => {
    const s = await vmDeploy("0x00" as `0x${string}`, 5n);
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.createdAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("reports the pinned hardfork and test account", () => {
    expect(digVmHardforkLabel()).toBe("cancun");
    expect(digVmTestAccount()).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
