/**
 * @file portfolio.ts
 * @description Wallet portfolio holdings builder (native + registered tokens)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { formatEther, formatUnits, type Address, type Chain, type PublicClient } from "viem";
import {
  COMMON_TOKENS,
  NATIVE_TOKEN_ADDRESS,
  SUPPORTED_CHAINS,
  WRAPPED_NATIVE,
  erc20Abi
} from "./constants";
import { getTokenPriceUsd } from "./pricing";
import type { CustomTokensMap } from "./types";
import type { TokenResolution } from "./resolveToken";
import type { PortfolioHolding } from "./widgets/PortfolioWidget";

export type FetchPortfolioDeps = {
  getClient: (chain: Chain) => PublicClient;
  fetchImpl?: typeof fetch;
};

export type FetchTokenBalanceDeps = {
  getClient: (chain: Chain) => PublicClient;
  resolveToken: (queryToken: string, chain: Chain) => Promise<TokenResolution>;
};

export const fetchTokenBalanceData = async (
  userAddress: Address,
  targetChain: Chain,
  queryToken: string | undefined,
  deps: FetchTokenBalanceDeps
): Promise<{ balance: string; symbol: string }> => {
  const client = deps.getClient(targetChain);
  if (!queryToken) {
    const bal = await client.getBalance({ address: userAddress });
    return {
      balance: formatEther(bal),
      symbol: targetChain.nativeCurrency.symbol
    };
  }
  const token = await deps.resolveToken(queryToken, targetChain);
  if (token.isNative) {
    const bal = await client.getBalance({ address: userAddress });
    return { balance: formatEther(bal), symbol: token.symbol };
  }
  const bal = await client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddress]
  });
  return {
    balance: formatUnits(bal as bigint, token.decimals),
    symbol: token.symbol
  };
};

// Reusable holdings builder for `portfolio` (and pinned-portfolio refresh).
// Reads native + registered (COMMON_TOKENS + custom) token balances across
// all chains, pricing via getTokenPriceUsd.
export const fetchPortfolioHoldings = async (
  userAddress: Address,
  customTokens: CustomTokensMap,
  filterType: string | undefined,
  deps: FetchPortfolioDeps
): Promise<PortfolioHolding[]> => {
  const { getClient, fetchImpl = fetch } = deps;
  const holdings: PortfolioHolding[] = [];

  for (const chain of SUPPORTED_CHAINS) {
    const client = getClient(chain);
    let nativeBal = 0n;
    try {
      nativeBal = await client.getBalance({ address: userAddress });
    } catch {
      nativeBal = 0n;
    }

    const nativePrice = await getTokenPriceUsd(
      chain,
      chain.nativeCurrency.symbol,
      (WRAPPED_NATIVE[chain.id] || NATIVE_TOKEN_ADDRESS) as Address,
      true,
      client,
      fetchImpl
    );
    const nativeBalance = formatEther(nativeBal);
    const nativeValue =
      nativePrice !== null ? nativePrice * parseFloat(nativeBalance) : null;

    if (filterType !== "erc20") {
      holdings.push({
        chainName: chain.name,
        chainId: chain.id,
        symbol: chain.nativeCurrency.symbol,
        type: "native",
        balance: nativeBalance,
        priceUsd: nativePrice,
        valueUsd: nativeValue,
        change24h: null,
        priceSource: nativePrice !== null ? "api" : "—",
        isTestnet: !!chain.testnet
      });
    }

    // Custom-first view merged by address: every custom entry (including
    // duplicate symbols), plus COMMON_TOKENS entries not shadowed by a
    // custom token at the same address.
    const customList = customTokens[chain.id] || [];
    const commonMap = COMMON_TOKENS[chain.id] || {};
    const customAddrs = new Set(
      customList.map((t) => t.address.toLowerCase())
    );
    const view = [
      ...customList,
      ...Object.values(commonMap).filter(
        (c) => !customAddrs.has(c.address.toLowerCase())
      )
    ];
    for (const info of view) {
      if (filterType === "native") continue;
      if (info.address === NATIVE_TOKEN_ADDRESS) continue;
      const addr = info.address as Address;
      const symbol = info.symbol;
      try {
        const bal = (await client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [userAddress]
        })) as bigint;
        const decimals = info.decimals ?? 18;
        const formatted = formatUnits(bal, decimals);
        if (parseFloat(formatted) === 0) continue;

        const price = await getTokenPriceUsd(chain, symbol, addr, false, client, fetchImpl);
        holdings.push({
          chainName: chain.name,
          chainId: chain.id,
          symbol,
          type: "erc20",
          address: addr,
          balance: formatted,
          priceUsd: price,
          valueUsd: price !== null ? price * parseFloat(formatted) : null,
          change24h: null,
          priceSource: price !== null ? "api" : "—",
          isTestnet: !!chain.testnet
        });
      } catch {
        // skip tokens that fail to read (e.g. non-ERC20 or wrong chain)
      }
    }
  }

  return holdings;
};
