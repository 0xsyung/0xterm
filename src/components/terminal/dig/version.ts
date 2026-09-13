/**
 * @file version.ts
 * @description Solc version resolve / list helpers (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  DIG_DEFAULT_SOLC_LONG,
  DIG_DEFAULT_SOLC_PATH,
  DIG_DEFAULT_SOLC_VERSION,
  DIG_SOLC_CDN_BASES
} from "./constants";

/** Known pinned versions available without fetching the remote list. */
export const DIG_PINNED_VERSIONS: readonly string[] = [
  DIG_DEFAULT_SOLC_VERSION,
  "0.8.28",
  "0.8.26",
  "0.8.24",
  "0.8.20"
] as const;

const LONG_BY_VERSION: Record<string, string> = {
  "0.8.37": "0.8.37+commit.f401782d",
  "0.8.28": "0.8.28+commit.7893614a",
  "0.8.26": "0.8.26+commit.8a97fa7a",
  "0.8.24": "0.8.24+commit.e11b9ed9",
  "0.8.20": "0.8.20+commit.a1b79de6"
};

export function normalizeSolcVersion(raw: string): string | null {
  const s = raw.trim().replace(/^v/i, "");
  const m = s.match(/^(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

export function resolveSolcLongVersion(version: string): string | null {
  const v = normalizeSolcVersion(version);
  if (!v) return null;
  return LONG_BY_VERSION[v] ?? null;
}

export function solcFilenameFor(version: string): string | null {
  const long = resolveSolcLongVersion(version);
  if (!long) return null;
  return `soljson-v${long}.js`;
}

/** Allowlisted absolute URLs for a version (primary + jsDelivr fallback). */
export function solcUrlsFor(version: string): string[] {
  const path = solcFilenameFor(version);
  if (!path) return [];
  return DIG_SOLC_CDN_BASES.map((base) => `${base}${path}`);
}

export function isPinnedSolcVersion(version: string): boolean {
  const v = normalizeSolcVersion(version);
  return !!v && v in LONG_BY_VERSION;
}

export function defaultSolcVersion(): string {
  return DIG_DEFAULT_SOLC_VERSION;
}

export function defaultSolcPath(): string {
  return DIG_DEFAULT_SOLC_PATH;
}

export function defaultSolcLong(): string {
  return DIG_DEFAULT_SOLC_LONG;
}

/**
 * Pick version from user input against pinned set.
 * Bare major.minor.patch must be in the pin map.
 */
export function pickSolcVersion(raw: string | undefined | null): {
  ok: true;
  version: string;
} | {
  ok: false;
  reason: string;
} {
  if (!raw || !raw.trim()) {
    return { ok: true, version: DIG_DEFAULT_SOLC_VERSION };
  }
  const v = normalizeSolcVersion(raw);
  if (!v) {
    return { ok: false, reason: `[!] Unknown solc version "${raw}".` };
  }
  if (!isPinnedSolcVersion(v)) {
    return {
      ok: false,
      reason: `[!] solc ${v} is not pinned. Try: ${DIG_PINNED_VERSIONS.join(", ")}`
    };
  }
  return { ok: true, version: v };
}

export function formatVersionList(active: string): string {
  const lines = ["[solc versions — wasm]", ""];
  for (const v of DIG_PINNED_VERSIONS) {
    const mark = v === active ? "*" : " ";
    const long = LONG_BY_VERSION[v] || v;
    lines.push(`${mark} ${v}  (${long})`);
  }
  lines.push("", `Active: ${active}`, "Set: dig ver <version>");
  return lines.join("\n");
}
