/**
 * @file rpc.ts
 * @description Pure logic for the `rpc` command (help, URL building, provider map merges)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Chain } from "viem";

export type RpcProviders = Record<number, Record<string, string>>;
export type ActiveRpcProviders = Record<number, string>;

export type RpcActionResult =
  | { kind: "state"; text: string; rpcProviders: RpcProviders; active: ActiveRpcProviders }
  | { kind: "text"; text: string };

export type RpcResolveInput = {
  args: string[];
  chainId: number;
  chain: Chain;
  rpcProviders: RpcProviders;
  activeRpcProviders: ActiveRpcProviders;
};

const USAGE = "Usage:\n• rpc\n• rpc use <name>\n• rpc add <name> <url>\n• rpc remove <name>\n• rpc alchemy <key>\n• rpc infura <key>\n• rpc quicknode <url>";

export const getAlchemySubdomain = (chainId: number): string | null => {
  switch (chainId) {
    case 1:
      return "eth-mainnet";
    case 11155111:
      return "eth-sepolia";
    case 42161:
      return "arb-mainnet";
    case 10:
      return "opt-mainnet";
    case 137:
      return "polygon-mainnet";
    case 8453:
      return "base-mainnet";
    default:
      return null;
  }
};

export const getInfuraSubdomain = (chainId: number): string | null => {
  switch (chainId) {
    case 1:
      return "mainnet";
    case 11155111:
      return "sepolia";
    case 42161:
      return "arbitrum-mainnet";
    case 10:
      return "optimism-mainnet";
    case 137:
      return "polygon-mainnet";
    case 8453:
      return "base-mainnet";
    default:
      return null;
  }
};

// Build the `rpc` (no args) provider listing: the chain default (marked
// unavailable — public RPC is unstable, API key required) plus any configured
// custom providers, marking the active one.
export const buildRpcHelp = (
  chain: Chain,
  chainProviders: Record<string, string>,
  activeName: string
): string => {
  const defaultUrl = chain.rpcUrls.default.http[0];
  const allProviders = { default: defaultUrl, ...chainProviders };
  const providerLines = Object.entries(allProviders).map(([name, url]) => {
    const isActive = name === activeName;
    const isDefault = name === "default";
    const defaultLabel = isDefault ? " ⚠ public (unstable — API key required)" : "";
    return `${isActive ? "▶ [ACTIVE]" : "         "} ${name.toUpperCase()}${defaultLabel}:\n           ${url}`;
  });
  return [
    `RPC Providers for ${chain.name}:`,
    ...providerLines,
    ``,
    `Commands:`,
    `• rpc use <name>`,
    `• rpc add <name> <url>`,
    `• rpc remove <name>`,
    `• rpc alchemy <key>`,
    `• rpc infura <key>`,
    `• rpc quicknode <url>`
  ].join("\n");
};

// Resolve a `rpc` command into either a pure text reply or the next provider
// map state (the shell applies setState + persistence when kind === "state").
export const resolveRpcAction = (input: RpcResolveInput): RpcActionResult => {
  const { args, chain, rpcProviders, activeRpcProviders } = input;
  const chainProviders = rpcProviders[chain.id] || {};
  const activeName = activeRpcProviders[chain.id] || "default";

  if (!args[1]) {
    return { kind: "text", text: buildRpcHelp(chain, chainProviders, activeName) };
  }

  const sub = args[1].toLowerCase();

  if (sub === "use" || sub === "switch") {
    const providerName = args[2]?.toLowerCase();
    if (!providerName)
      return {
        kind: "text",
        text: "Usage: rpc use <providerName> (e.g., 'rpc use alchemy')"
      };
    if (providerName === "default")
      return {
        kind: "text",
        text: `[!] The default provider is the unstable public RPC. Configure an API-key provider first: rpc alchemy <KEY> or rpc add <name> <url>.`
      };
    if (!chainProviders[providerName])
      return {
        kind: "text",
        text: `[!] Provider "${providerName}" not found for ${chain.name}. Configure it first.`
      };
    const active = {
      ...activeRpcProviders,
      [chain.id]: providerName
    };
    return {
      kind: "state",
      text: `[✓] Switched active RPC provider to "${providerName}" on ${chain.name}.`,
      rpcProviders,
      active
    };
  }

  if (sub === "add") {
    const name = args[2]?.toLowerCase();
    const url = args[3];
    if (!name || !url || !url.startsWith("http"))
      return { kind: "text", text: "Usage: rpc add <name> <url>" };
    const updatedChainProviders = { ...chainProviders, [name]: url };
    const rpcProvidersNext = {
      ...rpcProviders,
      [chain.id]: updatedChainProviders
    };
    const active = { ...activeRpcProviders, [chain.id]: name };
    return {
      kind: "state",
      text: `[✓] Added and activated RPC provider "${name}" for ${chain.name}.`,
      rpcProviders: rpcProvidersNext,
      active
    };
  }

  if (sub === "remove" || sub === "rm") {
    const name = args[2]?.toLowerCase();
    if (!name) return { kind: "text", text: "Usage: rpc remove <name>" };
    if (name === "default")
      return { kind: "text", text: "Cannot remove default provider." };
    if (!chainProviders[name])
      return { kind: "text", text: `[!] Provider "${name}" not found.` };
    const updatedChainProviders = { ...chainProviders };
    delete updatedChainProviders[name];
    const rpcProvidersNext = {
      ...rpcProviders,
      [chain.id]: updatedChainProviders
    };
    const active = { ...activeRpcProviders };
    if (activeName === name) active[chain.id] = "default";
    return {
      kind: "state",
      text: `[✓] Removed RPC provider "${name}". Active provider reverted to default if needed.`,
      rpcProviders: rpcProvidersNext,
      active
    };
  }

  let newUrl = "";
  let providerKey = sub;

  if (sub === "alchemy") {
    const key = args[2];
    if (!key) return { kind: "text", text: "Usage: rpc alchemy <apiKey>" };
    const subDomain = getAlchemySubdomain(chain.id);
    if (!subDomain)
      return {
        kind: "text",
        text: `[!] Alchemy preset not available for ${chain.name}. Use 'rpc add custom <url>'.`
      };
    newUrl = `https://${subDomain}.g.alchemy.com/v2/${key}`;
  } else if (sub === "infura") {
    const key = args[2];
    if (!key) return { kind: "text", text: "Usage: rpc infura <apiKey>" };
    const subDomain = getInfuraSubdomain(chain.id);
    if (!subDomain)
      return {
        kind: "text",
        text: `[!] Infura preset not available for ${chain.name}. Use 'rpc add custom <url>'.`
      };
    newUrl = `https://${subDomain}.infura.io/v3/${key}`;
  } else if (sub === "quicknode") {
    const endpoint = args[2];
    if (!endpoint)
      return { kind: "text", text: "Usage: rpc quicknode <endpointUrlOrKey>" };
    newUrl = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;
  } else if (args[1].startsWith("http")) {
    newUrl = args[1];
    providerKey = "custom";
  } else {
    return { kind: "text", text: USAGE };
  }

  const updatedChainProviders = {
    ...chainProviders,
    [providerKey]: newUrl
  };
  const rpcProvidersNext = {
    ...rpcProviders,
    [chain.id]: updatedChainProviders
  };
  const active = {
    ...activeRpcProviders,
    [chain.id]: providerKey
  };
  return {
    kind: "state",
    text: `[✓] Configured and activated RPC provider "${providerKey}" for ${chain.name}:\n${newUrl}`,
    rpcProviders: rpcProvidersNext,
    active
  };
};
