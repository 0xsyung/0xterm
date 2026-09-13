/**
 * @file constants.ts
 * @description Dig workshop constants — solc pin, error copy, IDB keys (#39/#40)
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

/** VM hardfork pin for dig env vm (#40). */
export const DIG_VM_HARDFORK = "cancun" as const;

/** Prefunded VM test account (session-only; no real keys). */
export const DIG_VM_TEST_ACCOUNT =
  "0x1234567890123456789012345678901234567890" as const;

export const DIG_ERROR = {
  no_source: "[!] dig.no_source — no source. Type dig new.",
  pragma: "[!] dig.pragma — pragma does not match dig ver.",
  missing_import: "[!] dig.missing_import — imports are v1-local only.",
  load_fail: "[!] dig.load_fail — solc wasm failed to load.",
  compile_fail: "[!] dig.compile_fail",
  no_artifact: "[!] dig.no_artifact — no artifact. Type dig compile.",
  no_address: "[!] dig.no_address — no contract. Type dig deploy or dig at <addr>.",
  bad_fn: (fn: string) => `[!] dig.bad_fn — ${fn} is not in the ABI.`,
  arg: "[!] dig.arg — could not encode args.",
  vm_fail: (reason: string) => `[!] dig.vm_fail — ${reason}.`,
  reverted: (reason: string) => `[!] dig.reverted — ${reason}.`,
  need_wallet: "[!] dig.need_wallet — connect or dig env vm.",
  reserved: (name: string) =>
    `[!] dig.reserved — ${name} is the clone path. Rename the contract or use dig deploy <file:Contract>.`
} as const;

export const DIG_RESERVED_DEPLOY = ["erc20", "erc721"] as const;

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
  "deploy",
  "env",
  "at",
  "ls",
  "fn",
  "call",
  "send",
  "logs",
  "gas",
  "receipt"
] as const;

export type DigSubcommand = (typeof DIG_SUBCOMMANDS)[number];

export type DigEnvKind = "vm" | "injected" | "local";
