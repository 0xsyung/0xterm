/**
 * @file tokenType.test.ts
 * @description Unit tests for ERC-20 / ERC-721 detection with a mocked client
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { base } from "viem/chains";
import { detectTokenType } from "./tokenType";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MOCK_TOKEN = "0x1111111111111111111111111111111111111111";
const MOCK_NFT = "0x2222222222222222222222222222222222222222";

function mockClient(overrides: {
  getCode?: (args: { address: Address }) => Promise<string>;
  readContract?: (args: any) => Promise<any>;
}): PublicClient {
  return {
    getCode: vi.fn(overrides.getCode ?? (async () => "0x1234")),
    // A real viem client throws when a view read fails (empty revert). Default
    // to throwing so unhandled probes behave like production RPC failures.
    readContract: vi.fn(
      overrides.readContract ??
        (async () => {
          throw new Error("execution reverted");
        })
    )
  } as unknown as PublicClient;
}

// SupportsInterface dispatcher: ERC-165 yes, then per args.
function readContractFor(erc721: boolean, erc20: boolean) {
  return async (args: any) => {
    if (args.functionName === "supportsInterface") {
      const id = args.args?.[0] as string;
      if (id === "0x01ffc9a7") return true; // ERC-165
      if (id === "0x80ac58cd") return erc721; // ERC-721
      if (id === "0x36372b07") return erc20; // ERC-20
      return false;
    }
    throw new Error("execution reverted");
  };
}

describe("detectTokenType", () => {
  it("returns the COMMON fast-path for a known token without probing", async () => {
    const client = mockClient({});
    const res = await detectTokenType(client, BASE_USDC, base);
    expect(res).toEqual({ type: "erc20", name: "USD Coin", symbol: "USDC", decimals: 6 });
    expect(client.getCode).not.toHaveBeenCalled();
    expect(client.readContract).not.toHaveBeenCalled();
  });

  it("returns error when getCode throws (RPC failure is not not-a-token)", async () => {
    const client = mockClient({
      getCode: async () => {
        throw new Error("rpc down");
      }
    });
    const res = await detectTokenType(client, MOCK_TOKEN, base);
    expect(res).toEqual({ type: "error" });
  });

  it("returns null when getCode reports empty", async () => {
    const client = mockClient({ getCode: async () => "" });
    const res = await detectTokenType(client, MOCK_TOKEN, base);
    expect(res).toBeNull();
  });

  it("#10: supportsInterface reverts but decimals+totalSupply+symbol+name succeed → erc20", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "supportsInterface") {
          throw new Error("execution reverted: unsupported selector");
        }
        switch (args.functionName) {
          case "decimals":
            return 6n;
          case "totalSupply":
            return 1000n;
          case "symbol":
            return "MOCK";
          case "name":
            return "Mock Token";
          default:
            throw new Error("execution reverted");
        }
      }
    });
    const res = await detectTokenType(client, MOCK_TOKEN, base);
    expect(res).toEqual({ type: "erc20", name: "Mock Token", symbol: "MOCK", decimals: 6 });
  });

  it("returns erc721 when ERC-165 + ERC-721 probe succeeds", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "supportsInterface") {
          const id = args.args?.[0] as string;
          if (id === "0x01ffc9a7") return true;
          if (id === "0x80ac58cd") return true; // is 721
          if (id === "0x36372b07") return false; // not 20
          return false;
        }
        if (args.functionName === "ownerOf") return "0x0000";
        if (args.functionName === "name") return "My NFT";
        if (args.functionName === "symbol") return "NFT";
        return undefined;
      }
    });
    const res = await detectTokenType(client, MOCK_NFT, base);
    expect(res).toEqual({ type: "erc721", name: "My NFT", symbol: "NFT" });
  });

  it("erc20 hint skips the ERC-721 probe and reports error when all ERC-20 reads fail", async () => {
    const client = mockClient({
      getCode: async () => "0x1234",
      readContract: readContractFor(false, false)
    });
    const res = await detectTokenType(client, MOCK_TOKEN, base, "erc20");
    // no erc165, hint skips ownerOf → all erc20 view reads fail on a contract
    // that has code → {type:"error"}, not "not a token".
    expect(res).toEqual({ type: "error" });
  });
});
