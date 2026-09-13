/**
 * @file args.ts
 * @description Dig CLI arg tokenizer + value parser (#40)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/**
 * Tokenize dig args: unquoted words, "quoted strings", [a,b] arrays.
 * Returns null on unbalanced quotes / brackets → dig.arg.
 */
export function tokenizeDigArgs(parts: string[]): string[] | null {
  // Caller already split on whitespace except we re-join for bracket/quote spans
  // that were broken across argv — prefer joining then re-tokenizing when needed.
  const raw = parts.join(" ").trim();
  if (!raw) return [];
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /\s/.test(raw[i]!)) i++;
    if (i >= raw.length) break;
    const ch = raw[i]!;
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let s = "";
      let closed = false;
      while (i < raw.length) {
        if (raw[i] === "\\" && i + 1 < raw.length) {
          s += raw[i + 1];
          i += 2;
          continue;
        }
        if (raw[i] === quote) {
          closed = true;
          i++;
          break;
        }
        s += raw[i];
        i++;
      }
      if (!closed) return null;
      out.push(s);
      continue;
    }
    if (ch === "[") {
      let depth = 0;
      let j = i;
      while (j < raw.length) {
        if (raw[j] === "[") depth++;
        if (raw[j] === "]") {
          depth--;
          if (depth === 0) {
            out.push(raw.slice(i, j + 1));
            i = j + 1;
            break;
          }
        }
        j++;
      }
      if (depth !== 0) return null;
      continue;
    }
    let j = i;
    while (j < raw.length && !/\s/.test(raw[j]!)) j++;
    out.push(raw.slice(i, j));
    i = j;
  }
  return out;
}

/** Parse a single dig arg into ABI-ish JS value. */
export function parseDigValue(token: string): unknown {
  const t = token.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    const parts = splitTopLevelComma(inner);
    if (parts === null) throw new Error("bad array");
    return parts.map((p) => parseDigValue(p));
  }
  if (/^0x[0-9a-fA-F]+$/.test(t)) {
    if (t.length === 42) return t; // address
    return t; // bytes / hex
  }
  if (/^-?\d+$/.test(t)) return BigInt(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}

function splitTopLevelComma(s: string): string[] | null {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inQuote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inQuote) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) {
        cur += s[++i];
        continue;
      }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      cur += ch;
      continue;
    }
    if (ch === "[") {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === "]") {
      depth--;
      if (depth < 0) return null;
      cur += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (depth !== 0 || inQuote) return null;
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Pull `--args …` or bare trailing args; also `--value wei`. */
export function extractDeployArgs(argv: string[]): {
  contractArg?: string;
  ctorArgs: string[];
  valueWei?: bigint;
  error?: "arg";
} {
  const rest = argv.slice(2);
  let valueWei: bigint | undefined;
  const filtered: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--value") {
      const v = rest[++i];
      if (v === undefined || !/^\d+$/.test(v)) return { ctorArgs: [], error: "arg" };
      valueWei = BigInt(v);
      continue;
    }
    if (a.startsWith("--value=")) {
      const v = a.slice("--value=".length);
      if (!/^\d+$/.test(v)) return { ctorArgs: [], error: "arg" };
      valueWei = BigInt(v);
      continue;
    }
    filtered.push(a);
  }
  let contractArg: string | undefined;
  let argTokens: string[] = filtered;
  const argsIdx = filtered.findIndex((x) => x === "--args");
  if (argsIdx >= 0) {
    contractArg = filtered[0] !== "--args" ? filtered[0] : undefined;
    argTokens = filtered.slice(argsIdx + 1);
  } else if (filtered[0] && !filtered[0].startsWith("-")) {
    // first may be Contract name if not a value-looking token used as sole arg
    contractArg = filtered[0];
    argTokens = filtered.slice(1);
  }
  const toks = tokenizeDigArgs(argTokens);
  if (toks === null) return { ctorArgs: [], error: "arg" };
  return { contractArg, ctorArgs: toks, valueWei };
}

export function extractCallArgs(argv: string[], fnIdx = 2): {
  fn?: string;
  args: string[];
  valueWei?: bigint;
  error?: "arg";
} {
  const fn = argv[fnIdx];
  const rest = argv.slice(fnIdx + 1);
  let valueWei: bigint | undefined;
  const filtered: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--value") {
      const v = rest[++i];
      if (v === undefined || !/^\d+$/.test(v)) return { args: [], error: "arg" };
      valueWei = BigInt(v);
      continue;
    }
    if (a.startsWith("--value=")) {
      const v = a.slice("--value=".length);
      if (!/^\d+$/.test(v)) return { args: [], error: "arg" };
      valueWei = BigInt(v);
      continue;
    }
    filtered.push(a);
  }
  const toks = tokenizeDigArgs(filtered);
  if (toks === null) return { fn, args: [], error: "arg" };
  return { fn, args: toks, valueWei };
}
