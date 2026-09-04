/**
 * @file poolPrice.ts
 * @description On-chain AMM pool price ratio (V2 reserves / V3 sqrtPriceX96)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { formatUnits, parseAbi } from "viem";
import type { Address, PublicClient } from "viem";
import { uniV2PairAbi, uniV3PoolAbi } from "./constants";

export type PoolPriceDeps = {
  dexType: "V2" | "V3";
  pairAddress: Address;
  tokenAAddress: Address;
  tokenADecimals: number;
  tokenBDecimals: number;
};

const token0Abi = parseAbi(["function token0() view returns (address)"]);

// Read a pair's current price ratio (1 tokenA = N tokenB) from the on-chain
// pool. V2 uses reserve balances; V3 derives it from sqrtPriceX96.
export const getPoolPriceRatio = async (
  client: PublicClient,
  d: PoolPriceDeps
): Promise<number> => {
  if (d.dexType === "V2") {
    const [token0, reserves] = await Promise.all([
      client.readContract({
        address: d.pairAddress,
        abi: uniV2PairAbi,
        functionName: "token0"
      }),
      client.readContract({
        address: d.pairAddress,
        abi: uniV2PairAbi,
        functionName: "getReserves"
      })
    ]);
    const isA0 = (token0 as string).toLowerCase() === d.tokenAAddress.toLowerCase();
    const reserveA = isA0 ? reserves[0] : reserves[1];
    const reserveB = isA0 ? reserves[1] : reserves[0];
    const formattedA = parseFloat(formatUnits(reserveA, d.tokenADecimals));
    const formattedB = parseFloat(formatUnits(reserveB, d.tokenBDecimals));
    if (formattedA === 0) throw new Error("Pool reserve for token A is zero.");
    return formattedB / formattedA;
  }

  // V3
  const [token0, slot0] = await Promise.all([
    client.readContract({
      address: d.pairAddress,
      abi: token0Abi,
      functionName: "token0"
    }),
    client.readContract({
      address: d.pairAddress,
      abi: uniV3PoolAbi,
      functionName: "slot0"
    })
  ]);
  const isTokenA0 = (token0 as string).toLowerCase() === d.tokenAAddress.toLowerCase();
  const sqrtPriceFloat = Number(slot0[0]) / 2 ** 96;
  const pRaw = Math.pow(sqrtPriceFloat, 2);
  const dec0 = isTokenA0 ? d.tokenADecimals : d.tokenBDecimals;
  const dec1 = isTokenA0 ? d.tokenBDecimals : d.tokenADecimals;
  const pToken0InToken1 = pRaw * Math.pow(10, dec0 - dec1);
  return isTokenA0 ? pToken0InToken1 : 1 / pToken0InToken1;
};
