/**
 * @file resolveToken.ts
 * @description Token query resolution (symbol / @-label / address → on-chain)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { isAddress, type Address, type Chain, type PublicClient } from "viem";
import { COMMON_TOKENS, NATIVE_TOKEN_ADDRESS, erc20Abi } from "./constants";
import type { CustomTokenEntry } from "./types";

export type TokenResolution = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  id?: string;
  tokenType?: "erc20" | "erc721";
};

export type ResolveTokenDeps = {
  customList: CustomTokenEntry[];
  client: PublicClient;
  onAmbiguous: (
    matches: CustomTokenEntry[],
    chain: Chain
  ) => Promise<CustomTokenEntry | null>;
  fetchImpl?: typeof fetch;
};

export const resolveTokenDetails = async (
  queryToken: string,
  chain: Chain,
  deps: ResolveTokenDeps
): Promise<TokenResolution> => {
  const sym = queryToken.toUpperCase();
  const isNative =
    sym === chain.nativeCurrency.symbol ||
    sym === "ETH" ||
    queryToken === NATIVE_TOKEN_ADDRESS;
  if (isNative)
    return {
      address: NATIVE_TOKEN_ADDRESS as Address,
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: 18,
      isNative: true
    };

  const customList = deps.customList;

  // Normalize a custom entry to the fully-resolved shape callers expect
  // (decimals is required there; default 18 like ERC-20 convention).
  const asResolved = (t: CustomTokenEntry): TokenResolution => ({
    address: t.address as Address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals ?? 18,
    isNative: false
  });

  // Picked autocomplete label: SYM@0xaddr — resolve deterministically
  // (never re-picks). The label's address part is truncated (0x7f83…0501), so
  // match the symbol prefix first, then fall back to a full address if given.
  const atIdx = queryToken.indexOf("@");
  if (atIdx !== -1) {
    const symPart = queryToken.slice(0, atIdx).toUpperCase();
    const addrPart = queryToken.slice(atIdx + 1).trim();
    if (addrPart.startsWith("0x") && isAddress(addrPart)) {
      const byLabel = customList.find(
        (t) => t.address.toLowerCase() === (addrPart as string).toLowerCase()
      );
      if (byLabel) return asResolved(byLabel);
    } else {
      const byLabel = customList.find(
        (t) => t.symbol.toUpperCase() === symPart
      );
      if (byLabel) return asResolved(byLabel);
    }
  }

  // Exact address match against registered custom tokens.
  if (isAddress(queryToken)) {
    const byAddr = customList.find(
      (t) => t.address.toLowerCase() === (queryToken as string).toLowerCase()
    );
    if (byAddr) return asResolved(byAddr);
  }

  // Plain symbol: the hardcoded COMMON token wins when present — the @-label
  // is how the user explicitly targets a custom token (custom shadows
  // hardcoded only via the @-qualified form or when no common token exists).
  const common = COMMON_TOKENS[chain.id]?.[sym];
  if (common) return { ...common, isNative: false };

  // No hardcoded token: fall back to custom entries by symbol. A single match
  // resolves directly; multiple matches need the CHOICES picker.
  const matches = customList.filter((t) => t.symbol.toUpperCase() === sym);
  if (matches.length === 1) return asResolved(matches[0]);
  if (matches.length > 1) {
    const chosen = await deps.onAmbiguous(matches, chain);
    if (!chosen)
      throw new Error(
        `Token selection cancelled for symbol "${sym}" on ${chain.name}.`
      );
    return asResolved(chosen);
  }

  const client = deps.client;
  if (isAddress(queryToken)) {
    const addr = queryToken as Address;
    try {
      const [decimals, tokenSymbol, name] = await Promise.all([
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "decimals"
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "symbol"
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "name"
        })
      ]);
      return {
        address: addr,
        symbol: String(tokenSymbol),
        name: String(name),
        decimals: Number(decimals),
        isNative: false
      };
    } catch {
      return {
        address: addr,
        symbol: `${addr.slice(0, 6)}...`,
        name: "Custom Token",
        decimals: 18,
        isNative: false
      };
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `https://api.dexscreener.com/latest/dex/search?q=${queryToken}`
    );
    const data = await res.json();
    const pair = data.pairs?.find(
      (p: { chainId: string }) =>
        p.chainId.toLowerCase() === chain.name.toLowerCase() ||
        p.chainId === "ethereum"
    );

    if (pair?.baseToken?.address && isAddress(pair.baseToken.address)) {
      const addr = pair.baseToken.address as Address;
      try {
        const decimals = await client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "decimals"
        });
        return {
          address: addr,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          decimals: Number(decimals),
          isNative: false
        };
      } catch {
        return {
          address: addr,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          decimals: 18,
          isNative: false
        };
      }
    }
  } catch {
    // Ignore fetch errors during token resolution
  }

  throw new Error(
    `Unable to resolve token "${queryToken}" on ${chain.name}. Register it first using 'register <address>'.`
  );
};

// Pin-refresh resolution: prefer the persisted token address (deterministic,
// never opens the picker), falling back to symbol resolution for legacy pins.
export const resolveWithPreferred = async (
  symbol: string | undefined,
  preferredAddr: string | undefined,
  chain: Chain,
  deps: ResolveTokenDeps
): Promise<TokenResolution> => {
  if (preferredAddr && isAddress(preferredAddr)) {
    const byAddr = deps.customList.find(
      (t) => t.address.toLowerCase() === preferredAddr.toLowerCase()
    );
    if (byAddr) return { ...byAddr, decimals: byAddr.decimals ?? 18 };
    // not a custom token — read on-chain metadata directly (no picker)
    try {
      const client = deps.client;
      const [decimals, name] = await Promise.all([
        client.readContract({
          address: preferredAddr as Address,
          abi: erc20Abi,
          functionName: "decimals"
        }),
        client.readContract({
          address: preferredAddr as Address,
          abi: erc20Abi,
          functionName: "name"
        })
      ]);
      return {
        id: `c_${preferredAddr.toLowerCase()}`,
        address: preferredAddr as Address,
        symbol: symbol || "TOKEN",
        name: String(name),
        decimals: Number(decimals),
        isNative: false
      };
    } catch {
      // fall through to symbol resolution
    }
  }
  return resolveTokenDetails(symbol || "", chain, deps);
};

// Resolve with decimals normalized to a concrete number (callers like the
// pin-price refresh use decimals directly in arithmetic).
export const resolveWithPreferredDecimals = async (
  symbol: string | undefined,
  preferredAddr: string | undefined,
  chain: Chain,
  deps: ResolveTokenDeps
): Promise<TokenResolution> => {
  const t = await resolveWithPreferred(symbol, preferredAddr, chain, deps);
  return { ...t, decimals: t.decimals ?? 18 };
};
