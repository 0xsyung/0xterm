/**
 * @file sim.ts
 * @description arb sim — eth_call dry-run against the ArbExecutor (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain, PublicClient } from "viem";
import { encodeRunParams, type RunParamsArgs } from "./calldata";

export type ArbSimOutcome =
  | { ok: true }
  | { ok: false; code: "arb.gone" | "arb.bad_rpc" | "arb.no_executor"; reason: string };

/**
 * Dry-run the atomic arb with eth_call (no state change). The executor's
 * `NO_PROFIT` revert means the quoted spread is already gone.
 */
export async function arbSim(
  chain: Chain,
  executor: Address,
  params: RunParamsArgs,
  deps: { client: PublicClient }
): Promise<ArbSimOutcome> {
  try {
    const data = encodeRunParams(params);
    await deps.client.call({
      to: executor,
      data,
      account: "0x0000000000000000000000000000000000000000"
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { shortMessage?: unknown; message?: unknown };
    const msg = String(err?.shortMessage || err?.message || e);
    if (/NO_PROFIT|NO_POOL|SAME_TOKEN|DUP_POOL|BAD_POOL/.test(msg))
      return { ok: false, code: "arb.gone", reason: msg };
    if (/network|http|timeout|fetch/i.test(msg))
      return { ok: false, code: "arb.bad_rpc", reason: msg };
    return { ok: false, code: "arb.gone", reason: msg };
  }
}
