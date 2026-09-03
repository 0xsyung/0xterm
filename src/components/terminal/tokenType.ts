/**
 * @file tokenType.ts
 * @description On-chain token type detection (ERC-20 vs ERC-721)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain, PublicClient } from "viem";
import {
  COMMON_TOKENS,
  erc165Abi,
  erc20FullAbi,
  erc721Abi,
  INTERFACE_ID_ERC165,
  INTERFACE_ID_ERC20,
  INTERFACE_ID_ERC721
} from "./constants";

export type TokenTypeResult =
  | { type: "erc20"; name: string; symbol: string; decimals: number }
  | { type: "erc721"; name: string; symbol: string }
  | { type: "error" }
  | null;

export const detectTokenType = async (
  client: PublicClient,
  address: Address,
  chain: Chain,
  hint?: "erc20" | "erc721"
): Promise<TokenTypeResult> => {
  // Known common tokens are already verified; skip the brittle probe so
  // `info`/`is` work even when an RPC flake would fail a view read.
  const commonToken = Object.values(COMMON_TOKENS[chain.id] || {}).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (commonToken) {
    return {
      type: "erc20",
      name: commonToken.name,
      symbol: commonToken.symbol,
      decimals: commonToken.decimals
    };
  }

  // No code at this address (or getCode itself failed) → definitively not a
  // contract, so report null / error instead of probing dead code.
  let hasCode: boolean;
  try {
    hasCode = ((await client.getCode({ address })) ?? "0x").length > 0;
  } catch {
    return { type: "error" };
  }
  if (!hasCode) return null;

  // ERC-165 interface probe (optional — many tokens don't implement it).
  let erc165 = false;
  try {
    erc165 = Boolean(
      await client.readContract({
        address,
        abi: erc165Abi,
        functionName: "supportsInterface",
        args: [INTERFACE_ID_ERC165]
      })
    );
  } catch {
    erc165 = false;
  }

  if (erc165) {
    // Confirm it is NOT ERC-721 when checking for ERC-20 and vice versa
    if (hint !== "erc20") {
      try {
        const is721 = Boolean(
          await client.readContract({
            address,
            abi: erc165Abi,
            functionName: "supportsInterface",
            args: [INTERFACE_ID_ERC721]
          })
        );
        if (is721) {
          let name = "",
            symbol = "";
          try {
            const [n, s] = await Promise.all([
              client.readContract({
                address,
                abi: erc721Abi,
                functionName: "name"
              }),
              client.readContract({
                address,
                abi: erc721Abi,
                functionName: "symbol"
              })
            ]);
            name = String(n);
            symbol = String(s);
          } catch {}
          return { type: "erc721", name, symbol };
        }
      } catch {}
    }
    try {
      const is20 = Boolean(
        await client.readContract({
          address,
          abi: erc165Abi,
          functionName: "supportsInterface",
          args: [INTERFACE_ID_ERC20]
        })
      );
      if (is20 && hint !== "erc721") {
        const [decimals, sym, name] = await Promise.all([
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "decimals"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "symbol"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "name"
          })
        ]);
        return {
          type: "erc20",
          name: String(name),
          symbol: String(sym),
          decimals: Number(decimals)
        };
      }
    } catch {}
  }

  // ERC-721 probe: try ownerOf with a tokenId (never a no-arg call, which a
  // proxy can answer with empty data and falsely look like a valid read).
  if (hint !== "erc20") {
    for (const tokenId of [0n, 1n]) {
      try {
        await client.readContract({
          address,
          abi: erc721Abi,
          functionName: "ownerOf",
          args: [tokenId]
        });
        let name = "",
          symbol = "";
        try {
          const [n, s] = await Promise.all([
            client.readContract({
              address,
              abi: erc721Abi,
              functionName: "name"
            }),
            client.readContract({
              address,
              abi: erc721Abi,
              functionName: "symbol"
            })
          ]);
          name = String(n);
          symbol = String(s);
        } catch {}
        return { type: "erc721", name, symbol };
      } catch {}
    }
  }

  // ERC-20 probe: read each view independently. Require a core set
  // (decimals + totalSupply or symbol) so a single flaky metadata read
  // (name, or an RPC 429 on symbol) doesn't collapse the whole detection.
  // name/symbol are optional metadata — bytes32 legacy tokens are handled by
  // reading them and String()-ing the result.
  let readError = false;
  if (hint !== "erc721") {
    let decimals: number | undefined;
    let total: bigint | undefined;
    let symbol: string | undefined;
    let name: string | undefined;

    try {
      decimals = Number(
        await client.readContract({
          address,
          abi: erc20FullAbi,
          functionName: "decimals"
        })
      );
    } catch {
      readError = true;
    }
    try {
      total = (await client.readContract({
        address,
        abi: erc20FullAbi,
        functionName: "totalSupply"
      })) as bigint;
    } catch {
      readError = true;
    }
    try {
      symbol = String(
        await client.readContract({
          address,
          abi: erc20FullAbi,
          functionName: "symbol"
        })
      );
    } catch {
      readError = true;
    }
    try {
      name = String(
        await client.readContract({
          address,
          abi: erc20FullAbi,
          functionName: "name"
        })
      );
    } catch {
      // name is optional metadata — a missing name must not count as a read
      // failure or block detection of an otherwise valid ERC-20.
    }

    if (decimals !== undefined && total !== undefined) {
      return {
        type: "erc20",
        name: name ?? "",
        symbol: symbol ?? "TOKEN",
        decimals
      };
    }
    if (decimals !== undefined && symbol !== undefined) {
      return {
        type: "erc20",
        name: name ?? "",
        symbol,
        decimals
      };
    }

    // At least one read failed on a contract that has code → tell the user
    // the read failed rather than claiming it's not a token.
    if (readError) return { type: "error" };
  }
  return null;
};
