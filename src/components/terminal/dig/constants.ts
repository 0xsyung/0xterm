/**
 * @file constants.ts
 * @description Dig workshop constants — solc pin, error copy, IDB keys (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/**
 * Default solc version pinned after checking binaries.soliditylang.org wasm list
 * (latest stable 0.8.x release as of 2026-09-13): 0.8.37+commit.f401782d
 */
export const DIG_DEFAULT_SOLC_VERSION = "0.8.37";

/** Full longVersion / soljson filename stem for the default pin. */
export const DIG_DEFAULT_SOLC_LONG =
  "0.8.37+commit.f401782d";

export const DIG_DEFAULT_SOLC_PATH =
  `soljson-v${DIG_DEFAULT_SOLC_LONG}.js`;

/** Allowlisted compiler CDN bases — never load arbitrary user URLs. */
export const DIG_SOLC_CDN_BASES = [
  "https://binaries.soliditylang.org/wasm/",
  "https://cdn.jsdelivr.net/gh/ethereum/solc-bin@gh-pages/wasm/"
] as const;

export const DIG_IDB_NAME = "0xterm";
/** Store name for dig workspace (source, version, wasm cache, artifact). */
export const DIG_IDB_STORE = "dig";

export const DIG_OPTIMIZER_ENABLED = false;
export const DIG_OPTIMIZER_RUNS = 200;

export const DIG_ERROR = {
  no_source: "[!] dig.no_source — no source. Type dig new.",
  pragma: "[!] dig.pragma — pragma does not match dig ver.",
  missing_import: "[!] dig.missing_import — imports are v1-local only.",
  load_fail: "[!] dig.load_fail — solc wasm failed to load.",
  compile_fail: "[!] dig.compile_fail",
  no_artifact: "[!] No artifact. Type dig compile."
} as const;

export const DIG_SUBCOMMANDS = [
  "new",
  "open",
  "edit",
  "compile",
  "ver",
  "bytecode",
  "abi",
  "opcodes",
  "artifact",
  "deploy"
] as const;

export type DigSubcommand = (typeof DIG_SUBCOMMANDS)[number];
