/**
 * @file session.ts
 * @description Dig run session state — env, deployments, last receipt (#40)
 * Session-only (memory). VM state lives in vm.ts and is also session-only.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address } from "viem";
import type { DigAbiItem, DigContractArtifact } from "./artifact";
import type { DigEnvKind } from "./constants";
import type { DigDecodedEvent } from "./encode";

export type DigDeployment = {
  name: string;
  address: Address;
  env: DigEnvKind;
  chainId?: number;
  chainName?: string;
  abi: DigAbiItem[];
  artifact?: DigContractArtifact;
};

export type DigReceiptSnapshot = {
  status: "success" | "reverted";
  gasUsed: bigint;
  contractAddress?: Address;
  logs: DigDecodedEvent[];
  txHash?: `0x${string}`;
  fn?: string;
  argsSummary?: string;
  returnSummary?: string;
};

export type DigRunPanelState = {
  name: string;
  address: Address;
  env: DigEnvKind;
  chainName?: string;
  lastFn?: string;
  argsSummary?: string;
  returnValues?: string;
  rawReturn?: string;
  events: DigDecodedEvent[];
  gasLabel: "ESTIMATE" | "GAS USED";
  gas: string;
  warnLine?: string;
};

type DigSession = {
  env: DigEnvKind;
  deployments: DigDeployment[];
  active?: DigDeployment;
  lastReceipt?: DigReceiptSnapshot;
  lastPanel?: DigRunPanelState;
};

const g = globalThis as unknown as { __oxtermDigSession?: DigSession };

function session(): DigSession {
  if (!g.__oxtermDigSession) {
    g.__oxtermDigSession = {
      env: "vm",
      deployments: []
    };
  }
  return g.__oxtermDigSession;
}

/** Test helper — reset session memory. */
export function resetDigSession(): void {
  g.__oxtermDigSession = { env: "vm", deployments: [] };
}

export function getDigEnv(): DigEnvKind {
  return session().env;
}

export function setDigEnv(env: DigEnvKind): void {
  session().env = env;
}

export function listDigDeployments(): DigDeployment[] {
  return [...session().deployments];
}

export function getActiveDigDeployment(): DigDeployment | undefined {
  return session().active;
}

export function setActiveDigDeployment(d: DigDeployment | undefined): void {
  session().active = d;
}

export function addDigDeployment(d: DigDeployment): void {
  const s = session();
  const idx = s.deployments.findIndex(
    (x) => x.address.toLowerCase() === d.address.toLowerCase()
  );
  if (idx >= 0) s.deployments[idx] = d;
  else s.deployments.push(d);
  s.active = d;
}

export function getLastDigReceipt(): DigReceiptSnapshot | undefined {
  return session().lastReceipt;
}

export function setLastDigReceipt(r: DigReceiptSnapshot | undefined): void {
  session().lastReceipt = r;
}

export function getLastDigPanel(): DigRunPanelState | undefined {
  return session().lastPanel;
}

export function setLastDigPanel(p: DigRunPanelState | undefined): void {
  session().lastPanel = p;
}

export function envLabel(env: DigEnvKind, chainName?: string): string {
  if (env === "vm") return "VM · not a live chain";
  if (env === "injected") return chainName ? `INJECTED · ${chainName}` : "INJECTED";
  return chainName ? `LOCAL · ${chainName}` : "LOCAL";
}

