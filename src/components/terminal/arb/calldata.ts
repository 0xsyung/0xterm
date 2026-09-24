/**
 * @file calldata.ts
 * @description arb run calldata encoder — ArbExecutor.RunParams 16-tuple (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { encodeFunctionData, type Address } from "viem";
import type { ArbVenue } from "./scan";

/** ABI for ArbExecutor.run(RunParams) — tuple order matches the struct. */
export const arbExecutorAbi = [
  {
    type: "function" as const,
    name: "run",
    stateMutability: "nonpayable" as const,
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "tokenStart", type: "address" },
          { name: "tokenOther", type: "address" },
          { name: "poolA", type: "address" },
          { name: "poolB", type: "address" },
          { name: "poolC", type: "address" },
          { name: "feeA", type: "uint24" },
          { name: "feeB", type: "uint24" },
          { name: "feeC", type: "uint24" },
          { name: "aIsV3", type: "bool" },
          { name: "bIsV3", type: "bool" },
          { name: "cIsV3", type: "bool" },
          { name: "amountIn", type: "uint256" },
          { name: "minProfit", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "profit", type: "uint256" }, { name: "dust", type: "uint256" }]
  }
] as const;

export type RunParamsArgs = {
  tokenStart: Address;
  tokenOther: Address;
  poolA: Address;
  poolB: Address;
  poolC: Address;
  feeA: number;
  feeB: number;
  feeC: number;
  aIsV3: boolean;
  bIsV3: boolean;
  cIsV3: boolean;
  amountIn: bigint;
  minProfit: bigint;
};

/** Build RunParams args from a 3-venue scan. */
export function runParamsFromScan(
  scan: { venueA: ArbVenue; venueB: ArbVenue; venueC: ArbVenue; size: bigint },
  minProfit: bigint,
  tokenStart: Address,
  tokenOther: Address
): RunParamsArgs {
  return {
    tokenStart,
    tokenOther,
    poolA: scan.venueA.pool,
    poolB: scan.venueB.pool,
    poolC: scan.venueC.pool,
    feeA: scan.venueA.fee,
    feeB: scan.venueB.fee,
    feeC: scan.venueC.fee,
    aIsV3: scan.venueA.isV3,
    bIsV3: scan.venueB.isV3,
    cIsV3: scan.venueC.isV3,
    amountIn: scan.size,
    minProfit
  };
}

export function encodeRunParams(p: RunParamsArgs): `0x${string}` {
  return encodeFunctionData({
    abi: arbExecutorAbi,
    functionName: "run",
    args: [p]
  });
}

/**
 * Minimum profit (tokenStart) that makes a run worthwhile after gas.
 * `gasWei` is the estimated gas cost in native; `pricePerTokenStart` is the
 * tokenStart base units per 1 native wei. 2x buffer, never 0 once gas known.
 */
export function arbMinProfit({
  gasWei,
  pricePerTokenStart,
}: {
  gasWei: bigint;
  pricePerTokenStart: bigint;
}): bigint {
  if (gasWei <= 0n) return 0n;
  return gasWei * pricePerTokenStart * 2n;
}
