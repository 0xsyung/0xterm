/**
 * @file probeToken.ts
 * @description On-chain ERC-165 / core-function probing for the `is` command
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, PublicClient } from "viem";
import {
  INTERFACE_ID_ERC165,
  INTERFACE_ID_ERC20,
  INTERFACE_ID_ERC721,
  erc165Abi,
  erc20FullAbi,
  erc721Abi
} from "./constants";

export type Erc165Probe = {
  erc165: boolean;
  interfaceSupported: boolean;
  wantsId: string;
};

export const probeErc165 = async (
  client: PublicClient,
  address: Address,
  isErc721: boolean
): Promise<Erc165Probe> => {
  // 1) ERC-165 supportsInterface — the canonical signal
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

  const wantsId = isErc721 ? INTERFACE_ID_ERC721 : INTERFACE_ID_ERC20;
  let interfaceSupported = false;
  if (erc165) {
    try {
      interfaceSupported = Boolean(
        await client.readContract({
          address,
          abi: erc165Abi,
          functionName: "supportsInterface",
          args: [wantsId]
        })
      );
    } catch {
      interfaceSupported = false;
    }
  }

  return { erc165, interfaceSupported, wantsId };
};

export type CoreProbe = {
  verified: string[];
  checks: string[];
};

// Fallback: verify all core standard functions are callable.
export const probeCoreFunctions = async (
  client: PublicClient,
  address: Address,
  isErc721: boolean
): Promise<CoreProbe> => {
  const checks: string[] = [];
  const verified: string[] = [];

  const probe = async (
    fn: "ownerOf" | "totalSupply" | "balanceOf" | "allowance",
    fnArgs: [] | readonly [bigint] | readonly [Address] | readonly [Address, Address],
    label: string
  ) => {
    try {
      await client.readContract({
        address,
        abi: isErc721 ? erc721Abi : erc20FullAbi,
        functionName: fn,
        args: fnArgs
      });
      verified.push(label);
    } catch {
      checks.push(label);
    }
  };

  if (isErc721) {
    // Only view functions can be probed read-only. safeTransferFrom /
    // transferFrom are writes: they revert on eth_call against a real NFT
    // (no approval), so they always false-negative — skip them. ownerOf is
    // the strongest signal; try tokenId 0 then 1 so an unminted first token
    // doesn't false-negative.
    await probe("ownerOf", [0n], "ownerOf(0) → address");
    await probe("ownerOf", [1n], "ownerOf(1) → address");
    await probe("balanceOf", [address], "balanceOf(address) → uint256");
  } else {
    // Only view functions can be probed read-only. transfer / transferFrom
    // / approve are writes: they revert on eth_call against a real ERC-20,
    // so they always false-negative — skip them.
    await probe("totalSupply", [], "totalSupply() → uint256");
    await probe("balanceOf", [address], "balanceOf(address) → uint256");
    await probe(
      "allowance",
      [address, address],
      "allowance(address,address) → uint256"
    );
  }

  return { verified, checks };
};

// Report optional metadata too.
export const probeTokenMeta = async (
  client: PublicClient,
  address: Address
): Promise<string> => {
  let meta = "";
  try {
    const [sym, name] = await Promise.all([
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
    meta = ` (${String(name)} / ${String(sym)})`;
  } catch {
    meta = "";
  }
  return meta;
};

export type ProbeReportInput = {
  address: string;
  chainName: string;
  erc165: boolean;
  interfaceSupported: boolean;
  wantsId: string;
  isErc721: boolean;
  verified: string[];
  checks: string[];
  meta: string;
};

export const formatProbeReport = (p: ProbeReportInput): string[] => {
  const okCount = p.verified.length;
  const allCore = okCount === 3;

  const resultLines = [
    `Interface check for ${p.address} on ${p.chainName}:`,
    `ERC-165: ${p.erc165 ? "supported" : "not supported"}`,
    `${p.isErc721 ? "ERC-721" : "ERC-20"} interface (${p.wantsId}): ${
      p.interfaceSupported ? "yes" : "no"
    }`,
    `Core functions callable: ${okCount}/3`,
    ...p.verified.map((v) => `  ✓ ${v}`),
    ...p.checks.map((c) => `  ✗ ${c}`),
    ``
  ];

  if (allCore) {
    resultLines.push(
      `[✓] ${p.address} appears to be a valid ${p.isErc721 ? "ERC-721 (NFT)" : "ERC-20"} contract${p.meta}.`
    );
  } else if (okCount > 0) {
    resultLines.push(
      `[?] ${p.address} has some ${p.isErc721 ? "ERC-721" : "ERC-20"} characteristics but is missing: ${p.checks.join(", ")}.`
    );
  } else {
    resultLines.push(
      `[✗] ${p.address} does not look like a ${p.isErc721 ? "ERC-721" : "ERC-20"} contract.`
    );
  }

  return resultLines;
};
