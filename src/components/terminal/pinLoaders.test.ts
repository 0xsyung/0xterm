/**
 * @file pinLoaders.test.ts
 * @description Unit tests for pinned billboard / chat refresh loaders
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import type { ChatKeyPair } from "../../lib/chatCrypto";

vi.mock("../../lib/chatCrypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/chatCrypto")>();
  return {
    ...actual,
    deriveAesKey: vi.fn(async () => ({}) as CryptoKey),
    decryptMessage: vi.fn(async () => "hello there")
  };
});

import { fetchBillboard, fetchChatThread } from "./pinLoaders";

const BOARD = "0x1111111111111111111111111111111111111111";
const CHAT = "0x2222222222222222222222222222222222222222";
const ALICE = "0x3333333333333333333333333333333333333333";
const BOB = "0x4444444444444444444444444444444444444444";

type ReadOverride = (args: any) => Promise<any>;

function mockClient(readContract: ReadOverride): PublicClient {
  return { readContract: vi.fn(readContract) } as unknown as PublicClient;
}

describe("fetchBillboard", () => {
  const RAW_POSTS = [
    { author: ALICE, timestamp: 1700000000n, content: "first" },
    { author: BOB, timestamp: 1700000001n, content: "second" }
  ];

  it("returns posts with numeric timestamps, total, pageSize, and onLoadPage", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "postCount") return 2n;
      if (args.functionName === "getLatest") return RAW_POSTS;
      throw new Error("unexpected");
    });
    const res = await fetchBillboard(client, BOARD as `0x${string}`, 5);
    expect(res.total).toBe(2);
    expect(res.pageSize).toBe(5);
    expect(res.posts).toHaveLength(2);
    expect(res.posts[0]).toMatchObject({
      author: ALICE,
      timestamp: 1700000000,
      content: "first"
    });
    expect(typeof res.posts[0].timestamp).toBe("number");
  });

  it("clamps the offset to zero and maps timestamps in onLoadPage", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "postCount") return 0n;
      if (args.functionName === "getLatest") {
        expect(args.args[1]).toBe(BigInt(Math.max(0, -5)));
        return RAW_POSTS;
      }
      throw new Error("unexpected");
    });
    const res = await fetchBillboard(client, BOARD as `0x${string}`, 5);
    const page = await res.onLoadPage(-5);
    expect(page[0].timestamp).toBe(1700000000);
  });

  it("requests the latest posts with the given count", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "postCount") return 1n;
      if (args.functionName === "getLatest") {
        expect(args.args[0]).toBe(10n);
        return [RAW_POSTS[0]];
      }
      throw new Error("unexpected");
    });
    const res = await fetchBillboard(client, BOARD as `0x${string}`, 10);
    expect(res.posts).toHaveLength(1);
  });
});

describe("fetchChatThread", () => {
  const RAW = [
    {
      from: ALICE,
      timestamp: 1700000000n,
      iv: "0x00",
      senderKey: "0x01",
      ciphertext: "0x02"
    }
  ];

  const deps = {
    getChatKeyPair: async (): Promise<ChatKeyPair> => ({
      privateKey: 1n,
      publicKey: new Uint8Array([1])
    }),
    ensNameFor: async (addr: string) => (addr === ALICE ? "alice.eth" : null)
  };

  it("reads the thread, decrypts each message, and resolves the peer label", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "threadCount") return 1n;
      if (args.functionName === "getThread") return RAW;
      throw new Error("unexpected");
    });
    const res = await fetchChatThread(
      client,
      CHAT as `0x${string}`,
      BOB as `0x${string}`,
      ALICE as `0x${string}`,
      deps
    );
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]).toMatchObject({
      from: ALICE,
      timestamp: 1700000000,
      decrypted: "hello there"
    });
    expect(res.peer).toBe(ALICE);
    expect(res.self).toBe(BOB);
    expect(res.peerLabel).toBe("alice.eth");
  });

  it("marks messages decryptFailed when decryption throws", async () => {
    const { decryptMessage } = await import("../../lib/chatCrypto");
    vi.mocked(decryptMessage).mockRejectedValueOnce(new Error("bad tag"));
    const client = mockClient(async (args: any) => {
      if (args.functionName === "threadCount") return 1n;
      if (args.functionName === "getThread") return RAW;
      throw new Error("unexpected");
    });
    const res = await fetchChatThread(
      client,
      CHAT as `0x${string}`,
      BOB as `0x${string}`,
      ALICE as `0x${string}`,
      deps
    );
    expect(res.messages[0].decryptFailed).toBe(true);
    expect(res.messages[0].decrypted).toBeUndefined();
  });

  it("omits the peer label when ensNameFor returns null", async () => {
    const client = mockClient(async (args: any) => {
      if (args.functionName === "threadCount") return 0n;
      if (args.functionName === "getThread") return [];
      throw new Error("unexpected");
    });
    const res = await fetchChatThread(
      client,
      CHAT as `0x${string}`,
      ALICE as `0x${string}`,
      BOB as `0x${string}`,
      { ...deps, ensNameFor: async () => null }
    );
    expect(res.messages).toHaveLength(0);
    expect(res.peerLabel).toBeUndefined();
  });
});
