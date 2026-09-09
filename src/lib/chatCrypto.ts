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

/**
 * 32-byte AES-GCM key from an ECDH shared secret, domain-separated with the
 * two peer identities. `myPub` MUST be our own public key and `peerPublicKey`
 * the OTHER party's; including both — plus the protocol constant — makes the
 * KDF context-bound, so a key derived for one (protocol, peer) pair can never
 * collide with another. Without this, raw `SHA-256(shared)` would let a
 * malicious peer's substitute key produce the exact key an honest peer's key
 * would have (finding C-1).
 *
 * The two public keys are sorted into a canonical order before hashing so both
 * sides of the conversation derive the SAME key regardless of which side calls
 * the function (ECDH shared is symmetric, but an ordered input would not be).
 * Both pubkeys still appear, so the pairing is unambiguous.
 */
export async function deriveAesKey(
  privateKey: bigint,
  peerPublicKey: Uint8Array,
  myPublicKey: Uint8Array
): Promise<CryptoKey> {
  const shared = secp256k1.getSharedSecret(privateKey, peerPublicKey); // 32 bytes
  const [a, b] = compareBytes(myPublicKey, peerPublicKey) <= 0
    ? [myPublicKey, peerPublicKey]
    : [peerPublicKey, myPublicKey];
  const domain = new TextEncoder().encode(KEY_MESSAGE);
  const buf = concatBytes(domain, a, b, shared);
  const h = await crypto.subtle.digest("SHA-256", toArrayBuffer(buf));
  return crypto.subtle.importKey("raw", h, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Split a 65-byte `0x` hex secp256k1 signature (r‖s‖v) into the (v, r, s)
 * tuple the on-chain ecrecover expects. viem returns signatures as
 * `0x` + r(32) + s(32) + v(1) = 130 hex chars; v is the LAST byte, at
 * `slice(128, 130)` — a common off-by-one when slicing. Extracted as a pure
 * helper so the chat handler and tests share one correct parse.
 */
export function splitSignature(sig: string): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const body = sig.startsWith("0x") ? sig.slice(2) : sig;
  return {
    v: Number.parseInt(body.slice(128, 130), 16),
    r: `0x${body.slice(0, 64)}`,
    s: `0x${body.slice(64, 128)}`
  };
}

/**
 * Short human-checkable fingerprint of a 33-byte compressed public key —
 * shown beside chat peers so a swapped/squatted key becomes visible. Stable
 * for a given key; truncated to a small alphabet so it reads like
 * `oH3m-X5qA` rather than raw hex.
 *
 * NOTE: CRC-32 is NOT cryptographic — an attacker can craft a colliding
 * fingerprint. This is a casual out-of-band verification aid only; it is not
 * a security boundary.
 */
export function chatKeyFingerprint(publicKey: Uint8Array, length = 8): string {
  // crc32 of the key bytes → two 16-bit halves → base36 uppercase
  const crc = crc32(publicKey);
  const a = (crc >>> 16).toString(36).toUpperCase().padStart(4, "0");
  const b = (crc & 0xffff).toString(36).toUpperCase().padStart(4, "0");
  const half = Math.max(1, Math.ceil(length / 2));
  return `${a.slice(0, half)}-${b.slice(0, half)}`;
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

/** Concatenate several Uint8Arrays into one (for domain-separated KDF input). */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** Lexicographic comparison of two byte arrays (for canonical KDF ordering). */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Standard CRC-32 (IEEE) — used only for compact fingerprint rendering. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
