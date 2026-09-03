/**
 * @file pricing.ts
 * @description Token / native USD price lookups (DexScreener + on-chain pools)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { parseAbi } from "viem";
import type { Address, Chain, PublicClient } from "viem";
import {
  DEX_REGISTRY,
  DEXSCREENER_CHAIN,
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE,
  uniV2FactoryAbi,
  uniV2PairAbi,
  uniV3FactoryAbi,
  uniV3PoolAbi
} from "./constants";

const token0Abi = parseAbi(["function token0() view returns (address)"]);

// Native token USD price via DexScreener (cache per chain in-memory).
const nativePriceCache: Record<number, number | null> = {};

export const getNativePriceUsd = async (
  chain: Chain,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> => {
  if (chain.id in nativePriceCache) return nativePriceCache[chain.id];
  const slug = DEXSCREENER_CHAIN[chain.id];
  let price: number | null = null;
  if (slug) {
    try {
      const res = await fetchImpl(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(chain.nativeCurrency.symbol)}`
      );
      if (res.ok) {
        const data = await res.json();
        const pair = (data.pairs || []).find(
          (p: any) => p.chainId.toLowerCase() === slug
        );
        if (pair && pair.priceUsd) {
          const usd = parseFloat(pair.priceUsd);
          if (Number.isFinite(usd) && usd > 0) price = usd;
        }
      }
    } catch {
      // leave null
    }
  }
  nativePriceCache[chain.id] = price;
  return price;
};

export const getTokenPriceUsd = async (
  chain: Chain,
  symbol: string,
  address: Address,
  isNative: boolean,
  client: PublicClient,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> => {
  // 1) DexScreener
  const slug = DEXSCREENER_CHAIN[chain.id];
  if (slug) {
    try {
      const res = await fetchImpl(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`
      );
      if (res.ok) {
        const data = await res.json();
        const pairs: any[] = data.pairs || [];
        const pair = pairs.find(
          (p: any) =>
            p.chainId.toLowerCase() === slug &&
            (isNative
              ? true
              : p.baseToken.symbol.toLowerCase() === symbol.toLowerCase() &&
                p.baseToken.address?.toLowerCase() === address.toLowerCase())
        );
        if (pair && pair.priceUsd) {
          const usd = parseFloat(pair.priceUsd);
          if (Number.isFinite(usd) && usd > 0) return usd;
        }
      }
    } catch {
      // fall through to on-chain
    }
  }

  // Native: priced via DexScreener only (no pool pair to read).
  if (isNative) return getNativePriceUsd(chain, fetchImpl);

  // 2) On-chain V3 pool (quote vs wrapped native)
  // 3) On-chain V2 pool (quote vs wrapped native)
  const dexes = DEX_REGISTRY[chain.id] || [];
  const wrappedNative = WRAPPED_NATIVE[chain.id];
  if (!wrappedNative || dexes.length === 0) return null;

  const nativeUsd = await getNativePriceUsd(chain, fetchImpl);
  if (nativeUsd === null) return null;

  for (const dex of dexes) {
    if (dex.type === "V3") {
      for (const feeTier of [3000, 500, 10000]) {
        try {
          const pool = (await client.readContract({
            address: dex.factory,
            abi: uniV3FactoryAbi,
            functionName: "getPool",
            args: [address, wrappedNative, feeTier]
          })) as Address;
          if (!pool || pool === NATIVE_TOKEN_ADDRESS) continue;
          const [token0, slot0] = await Promise.all([
            client.readContract({
              address: pool,
              abi: token0Abi,
              functionName: "token0"
            }),
            client.readContract({
              address: pool,
              abi: uniV3PoolAbi,
              functionName: "slot0"
            })
          ]);
          const sqrtPrice = Number(slot0[0]) / 2 ** 96;
          const pRaw = Math.pow(sqrtPrice, 2);
          const isToken0 =
            (token0 as string).toLowerCase() === address.toLowerCase();
          const priceInNative = isToken0 ? pRaw : 1 / pRaw;
          return priceInNative * nativeUsd;
        } catch {
          continue;
        }
      }
    } else if (dex.type === "V2") {
      try {
        const pair = (await client.readContract({
          address: dex.factory,
          abi: uniV2FactoryAbi,
          functionName: "getPair",
          args: [address, wrappedNative]
        })) as Address;
        if (!pair || pair === NATIVE_TOKEN_ADDRESS) continue;
        const [token0, reserves] = await Promise.all([
          client.readContract({
            address: pair,
            abi: uniV2PairAbi,
            functionName: "token0"
          }),
          client.readContract({
            address: pair,
            abi: uniV2PairAbi,
            functionName: "getReserves"
          })
        ]);
        const isToken0 =
          (token0 as string).toLowerCase() === address.toLowerCase();
        const reserveToken = isToken0 ? reserves[0] : reserves[1];
        const reserveNative = isToken0 ? reserves[1] : reserves[0];
        if (reserveNative === 0n) continue;
        const priceInNative = Number(reserveToken) / Number(reserveNative);
        return priceInNative * nativeUsd;
      } catch {
        continue;
      }
    }
  }
  return null;
};
