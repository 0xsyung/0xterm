/**
 * @file constants.ts
 * @description arb command constants — executor registry, error copy (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address } from "viem";

/**
 * ArbExecutor per chain. Only chains with a deployed + audited executor appear
 * here. Sepolia is the v1 deployment (0xterm-contracts/script/DeployArbExecutor.s.sol);
 * mainnet `arb run` is refused until the audit gate (arb.mainnet_disabled).
 */
export const ARB_EXECUTOR: Record<number, Address> = {
  11155111: "0x0d87eAEAe884339DEFBA431aDFf6075dcEcF6a55",
};

export const ARB_ERROR = {
  unsupported: (chain: string) =>
    `[!] arb.unsupported — no DEX venues on ${chain}. Set a network with ≥2 registered venues (arb venues).`,
  gone: "[!] arb.gone — the arb quote is gone. Rescan before running.",
  mainnet_disabled:
    "[!] arb.mainnet_disabled — arb run is disabled on mainnet until the audit gate. Use a testnet (sepolia).",
  bad_estimate:
    "[!] arb.bad_estimate — could not estimate gas. Check the RPC and that the executor is deployed on this chain.",
  no_venues:
    "[!] arb.no_venues — fewer than 2 DEX venues on this chain. Register or switch networks.",
  bad_rpc: (rpc: string) =>
    `[!] arb.bad_rpc — RPC "${rpc}" is unreachable or refused eth_call.`,
  gas_unknown:
    "[!] arb.gas_unknown — gas estimate unavailable. Cannot compute minProfit; try again.",
  no_executor: (chain: string) =>
    `[!] arb.no_executor — no ArbExecutor deployed on ${chain}. Only sepolia is wired in v1.`,
} as const;

export type ArbErrorCode = keyof typeof ARB_ERROR;
