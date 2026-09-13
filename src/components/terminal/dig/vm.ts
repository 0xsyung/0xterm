/**
 * @file vm.ts
 * @description In-browser EVM via @ethereumjs/vm — Cancun pin (#40)
 * Session-only state. Honest copy: not a live chain. Never touches real keys.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { createVM, type VM } from "@ethereumjs/vm";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import {
  createAccount,
  createAddressFromString,
  hexToBytes,
  bytesToHex
} from "@ethereumjs/util";
import {
  DIG_VM_HARDFORK,
  DIG_VM_TEST_ACCOUNT
} from "./constants";

export type DigVmCallResult = {
  ok: true;
  returnData: `0x${string}`;
  gasUsed: bigint;
  createdAddress?: `0x${string}`;
  logs: Array<{
    address: `0x${string}`;
    topics: `0x${string}`[];
    data: `0x${string}`;
  }>;
} | {
  ok: false;
  reason: string;
  gasUsed?: bigint;
};

type DigVmHandle = {
  vm: VM;
  account: ReturnType<typeof createAddressFromString>;
};

const g = globalThis as unknown as { __oxtermDigVm?: DigVmHandle };

function hardforkEnum(): Hardfork {
  // Pin Cancun (Shanghai+blobs era). DIG_VM_HARDFORK documents the choice.
  void DIG_VM_HARDFORK;
  return Hardfork.Cancun;
}

async function ensureVm(): Promise<DigVmHandle> {
  if (g.__oxtermDigVm) return g.__oxtermDigVm;
  const common = new Common({ chain: Mainnet, hardfork: hardforkEnum() });
  const vm = await createVM({ common });
  const account = createAddressFromString(DIG_VM_TEST_ACCOUNT);
  await vm.stateManager.putAccount(
    account,
    createAccount({ balance: 10n ** 24n, nonce: 0n })
  );
  g.__oxtermDigVm = { vm, account };
  return g.__oxtermDigVm;
}

/** Reset VM (tests / session clear). */
export async function resetDigVm(): Promise<void> {
  g.__oxtermDigVm = undefined;
}

export function digVmHardforkLabel(): string {
  return DIG_VM_HARDFORK;
}

export function digVmTestAccount(): `0x${string}` {
  return DIG_VM_TEST_ACCOUNT;
}

function mapLogs(execResult: {
  logs?: Array<[Uint8Array, Uint8Array[], Uint8Array]>;
}): DigVmCallResult extends { ok: true } ? DigVmCallResult["logs"] : never {
  const logs = execResult.logs || [];
  return logs.map((l) => ({
    address: bytesToHex(l[0]) as `0x${string}`,
    topics: l[1].map((t) => bytesToHex(t) as `0x${string}`),
    data: bytesToHex(l[2]) as `0x${string}`
  })) as never;
}

function failReason(err: unknown): string {
  if (!err) return "execution failed";
  if (typeof err === "string") return err.split("\n")[0]!.slice(0, 120);
  const e = err as { error?: string; message?: string };
  const msg = e.error || e.message || String(err);
  return String(msg).split("\n")[0]!.slice(0, 120);
}

export async function vmDeploy(
  creationBytecode: `0x${string}`,
  value: bigint = 0n
): Promise<DigVmCallResult> {
  try {
    const { vm, account } = await ensureVm();
    const data = hexToBytes(creationBytecode);
    const res = await vm.evm.runCall({
      caller: account,
      data,
      value,
      gasLimit: 30_000_000n
    });
    const gasUsed = res.execResult.executionGasUsed;
    if (res.execResult.exceptionError) {
      return {
        ok: false,
        reason: failReason(res.execResult.exceptionError),
        gasUsed
      };
    }
    const created = res.createdAddress;
    if (!created) {
      return { ok: false, reason: "no contract address", gasUsed };
    }
    return {
      ok: true,
      returnData: bytesToHex(res.execResult.returnValue) as `0x${string}`,
      gasUsed,
      createdAddress: created.toString() as `0x${string}`,
      logs: mapLogs(res.execResult)
    };
  } catch (e) {
    return { ok: false, reason: failReason(e) };
  }
}

export async function vmCall(opts: {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}): Promise<DigVmCallResult> {
  try {
    const { vm, account } = await ensureVm();
    const res = await vm.evm.runCall({
      caller: account,
      to: createAddressFromString(opts.to),
      data: hexToBytes(opts.data),
      value: opts.value ?? 0n,
      gasLimit: 30_000_000n
    });
    const gasUsed = res.execResult.executionGasUsed;
    if (res.execResult.exceptionError) {
      return {
        ok: false,
        reason: failReason(res.execResult.exceptionError),
        gasUsed
      };
    }
    return {
      ok: true,
      returnData: bytesToHex(res.execResult.returnValue) as `0x${string}`,
      gasUsed,
      logs: mapLogs(res.execResult)
    };
  } catch (e) {
    return { ok: false, reason: failReason(e) };
  }
}
