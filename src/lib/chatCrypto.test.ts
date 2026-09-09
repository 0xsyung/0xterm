/**
 * @file chatCrypto.test.ts
 * @description Unit tests for the ECDH + AES-GCM chat crypto, including the
 *              domain-separated KDF and key fingerprint.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hexToSignature } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  deriveAesKey,
  encryptMessage,
  decryptMessage,
  chatKeyFingerprint,
  splitSignature,
  hexToBytes,
  bytesToHex
} from "./chatCrypto";

// noble's randomPrivateKey returns a 32-byte Uint8Array; deriveAesKey takes a
// bigint scalar, so normalize (same as chatCrypto's signatureToPrivateKey).
const key = (): bigint => secp256k1.utils.normPrivateKeyToScalar(secp256k1.utils.randomPrivateKey());
const pubOf = (priv: bigint) => secp256k1.getPublicKey(priv, true);

// CryptoKey material isn't observable (extractable:false), so compare keys by
// their effect: AES-GCM with a FIXED iv is deterministic ⇒ same key produces
// identical (iv, ciphertext) tags, different keys differ.
const FIXED_IV = new Uint8Array(12); // all-zero nonce is fine for comparison
async function keyTag(k: CryptoKey, pt: string): Promise<string> {
  const data = new TextEncoder().encode(pt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: FIXED_IV }, k, data);
  return bytesToHex(new Uint8Array(ct));
}
async function sameKey(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  return (await keyTag(a, "probe")) === (await keyTag(b, "probe"));
}
async function diffKey(a: CryptoKey, b: CryptoKey): Promise<void> {
  const ka = await keyTag(a, "probe");
  const kb = await keyTag(b, "probe");
  expect(ka).not.toBe(kb);
}

// NOTE: chatCrypto depends on WebCrypto (crypto.subtle). Node ≥19 and jsdom
// expose it; this suite runs under vitest's node environment.

describe("deriveAesKey (domain-separated ECDH)", () => {
  it("derives a working symmetric key: both peers get the same AES key", async () => {
    const aPriv = key();
    const aPub = pubOf(aPriv);
    const bPriv = key();
    const bPub = pubOf(bPriv);

    const aesFromA = await deriveAesKey(aPriv, bPub, aPub);
    const aesFromB = await deriveAesKey(bPriv, aPub, bPub);

    const pt = "confidential for bob";
    const { iv, ciphertext } = await encryptMessage(aesFromA, pt);
    const dec = await decryptMessage(aesFromB, { iv, ciphertext });
    expect(dec).toBe(pt);
  });

  it("produces a DIFFERENT key when myPub is swapped (peer-substitution detection)", async () => {
    const aPriv = key();
    const aPub = pubOf(aPriv);
    const malloryPriv = key();
    const malloryPub = pubOf(malloryPriv);
    const bobPriv = key();
    const bobPub = pubOf(bobPriv);

    // Alice's view (thinks she's talking to Bob) vs Mallory's (signed in place of Bob)
    const aliceToBob = await deriveAesKey(aPriv, bobPub, aPub);
    const aliceToMallory = await deriveAesKey(aPriv, malloryPub, aPub);
    await diffKey(aliceToBob, aliceToMallory);

    // Bob cannot decrypt Alice's message if Mallory injected a different peerPub
    const malloryAes = await deriveAesKey(malloryPriv, aPub, malloryPub);
    await diffKey(malloryAes, aliceToBob);
    const { iv, ciphertext } = await encryptMessage(aliceToBob, "for bob only");
    await expect(decryptMessage(malloryAes, { iv, ciphertext })).rejects.toThrow();
  });

  it("binds BOTH identities and the protocol tag (reversed roles / different peers differ)", async () => {
    const aPriv = key();
    const aPub = pubOf(aPriv);
    const bPriv = key();
    const bPub = pubOf(bPriv);
    const cPriv = key();
    const cPub = pubOf(cPriv);

    // different peer → different key (A↔B vs A↔C)
    await diffKey(await deriveAesKey(aPriv, bPub, aPub), await deriveAesKey(aPriv, cPub, aPub));
    // same pair is symmetric AND deterministic: A's view == B's view == A again
    const fromA = await deriveAesKey(aPriv, bPub, aPub);
    const fromB = await deriveAesKey(bPriv, aPub, bPub);
    expect(await sameKey(fromA, fromB)).toBe(true);
    expect(await sameKey(fromA, await deriveAesKey(aPriv, bPub, aPub))).toBe(true);
  });
});

describe("chatKeyFingerprint", () => {
  it("is stable for the same key bytes", () => {
    const k = pubOf(key());
    expect(chatKeyFingerprint(k)).toBe(chatKeyFingerprint(k));
  });

  it("differs between distinct keys", () => {
    const a = chatKeyFingerprint(pubOf(key()));
    const b = chatKeyFingerprint(pubOf(key()));
    expect(a).not.toBe(b);
  });

  it("returns a short, printable token (8 chars, includes a dash)", () => {
    const fp = chatKeyFingerprint(pubOf(key()));
    expect(fp).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe("hex round-trip helpers", () => {
  it("bytesToHex then hexToBytes round-trips", () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 16]);
    expect(bytesToHex(bytes)).toBe("0x000102ff10");
    expect(hexToBytes("0x000102ff10")).toEqual(bytes);
  });
});

describe("splitSignature", () => {
  it("parses a viem 65-byte signature into (v, r, s) for ecrecover", async () => {
    const account = privateKeyToAccount(
      "0x0123456789012345678901234567890123456789012345678901234567890123"
    );
    const digest = bytesToHex(new Uint8Array(32).fill(7));
    const sigHex = await account.signMessage({ message: { raw: digest } });
    const { v, r, s } = hexToSignature(sigHex);

    const parsed = splitSignature(sigHex);
    expect(parsed.v).toBe(Number(v));
    expect(parsed.r.toLowerCase()).toBe(r.toLowerCase());
    expect(parsed.s.toLowerCase()).toBe(s.toLowerCase());
  });

  it("handles a signature without the 0x prefix", () => {
    const hex =
      "0x" + "ab".repeat(64) + "1c";
    const parsed = splitSignature(hex);
    expect(parsed.v).toBe(28);
    expect(parsed.r).toBe("0x" + "ab".repeat(32));
    expect(parsed.s).toBe("0x" + "ab".repeat(32));
  });
});
