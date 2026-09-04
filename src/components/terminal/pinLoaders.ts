/**
 * @file pinLoaders.ts
 * @description Pure refresh loaders for pinned billboard / chat widgets
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, PublicClient } from "viem";
import { billboardAbi, chatAbi } from "./constants";
import {
  deriveAesKey,
  decryptMessage,
  hexToBytes,
  type ChatKeyPair
} from "../../lib/chatCrypto";
import type { BillboardPost } from "./widgets/BillboardWidget";
import type { ChatMessage } from "./widgets/ChatWidget";

export type BillboardRefresh = {
  posts: BillboardPost[];
  total: number;
  pageSize: number;
  onLoadPage: (offset: number) => Promise<BillboardPost[]>;
};

// Read the latest billboard posts + total. `onLoadPage` re-queries the same
// contract for older pages (used by the widget's pager).
export const fetchBillboard = async (
  client: PublicClient,
  contract: Address,
  count: number
): Promise<BillboardRefresh> => {
  const total = (await client.readContract({
    address: contract,
    abi: billboardAbi,
    functionName: "postCount"
  })) as bigint;
  const posts = ((await client.readContract({
    address: contract,
    abi: billboardAbi,
    functionName: "getLatest",
    args: [BigInt(count), 0n]
  })) as unknown as BillboardPost[]).map((x) => ({
    ...x,
    timestamp: Number(x.timestamp)
  }));
  return {
    posts,
    total: Number(total),
    pageSize: count,
    onLoadPage: (offset: number) =>
      client
        .readContract({
          address: contract,
          abi: billboardAbi,
          functionName: "getLatest",
          args: [BigInt(count), BigInt(Math.max(0, offset))]
        })
        .then((r) =>
          (r as unknown as BillboardPost[]).map((x) => ({
            ...x,
            timestamp: Number(x.timestamp)
          }))
        )
  };
};

type RawChatMsg = {
  from: Address;
  timestamp: bigint;
  iv: `0x${string}`;
  senderKey: `0x${string}`;
  ciphertext: `0x${string}`;
};

export type ChatThreadRefreshDeps = {
  getChatKeyPair: () => Promise<ChatKeyPair>;
  ensNameFor: (addr: string) => Promise<string | null>;
};

export type ChatThreadRefresh = {
  messages: ChatMessage[];
  peer: Address;
  self: Address;
  peerLabel?: string;
};

// Read + decrypt one 1:1 chat thread. Signing (getChatKeyPair) and ENS lookup
// are injected so this stays pure; the crypto helpers are module-level.
export const fetchChatThread = async (
  client: PublicClient,
  contract: Address,
  self: Address,
  peer: Address,
  deps: ChatThreadRefreshDeps
): Promise<ChatThreadRefresh> => {
  const count = (await client.readContract({
    address: contract,
    abi: chatAbi,
    functionName: "threadCount",
    args: [self, peer]
  })) as bigint;
  const msgs = (await client.readContract({
    address: contract,
    abi: chatAbi,
    functionName: "getThread",
    args: [self, peer, 0n, count]
  })) as readonly RawChatMsg[];
  const myPair = await deps.getChatKeyPair();
  const messages: ChatMessage[] = [];
  for (const m of msgs) {
    try {
      const iv = hexToBytes(m.iv);
      const ct = hexToBytes(m.ciphertext);
      const senderPub = hexToBytes(m.senderKey);
      const aesKey = await deriveAesKey(myPair.privateKey, senderPub);
      const text = await decryptMessage(aesKey, { iv, ciphertext: ct });
      messages.push({
        from: m.from,
        timestamp: Number(m.timestamp),
        iv: m.iv,
        ciphertext: m.ciphertext,
        decrypted: text
      });
    } catch {
      messages.push({
        from: m.from,
        timestamp: Number(m.timestamp),
        iv: m.iv,
        ciphertext: m.ciphertext,
        decryptFailed: true
      });
    }
  }
  const peerLabel = (await deps.ensNameFor(peer)) || undefined;
  return { messages, peer, self, peerLabel };
};
