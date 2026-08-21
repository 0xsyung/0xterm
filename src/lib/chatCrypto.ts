/**
 * @file chatCrypto.ts
 * @description ECDH + AES-GCM encryption for on-chain 1:1 chat. Messages are
 *              encrypted in the browser; only ciphertext (iv + blob) is ever
 *              stored on-chain. No key exchange needed — both sides derive the
 *              same shared secret from their own wallet signature + the peer's
 *              deterministic public key.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { hashMessage } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";

/** Fixed string signed by the wallet to derive the messaging key pair. */
export const KEY_MESSAGE = "0xterm.chat.v1";

export type ChatKeyPair = {
  privateKey: bigint; // secp256k1 scalar (from the signature KDF)
  publicKey: Uint8Array; // 33-byte compressed
};

// --- key derivation -------------------------------------------------------

/** Hash the raw 65-byte wallet signature into a valid secp256k1 scalar. */
async function signatureToPrivateKey(signature: string): Promise<bigint> {
  const sigBytes = hexToBytes(hashMessage(signature).slice(2) + "00"); // pad to 65 bytes
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(sigBytes));
  return secp256k1.utils.normPrivateKeyToScalar(new Uint8Array(digest));
}

/** Derive the deterministic messaging key pair for a wallet signature. */
export async function deriveKeysFromSignature(signature: string): Promise<ChatKeyPair> {
  const privateKey = await signatureToPrivateKey(signature);
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  return { privateKey, publicKey };
}

// --- shared secret (ECDH) -------------------------------------------------

/** 32-byte AES-GCM key derived from an ECDH shared secret. */
export async function deriveAesKey(privateKey: bigint, peerPublicKey: Uint8Array): Promise<CryptoKey> {
  const shared = secp256k1.getSharedSecret(privateKey, peerPublicKey); // Uint8Array
  const h = await crypto.subtle.digest("SHA-256", toArrayBuffer(shared));
  return crypto.subtle.importKey("raw", h, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// --- encrypt / decrypt ----------------------------------------------------

export type EncryptedPayload = {
  iv: Uint8Array; // 12-byte AES-GCM nonce
  ciphertext: Uint8Array; // ciphertext ‖ auth tag
};

export async function encryptMessage(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // unique per message
  const data = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decryptMessage(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(payload.iv) },
    key,
    toArrayBuffer(payload.ciphertext)
  );
  return new TextDecoder().decode(pt);
}

// --- byte helpers ---------------------------------------------------------

/** Encode bytes as 0x-prefixed hex (matches the on-chain ABI encoding). */
export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Copy into a fresh ArrayBuffer so `crypto.subtle` accepts it as BufferSource. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
