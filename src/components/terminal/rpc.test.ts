/**
 * @file rpc.test.ts
 * @description Unit tests for the pure rpc command logic
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { base } from "viem/chains";
import {
  buildRpcHelp,
  getAlchemySubdomain,
  getInfuraSubdomain,
  resolveRpcAction,
  type RpcResolveInput
} from "./rpc";

const CHAIN = base;
const CHAIN_ID = base.id;

const empty = (): RpcResolveInput => ({
  args: [],
  chainId: CHAIN_ID,
  chain: CHAIN,
  rpcProviders: {},
  activeRpcProviders: {}
});

const withProviders = (chainProviders: Record<string, string>): RpcResolveInput => ({
  ...empty(),
  rpcProviders: { [CHAIN_ID]: chainProviders },
  activeRpcProviders: {}
});

describe("getAlchemySubdomain / getInfuraSubdomain", () => {
  it("returns the alchemy subdomain for known chains", () => {
    expect(getAlchemySubdomain(1)).toBe("eth-mainnet");
    expect(getAlchemySubdomain(8453)).toBe("base-mainnet");
  });

  it("returns null for unknown chains", () => {
    expect(getAlchemySubdomain(999999)).toBeNull();
  });

  it("returns the infura subdomain for known chains", () => {
    expect(getInfuraSubdomain(1)).toBe("mainnet");
    expect(getInfuraSubdomain(10)).toBe("optimism-mainnet");
  });

  it("returns null for unknown chains", () => {
    expect(getInfuraSubdomain(999999)).toBeNull();
  });
});

describe("buildRpcHelp", () => {
  it("lists the chain default and marks the active provider", () => {
    const help = buildRpcHelp(CHAIN, { alchemy: "https://alchemy.example" }, "alchemy");
    expect(help).toContain("RPC Providers for Base:");
    expect(help).toContain("▶ [ACTIVE] ALCHEMY:");
    expect(help).toContain("Commands:");
  });

  it("marks the default provider as active when it is active", () => {
    const help = buildRpcHelp(CHAIN, {}, "default");
    expect(help).toContain("RPC Providers for Base:");
    expect(help).toContain("▶ [ACTIVE] DEFAULT");
  });

  it("labels the default provider as unstable public RPC", () => {
    const help = buildRpcHelp(CHAIN, {}, "default");
    expect(help).toContain("⚠ public (unstable — API key required)");
  });
});

describe("resolveRpcAction", () => {
  it("returns help text when no args are given", () => {
    const res = resolveRpcAction(empty());
    expect(res).toEqual({ kind: "text", text: buildRpcHelp(CHAIN, {}, "default") });
  });

  it("returns a usage error for an unknown subcommand", () => {
    const res = resolveRpcAction({ ...empty(), args: ["rpc", "bogus"] });
    expect(res.kind).toBe("text");
    expect(res.text).toContain("Usage:");
  });

  it("switches the active provider", () => {
    const res = resolveRpcAction({
      ...withProviders({ alchemy: "https://alchemy.example" }),
      args: ["rpc", "use", "alchemy"]
    });
    expect(res).toMatchObject({
      kind: "state",
      text: `[✓] Switched active RPC provider to "alchemy" on ${CHAIN.name}.`,
      active: { [CHAIN_ID]: "alchemy" }
    });
  });

  it("rejects switching to the default (public) provider", () => {
    const res = resolveRpcAction({
      ...withProviders({ alchemy: "https://alchemy.example" }),
      args: ["rpc", "use", "default"]
    });
    expect(res).toEqual({
      kind: "text",
      text: `[!] The default provider is the unstable public RPC. Configure an API-key provider first: rpc alchemy <KEY> or rpc add <name> <url>.`
    });
  });

  it("rejects switching to an unknown provider", () => {
    const res = resolveRpcAction({
      ...withProviders({ alchemy: "https://alchemy.example" }),
      args: ["rpc", "use", "nope"]
    });
    expect(res).toEqual({
      kind: "text",
      text: `[!] Provider "nope" not found for ${CHAIN.name}. Configure it first.`
    });
  });

  it("adds a provider and activates it", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "add", "infura", "https://infura.example"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { infura: "https://infura.example" }
      },
      active: { [CHAIN_ID]: "infura" }
    });
  });

  it("rejects an add with a non-http url", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "add", "bad", "not-a-url"]
    });
    expect(res).toEqual({ kind: "text", text: "Usage: rpc add <name> <url>" });
  });

  it("removes a provider and reverts active to default when it was active", () => {
    const res = resolveRpcAction({
      ...withProviders({ alchemy: "https://alchemy.example" }),
      activeRpcProviders: { [CHAIN_ID]: "alchemy" },
      args: ["rpc", "remove", "alchemy"]
    });
    expect(res).toMatchObject({
      kind: "state",
      text: `[✓] Removed RPC provider "alchemy". Active provider reverted to default if needed.`,
      rpcProviders: { [CHAIN_ID]: {} },
      active: { [CHAIN_ID]: "default" }
    });
  });

  it("removes a provider without touching active when it was not active", () => {
    const res = resolveRpcAction({
      ...withProviders({ alchemy: "https://alchemy.example" }),
      args: ["rpc", "remove", "alchemy"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: { [CHAIN_ID]: {} },
      active: {}
    });
  });

  it("rejects removing the default provider", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "remove", "default"]
    });
    expect(res).toEqual({ kind: "text", text: "Cannot remove default provider." });
  });

  it("rejects removing an unknown provider", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "remove", "nope"]
    });
    expect(res).toEqual({ kind: "text", text: `[!] Provider "nope" not found.` });
  });

  it("builds an alchemy url", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "alchemy", "abc123"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { alchemy: `https://base-mainnet.g.alchemy.com/v2/abc123` }
      },
      active: { [CHAIN_ID]: "alchemy" }
    });
  });

  it("rejects alchemy on an unsupported chain", () => {
    const res = resolveRpcAction({
      ...empty(),
      chainId: 999999,
      chain: { ...CHAIN, id: 999999 },
      args: ["rpc", "alchemy", "abc123"]
    });
    expect(res).toEqual({
      kind: "text",
      text: `[!] Alchemy preset not available for ${CHAIN.name}. Use 'rpc add custom <url>'.`
    });
  });

  it("builds an infura url", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "infura", "abc123"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { infura: `https://base-mainnet.infura.io/v3/abc123` }
      },
      active: { [CHAIN_ID]: "infura" }
    });
  });

  it("builds a quicknode url with a bare endpoint", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "quicknode", "quicknode.example"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { quicknode: "https://quicknode.example" }
      }
    });
  });

  it("keeps a full http quicknode endpoint as-is", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "quicknode", "https://quicknode.example/v1"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { quicknode: "https://quicknode.example/v1" }
      }
    });
  });

  it("registers a custom provider from a bare http arg", () => {
    const res = resolveRpcAction({
      ...empty(),
      args: ["rpc", "https://custom.example"]
    });
    expect(res).toMatchObject({
      kind: "state",
      rpcProviders: {
        [CHAIN_ID]: { custom: "https://custom.example" }
      },
      active: { [CHAIN_ID]: "custom" }
    });
  });
});
