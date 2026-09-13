/**
 * @file pragma.ts
 * @description SPDX + pragma solidity parse and version match (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type PragmaRange = {
  raw: string;
  /** Normalized comparator clauses, e.g. [{op:'^', version:'0.8.37'}] */
  clauses: Array<{ op: string; version: string }>;
};

const SPDX_RE = /SPDX-License-Identifier\s*:/i;
const PRAGMA_RE =
  /pragma\s+solidity\s+([^;]+);/i;

/** Parse `x.y.z` (optional leading `v`) into [major, minor, patch]. */
export function parseSemver(
  raw: string
): [number, number, number] | null {
  const m = String(raw)
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(
  a: [number, number, number],
  b: [number, number, number]
): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function matchesClause(
  selected: [number, number, number],
  op: string,
  targetRaw: string
): boolean {
  const target = parseSemver(targetRaw);
  if (!target) return false;
  const c = cmpSemver(selected, target);
  switch (op) {
    case "":
    case "=":
      return c === 0;
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case "^": {
      // Compatible with target: >= target && < next breaking (major for >=1, else minor)
      if (c < 0) return false;
      if (target[0] > 0) {
        return selected[0] === target[0];
      }
      if (target[1] > 0) {
        return selected[0] === 0 && selected[1] === target[1];
      }
      return (
        selected[0] === 0 &&
        selected[1] === 0 &&
        selected[2] === target[2]
      );
    }
    case "~": {
      // Approx: >= target and < next minor (npm-style)
      if (c < 0) return false;
      if (selected[0] !== target[0] || selected[1] !== target[1]) return false;
      return true;
    }
    default:
      return false;
  }
}

/**
 * Extract pragma solidity range from source. Returns null if missing.
 */
export function parsePragma(source: string): PragmaRange | null {
  const m = source.match(PRAGMA_RE);
  if (!m) return null;
  const raw = m[1].trim();
  const clauses: PragmaRange["clauses"] = [];
  // Split on whitespace / || — v1 treats space-separated as AND (solc style)
  const parts = raw.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (part === "||") continue; // OR not fully modeled; treat next as additional
    const cm = part.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(\d+\.\d+\.\d+)/i);
    if (!cm) continue;
    clauses.push({ op: cm[1] || "=", version: cm[2] });
  }
  if (clauses.length === 0) return null;
  return { raw, clauses };
}

export function hasSpdx(source: string): boolean {
  return SPDX_RE.test(source);
}

/**
 * True when selected compiler version satisfies the pragma range.
 * Missing pragma → false (caller emits dig.pragma / requires pragma).
 */
export function pragmaMatchesVersion(
  source: string,
  selectedVersion: string
): boolean {
  const range = parsePragma(source);
  if (!range) return false;
  const selected = parseSemver(selectedVersion);
  if (!selected) return false;
  // AND all clauses (simple solc pragma without ||)
  if (/\|\|/.test(range.raw)) {
    // OR groups: split on || and succeed if any group matches (all ANDs in group)
    const groups = range.raw.split(/\|\|/);
    return groups.some((g) => {
      const parts = g.trim().split(/\s+/).filter(Boolean);
      const groupClauses: Array<{ op: string; version: string }> = [];
      for (const part of parts) {
        const cm = part.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(\d+\.\d+\.\d+)/i);
        if (cm) groupClauses.push({ op: cm[1] || "=", version: cm[2] });
      }
      return (
        groupClauses.length > 0 &&
        groupClauses.every((cl) => matchesClause(selected, cl.op, cl.version))
      );
    });
  }
  return range.clauses.every((cl) =>
    matchesClause(selected, cl.op, cl.version)
  );
}

/** Detect `import "..."` / `import '...'` — v1 has no multi-file workspace. */
export function findImports(source: string): string[] {
  const out: string[] = [];
  const re = /import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push(m[1]);
  }
  return out;
}
