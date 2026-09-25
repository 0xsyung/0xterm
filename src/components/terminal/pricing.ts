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
import {
  fetchSearchPairs,
  fetchTokensV1,
  parseChange24h,
  parsePriceUsd,
  pickDexPair
} from "./dexscreener";

const token0Abi = parseAbi(["function token0() view returns (address)"]);

// Native token USD price via DexScreener (cache per chain in-memory).
const nativePriceCache: Record<number, number | null> = {};

export type TokenQuoteUsd = {
  priceUsd: number | null;
  /** 24h % from the same DexScreener pair — null when absent (#22). */
  change24h: number | null;
};

const quoteFromPair = (picked: { priceUsd?: string | number | null }): {
  priceUsd: number | null;
  change24h: number | null;
} | null => {
  const usd = parsePriceUsd(picked as never);
  if (usd === null || usd <= 0) return null;
  return {
    priceUsd: usd,
    change24h: parseChange24h(picked as never)
  };
};

/**
 * Native USD via tokens/v1 on wrapped native (hardened — no search pairs[0]).
 * Falls back to search + pickDexPair when tokens/v1 misses.
 */
export const getNativeQuoteUsd = async (
  chain: Chain,
  fetchImpl: typeof fetch = fetch
): Promise<TokenQuoteUsd> => {
  if (chain.id in nativePriceCache) {
    const cached = nativePriceCache[chain.id];
    return { priceUsd: cached, change24h: null };
  }
  const slug = DEXSCREENER_CHAIN[chain.id];
  let quote: TokenQuoteUsd = { priceUsd: null, change24h: null };
  if (slug) {
    const wrapped = WRAPPED_NATIVE[chain.id];
    if (wrapped && wrapped !== NATIVE_TOKEN_ADDRESS) {
      try {
        const pairs = await fetchTokensV1(slug, [wrapped], fetchImpl);
        const picked = pickDexPair(pairs, {
          symbol: chain.nativeCurrency.symbol,
          allowDai: true,
          preferChains: [slug],
          majorGuard: true
        });
        const q = picked ? quoteFromPair(picked) : null;
        if (q) quote = q;
      } catch {
        // fall through to search
      }
    }
    if (quote.priceUsd === null) {
      try {
        const pairs = await fetchSearchPairs(
          chain.nativeCurrency.symbol,
          fetchImpl
        );
        const onChain = pairs.filter(
          (p) => (p.chainId || "").toLowerCase() === slug
        );
        const picked = pickDexPair(onChain.length ? onChain : pairs, {
          symbol: chain.nativeCurrency.symbol,
          allowDai: false,
          preferChains: [slug],
          majorGuard: true
        });
        const q = picked ? quoteFromPair(picked) : null;
        if (q) quote = q;
      } catch {
        // leave null
      }
    }
  }
  nativePriceCache[chain.id] = quote.priceUsd;
  return quote;
};

/** Number-only wrapper kept for the legacy callers. */
export const getNativePriceUsd = async (
  chain: Chain,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> => {
  const q = await getNativeQuoteUsd(chain, fetchImpl);
  return q.priceUsd;
};

export const getTokenQuoteUsd = async (
  chain: Chain,
  symbol: string,
  address: Address,
  isNative: boolean,
  client: PublicClient,
  fetchImpl: typeof fetch = fetch
): Promise<TokenQuoteUsd> => {
  const slug = DEXSCREENER_CHAIN[chain.id];

  // Native: tokens/v1 on wrapped + pickDexPair (never pairs[0])
  if (isNative) return getNativeQuoteUsd(chain, fetchImpl);

  // 1) DexScreener tokens/v1 by address + pickDexPair
  if (slug) {
    try {
      const pairs = await fetchTokensV1(slug, [address], fetchImpl);
      const picked = pickDexPair(pairs, {
        symbol,
        allowDai: true,
        preferChains: [slug],
        majorGuard: true
      });
      const q = picked ? quoteFromPair(picked) : null;
      if (q) return q;
    } catch {
      // fall through
    }

    // 2) Search + pickDexPair (still no pairs[0])
    try {
      const pairs = await fetchSearchPairs(symbol, fetchImpl);
      const onChain = pairs.filter((p) => {
        if ((p.chainId || "").toLowerCase() !== slug) return false;
        const base = p.baseToken?.address?.toLowerCase();
        const baseSym = (p.baseToken?.symbol || "").toLowerCase();
        return (
          base === address.toLowerCase() ||
          baseSym === symbol.toLowerCase()
        );
      });
      const picked = pickDexPair(onChain.length ? onChain : pairs, {
        symbol,
        allowDai: false,
        preferChains: [slug],
        majorGuard: true
      });
      if (picked) {
        // Prefer address match when available
        const base = picked.baseToken?.address?.toLowerCase();
        if (!base || base === address.toLowerCase()) {
          const q = quoteFromPair(picked);
          if (q) return q;
        }
      }
    } catch {
      // fall through to on-chain
    }
  }

  // 3) On-chain V3 pool (quote vs wrapped native)
  // 4) On-chain V2 pool (quote vs wrapped native)
  const dexes = DEX_REGISTRY[chain.id] || [];
  const wrappedNative = WRAPPED_NATIVE[chain.id];
  if (!wrappedNative || dexes.length === 0)
    return { priceUsd: null, change24h: null };

  const nativeUsd = await getNativeQuoteUsd(chain, fetchImpl);
  if (nativeUsd.priceUsd === null) return { priceUsd: null, change24h: null };

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
          return { priceUsd: priceInNative * nativeUsd.priceUsd, change24h: null };
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
        return { priceUsd: priceInNative * nativeUsd.priceUsd, change24h: null };
      } catch {
        continue;
      }
    }
  }
  return { priceUsd: null, change24h: null };
};

/** Number-only wrapper kept for the legacy callers. */
export const getTokenPriceUsd = async (
  chain: Chain,
  symbol: string,
  address: Address,
  isNative: boolean,
  client: PublicClient,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> => {
  const q = await getTokenQuoteUsd(
    chain,
    symbol,
    address,
    isNative,
    client,
    fetchImpl
  );
  return q.priceUsd;
};
