/**
 * @file redactSecrets.ts
 * @description Client-side secret redactor — shared by feedback (#19) and
 *   wallet log redaction (#29). Never sends anything anywhere; pure string in,
 *   redacted string + hit kinds out.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { BIP39_ENGLISH_WORDS } from "./bip39words";

export type SecretKind =
  | "privkey"
  | "github_token"
  | "jwt"
  | "rpc_key"
  | "hex_blob"
  | "seed"
  | "vault_json";

// High-confidence hits gate a feedback send behind an explicit typed YES.
export const CONFIRM_REQUIRED_KINDS: ReadonlySet<SecretKind> = new Set([
  "privkey",
  "github_token",
  "seed",
  "vault_json",
  "rpc_key"
]);

const HEX_64 = /\b(?:0x)?[0-9a-fA-F]{64}\b/g;
const GITHUB_TOKEN = /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]+\b/g;
const JWT =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const HEX_BLOB = /\b(?:0x)?[0-9a-fA-F]{128,}\b/g;
const RPC_URL_PATH =
  /(alchemy\.com\/v2\/|infura\.io\/v3\/|quiknode\.pro\/|quiknode\.io\/)([A-Za-z0-9_-]{8,})/g;
const RPC_URL_QUERY =
  /\?([^#&\s]*)(api[_-]?key|apikey|token)=[A-Za-z0-9_-]+/gi;

// Object-shaped secrets: a JSON blob carrying vault keys. Replaced whole.
const VAULT_JSON_KEYS = ["ciphertextB64", "mnemonic", "privateKey"];

function redactMatch(
  source: string,
  regex: RegExp,
  kind: SecretKind,
  replacement: (m: RegExpExecArray) => string
): { text: string; hit: boolean } {
  let text = source;
  let hit = false;
  let m: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((m = regex.exec(text)) !== null) {
    hit = true;
    text = text.slice(0, m.index) + replacement(m) + text.slice(m.index + m[0].length);
    regex.lastIndex = m.index + replacement(m).length;
  }
  return { text, hit };
}

// Replace a standalone 12- or 24-word BIP-39 seed with [redacted:seed].
function redactSeed(text: string): { text: string; hit: boolean } {
  const tokens = text.split(/\s+/);
  const out: string[] = [];
  let hit = false;
  let i = 0;
  while (i < tokens.length) {
    // Consume consecutive wordlist tokens; if we hit 12 or 24 in a row it's a seed.
    let j = i;
    while (
      j < tokens.length &&
      BIP39_ENGLISH_WORDS.has(tokens[j]!.toLowerCase())
    )
      j++;
    const run = j - i;
    if (run === 12 || run === 24) {
      hit = true;
      out.push("[redacted:seed]");
    } else {
      // A run of 0 means this token isn't a wordlist word — advance past it.
      for (let k = i; k < j; k++) out.push(tokens[k]!);
      if (run === 0) out.push(tokens[i]!);
    }
    i = Math.max(i + 1, j);
  }
  // Preserve original whitespace when nothing was redacted (the caller echoes
  // this text back); only rebuild the string when a seed collapsed.
  if (!hit) return { text, hit: false };
  return { text: out.join(" "), hit: true };
}

export type RedactResult = { text: string; hits: SecretKind[] };

/**
 * Redact secrets from arbitrary text. `hits` lists every kind found (deduped,
 * order of the regex pipeline). 40-hex addresses are intentionally NOT
 * redacted from the user body — they may be the bug report.
 */
export function redactSecrets(input: string): RedactResult {
  let text = input;
  const hits = new Set<SecretKind>();

  const apply = (
    regex: RegExp,
    kind: SecretKind,
    replacement: (m: RegExpExecArray) => string
  ) => {
    const r = redactMatch(text, regex, kind, replacement);
    text = r.text;
    if (r.hit) hits.add(kind);
  };

  // Vault JSON must run before the generic hex/privkey regexes so an envelope
  // containing 64-hex keys collapses to a single [redacted:vault_json].
  apply(/\{[^{}]*\}/g, "vault_json", (m) => {
    const body = m[0];
    if (VAULT_JSON_KEYS.some((k) => body.includes(`"${k}"`)))
      return "[redacted:vault_json]";
    return m[0];
  });

  // hex_blob before privkey: a 128+ hex string must collapse whole, not be
  // swallowed piecemeal by the 64-hex pattern.
  apply(HEX_BLOB, "hex_blob", () => "[redacted:hex_blob]");
  apply(HEX_64, "privkey", () => "[redacted:privkey]");
  apply(GITHUB_TOKEN, "github_token", () => "[redacted:github_token]");
  apply(JWT, "jwt", () => "[redacted:jwt]");
  apply(RPC_URL_PATH, "rpc_key", (m) => m[1] + "[redacted:rpc_key]");
  apply(RPC_URL_QUERY, "rpc_key", (m) => `${m[1] ?? ""}${m[2]}=[redacted:rpc_key]`);

  const seed = redactSeed(text);
  text = seed.text;
  if (seed.hit) hits.add("seed");

  return { text, hits: Array.from(hits) };
}

/** True when any hit belongs to the confirm-required high-confidence set. */
export const requireFeedbackConfirm = (hits: SecretKind[]): boolean =>
  hits.some((k) => CONFIRM_REQUIRED_KINDS.has(k));
