/**
 * @file session.test.ts
 * @description Dig run + debug session state — set/get/add round-trips (#6)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  addDigDeployment,
  envLabel,
  getActiveDigDeployment,
  getDigDebugSession,
  getDigEnv,
  getLastDigDebugTarget,
  getLastDigPanel,
  getLastDigReceipt,
  listDigDeployments,
  resetDigSession,
  setActiveDigDeployment,
  setDigDebugSession,
  setDigEnv,
  setLastDigDebugTarget,
  setLastDigPanel,
  setLastDigReceipt
} from "./session";
import type { DigDeployment } from "./session";

const DEPLOY: DigDeployment = {
  name: "Counter",
  address: "0x1234567890123456789012345678901234567890",
  env: "vm",
  abi: []
};

describe("dig session", () => {
  beforeEach(() => {
    resetDigSession();
  });

  it("starts in vm env with no deployments", () => {
    expect(getDigEnv()).toBe("vm");
    expect(listDigDeployments()).toEqual([]);
    expect(getActiveDigDeployment()).toBeUndefined();
  });

  it("env get/set", () => {
    setDigEnv("injected");
    expect(getDigEnv()).toBe("injected");
  });

  it("adds, dedupes by address, and activates deployments", () => {
    addDigDeployment(DEPLOY);
    expect(listDigDeployments()).toHaveLength(1);
    expect(getActiveDigDeployment()?.name).toBe("Counter");

    const newer = { ...DEPLOY, name: "Counter2" };
    addDigDeployment(newer);
    expect(listDigDeployments()).toHaveLength(1);
    expect(listDigDeployments()[0]?.name).toBe("Counter2");
    expect(getActiveDigDeployment()?.name).toBe("Counter2");
  });

  it("active deployment get/set incl. clearing", () => {
    setActiveDigDeployment(DEPLOY);
    expect(getActiveDigDeployment()?.address).toBe(DEPLOY.address);
    setActiveDigDeployment(undefined);
    expect(getActiveDigDeployment()).toBeUndefined();
  });

  it("receipt round-trip", () => {
    const r = { status: "success" as const, gasUsed: 21000n, logs: [] };
    expect(getLastDigReceipt()).toBeUndefined();
    setLastDigReceipt(r);
    expect(getLastDigReceipt()).toEqual(r);
    setLastDigReceipt(undefined);
    expect(getLastDigReceipt()).toBeUndefined();
  });

  it("panel round-trip", () => {
    const p = {
      name: "Counter",
      address: DEPLOY.address,
      env: "vm" as const,
      events: [],
      gasLabel: "ESTIMATE" as const,
      gas: "123"
    };
    expect(getLastDigPanel()).toBeUndefined();
    setLastDigPanel(p);
    expect(getLastDigPanel()?.gas).toBe("123");
    setLastDigPanel(undefined);
    expect(getLastDigPanel()).toBeUndefined();
  });

  it("debug target round-trip", () => {
    const t = {
      kind: "send" as const,
      steps: [],
      truncated: false,
      status: "OK" as const
    };
    expect(getLastDigDebugTarget()).toBeUndefined();
    setLastDigDebugTarget(t);
    expect(getLastDigDebugTarget()?.kind).toBe("send");
    setLastDigDebugTarget(undefined);
    expect(getLastDigDebugTarget()).toBeUndefined();
  });

  it("debug session round-trip", () => {
    const s = { steps: [], truncated: false };
    expect(getDigDebugSession()).toBeUndefined();
    setDigDebugSession(s as never);
    expect(getDigDebugSession()).toEqual(s);
    setDigDebugSession(undefined);
    expect(getDigDebugSession()).toBeUndefined();
  });

  it("envLabel renders each env variant", () => {
    expect(envLabel("vm")).toBe("VM · not a live chain");
    expect(envLabel("injected")).toBe("INJECTED");
    expect(envLabel("injected", "Ethereum")).toBe("INJECTED · Ethereum");
    expect(envLabel("local")).toBe("LOCAL");
    expect(envLabel("local", "Anvil")).toBe("LOCAL · Anvil");
  });

  it("fresh session object on reset loses prior state", () => {
    setDigEnv("injected");
    addDigDeployment(DEPLOY);
    resetDigSession();
    expect(getDigEnv()).toBe("vm");
    expect(listDigDeployments()).toEqual([]);
  });
});
