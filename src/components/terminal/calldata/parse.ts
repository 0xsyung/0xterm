/**
 * @file parse.ts
 * @description calldata fnSig parser — Solidity signature → single-function ABI (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { AbiFunction } from "viem";

export type FnSigParseOutcome =
  | { ok: true; fn: AbiFunction; sig: string }
  | { ok: false; code: "bad_sig"; reason: string };

/**
 * Parse a Solidity-style function signature into a single-function ABI item.
 * Supports elementary types (uintN/intN/address/bool/string/bytesN/bytes),
 * dynamic arrays (T[]), and fixed arrays (T[N]). Tuples are rejected in v1
 * (JSON ABI or known ABI covers those via the widget/known-ABI path).
 */
export function parseFnSig(sig: string): FnSigParseOutcome {
  const s = sig.trim();
  const m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*$/.exec(s);
  if (!m) return { ok: false, code: "bad_sig", reason: "Expected `name(type,type,…)` like `transfer(address,uint256)`." };
  const name = m[1]!;
  const inner = m[2]!.trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name))
    return { ok: false, code: "bad_sig", reason: `Invalid function name "${name}".` };

  const inputs: { name: string; type: string }[] = [];
  if (inner) {
    const parts = splitTopLevelComma(inner);
    if (parts === null) return { ok: false, code: "bad_sig", reason: `Malformed parameter list in "${sig}".` };
    for (let i = 0; i < parts.length; i++) {
      const type = parts[i]!.trim();
      if (!isSolidityType(type))
        return { ok: false, code: "bad_sig", reason: `Unsupported type "${type}" at arg ${i + 1}.` };
      inputs.push({ name: `arg${i + 1}`, type });
    }
  }

  return {
    ok: true,
    sig: `${name}(${inputs.map((x) => x.type).join(",")})`,
    fn: {
      type: "function",
      name,
      inputs,
      outputs: [],
      stateMutability: "nonpayable"
    }
  };
}

const ELEMENTARY =
  /^(address|bool|string|bytes(?:[1-9]|[12][0-9]|3[0-2])?|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)$/;

export function isSolidityType(type: string): boolean {
  const t = type.trim();
  if (ELEMENTARY.test(t)) return true;
  // array suffixes: T[] or T[N] (nested allowed via recursion on the base)
  let base = t;
  while (true) {
    const m = /^(.*)\[(\d*)\]$/.exec(base);
    if (!m) break;
    base = m[1]!;
  }
  return ELEMENTARY.test(base);
}

export function splitTopLevelComma(s: string): string[] | null {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
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
  if (depth !== 0) return null;
  if (cur.trim()) out.push(cur.trim());
  return out;
}
