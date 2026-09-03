/**
 * @file probeToken.test.ts
 * @description Unit tests for on-chain interface probing (`is` command)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import {
  formatProbeReport,
  probeCoreFunctions,
  probeErc165,
  probeTokenMeta
} from "./probeToken";

const ADDR = "0x1111111111111111111111111111111111111111" as Address;

function mockClient(overrides: { readContract?: (args: any) => Promise<any> } = {}): PublicClient {
  return {
    readContract: vi.fn(overrides.readContract ?? (async () => { throw new Error("reverted"); }))
  } as unknown as PublicClient;
}

describe("probeErc165", () => {
  it("reports erc165 supported and interface supported for a real token", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "supportsInterface" && args.args[0] === "0x01ffc9a7") return true;
        if (args.functionName === "supportsInterface") return true;
        throw new Error("unexpected");
      }
    });
    const res = await probeErc165(client, ADDR, false);
    expect(res).toMatchObject({ erc165: true, interfaceSupported: true, wantsId: "0x36372b07" });
  });

  it("returns wantsId for erc721 and false when interface not supported", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.args[0] === "0x01ffc9a7") return true;
        return false;
      }
    });
    const res = await probeErc165(client, ADDR, true);
    expect(res).toMatchObject({ erc165: true, interfaceSupported: false, wantsId: "0x80ac58cd" });
  });

  it("swallows read errors for erc165 and interface probe", async () => {
    const client = mockClient({ readContract: async () => { throw new Error("reverted"); } });
    const res = await probeErc165(client, ADDR, false);
    expect(res).toMatchObject({ erc165: false, interfaceSupported: false });
  });

  it("skips the interface probe when erc165 is false", async () => {
    const client = mockClient({ readContract: async () => false });
    const res = await probeErc165(client, ADDR, false);
    expect(res.interfaceSupported).toBe(false);
    expect(client.readContract).toHaveBeenCalledTimes(1);
  });
});

describe("probeCoreFunctions", () => {
  it("verifies all erc20 view functions when reads succeed", async () => {
    const client = mockClient({ readContract: async () => 1n });
    const res = await probeCoreFunctions(client, ADDR, false);
    expect(res.verified).toHaveLength(3);
    expect(res.checks).toHaveLength(0);
  });

  it("records failures as checks for erc20", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "totalSupply") return 1n;
        throw new Error("reverted");
      }
    });
    const res = await probeCoreFunctions(client, ADDR, false);
    expect(res.verified).toHaveLength(1);
    expect(res.checks).toHaveLength(2);
  });

  it("probes ownerOf twice then balanceOf for erc721", async () => {
    const client = mockClient({ readContract: async () => "0x" });
    const res = await probeCoreFunctions(client, ADDR, true);
    expect(res.verified).toHaveLength(3);
    expect(res.verified[0]).toContain("ownerOf(0)");
    expect(res.verified[1]).toContain("ownerOf(1)");
  });

  it("handles a fully non-callable contract", async () => {
    const client = mockClient({ readContract: async () => { throw new Error("reverted"); } });
    const res = await probeCoreFunctions(client, ADDR, false);
    expect(res.verified).toHaveLength(0);
    expect(res.checks).toHaveLength(3);
  });
});

describe("probeTokenMeta", () => {
  it("formats symbol and name metadata", async () => {
    const client = mockClient({
      readContract: async (args: any) => (args.functionName === "symbol" ? "USDC" : "USD Coin")
    });
    expect(await probeTokenMeta(client, ADDR)).toBe(" (USD Coin / USDC)");
  });

  it("returns empty meta when reads fail", async () => {
    const client = mockClient({ readContract: async () => { throw new Error("reverted"); } });
    expect(await probeTokenMeta(client, ADDR)).toBe("");
  });
});

describe("formatProbeReport", () => {
  const base = {
    address: ADDR,
    chainName: "Base",
    erc165: true,
    interfaceSupported: false,
    wantsId: "0x36372b07",
    isErc721: false,
    verified: [] as string[],
    checks: [] as string[],
    meta: ""
  };

  it("reports a valid contract when all core functions pass", () => {
    const lines = formatProbeReport({ ...base, verified: ["totalSupply() → uint256", "balanceOf(address) → uint256", "allowance(address,address) → uint256"], erc165: true, interfaceSupported: true });
    expect(lines.join("\n")).toContain("appears to be a valid ERC-20 contract");
  });

  it("reports partial characteristics when some core functions pass", () => {
    const lines = formatProbeReport({ ...base, verified: ["totalSupply() → uint256"], checks: ["balanceOf(address) → uint256", "allowance(address,address) → uint256"] });
    expect(lines.join("\n")).toContain("has some ERC-20 characteristics but is missing");
  });

  it("reports not-a-contract when no core functions pass", () => {
    const lines = formatProbeReport({ ...base, checks: ["totalSupply() → uint256", "balanceOf(address) → uint256", "allowance(address,address) → uint256"] });
    expect(lines.join("\n")).toContain("does not look like a ERC-20 contract");
  });

  it("uses ERC-721 wording for nft", () => {
    const lines = formatProbeReport({ ...base, isErc721: true, verified: ["ownerOf(0) → address", "ownerOf(1) → address", "balanceOf(address) → uint256"] });
    expect(lines.join("\n")).toContain("appears to be a valid ERC-721 (NFT) contract");
  });
});
