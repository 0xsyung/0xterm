/**
 * @file constants.ts
 * @description calldata generator constants — known ABIs + error copy (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Abi } from "viem";
import {
  erc20Abi,
  uniV2RouterAbi,
  uniV3RouterAbi,
  uniV3PoolAbi,
  nonfungiblePositionManagerAbi,
  uniV2FactoryAbi,
  uniV3FactoryAbi
} from "../constants";
import { arbExecutorAbi } from "../arb/calldata";

/** Known ABIs offered by the calldata widget dropdown. */
export const KNOWN_ABIS: { id: string; label: string; abi: Abi }[] = [
  { id: "erc20", label: "ERC-20", abi: erc20Abi as unknown as Abi },
  { id: "univ2-router", label: "Uniswap V2 Router", abi: uniV2RouterAbi as unknown as Abi },
  { id: "univ3-router", label: "Uniswap V3 Router", abi: uniV3RouterAbi as unknown as Abi },
  { id: "univ2-factory", label: "Uniswap V2 Factory", abi: uniV2FactoryAbi as unknown as Abi },
  { id: "univ3-factory", label: "Uniswap V3 Factory", abi: uniV3FactoryAbi as unknown as Abi },
  { id: "univ3-pool", label: "Uniswap V3 Pool", abi: uniV3PoolAbi as unknown as Abi },
  { id: "npm", label: "Uniswap V3 PositionManager", abi: nonfungiblePositionManagerAbi as unknown as Abi },
  { id: "arb-executor", label: "ArbExecutor", abi: arbExecutorAbi as unknown as Abi }
];

export const CALDATA_ERROR = {
  bad_to: "[!] calldata.bad_to — need a 0x contract address.",
  bad_sig: (reason: string) => `[!] calldata.bad_sig — ${reason}`,
  bad_fn: (fn: string) => `[!] calldata.bad_fn — function "${fn}" not in the selected ABI.`,
  arity: (want: number, got: number, name: string) =>
    `[!] calldata.arity — ${name} expects ${want} arg${want === 1 ? "" : "s"}, got ${got}.`,
  arg: (i: number, want: string) =>
    `[!] calldata.arg — arg ${i + 1} must be ${want}.`,
  no_chain: "[!] calldata.no_chain — select a network first (network <name>).",
  sim_revert: (short: string) =>
    `[!] calldata.sim_revert — dry-run reverted: ${short}`,
  sim_rpc: "[!] calldata.sim_rpc — RPC eth_call failed. Check rpc and network."
} as const;

export type CalldataErrorCode = keyof typeof CALDATA_ERROR;
