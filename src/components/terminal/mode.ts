/**
 * @file mode.ts
 * @description Terminal mode ids, aliases, command gating, help grouping (#54)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/** Purpose lens — not theme. Exactly three in v1 (issue Decision table). */
export type TerminalMode = "invest" | "dev" | "forensic";

export const MODE_ORDER: readonly TerminalMode[] = [
  "invest",
  "dev",
  "forensic"
] as const;

export const DEFAULT_MODE: TerminalMode = "invest";

export const MODE_STORAGE_KEY = "0xterm.mode";

/** Chip / ack display label (status only, no teaching parens). */
export const MODE_LABEL: Record<TerminalMode, string> = {
  invest: "INVEST",
  dev: "DEV",
  forensic: "FORENSIC"
};

/** One-line blurb after switch ack. */
export const MODE_BLURB: Record<TerminalMode, string> = {
  invest: "prices, portfolio, DEX, plans",
  dev: "compile, run, debug, deploy",
  forensic: "KYT, KYA, sim, address & tx analysis"
};

/** Boot hint under the version line — mode once, no clutter. */
export const MODE_BOOT_HINT: Record<TerminalMode, string> = {
  invest: "type help · mode · connect · price",
  dev: "type help · mode · deploy · is",
  forensic: "type help · mode · kyt · kya"
};

/**
 * Switch aliases → canonical id.
 * invest: trade, i | dig: workshop, d | forensic: dig, trace, f
 * Canonical ids also resolve to themselves.
 */
const MODE_ALIAS_TO_ID: Record<string, TerminalMode> = {
  invest: "invest",
  trade: "invest",
  i: "invest",
  dev: "dev",
  workshop: "dev",
  d: "dev",
  forensic: "forensic",
  dig: "forensic",
  trace: "forensic",
  f: "forensic"
};

export type CommandAffinity =
  | "global"
  | "invest"
  | "dev"
  | "forensic"
  | "shared"; // dev ∩ forensic (is / info)

/**
 * Live (+ known planned) verb classification.
 * Aliases listed separately so gating resolves via canonical or alias key.
 * Unknown verbs are treated as unrecognized by the shell (not wrong-mode).
 */
const COMMAND_AFFINITY: Record<string, CommandAffinity> = {
  // —— global ——
  help: "global",
  "?": "global",
  mode: "global",
  modes: "global",
  theme: "global",
  style: "global",
  connect: "global",
  disconnect: "global",
  networks: "global",
  network: "global",
  net: "global",
  nets: "global",
  rpc: "global",
  export: "global",
  import: "global",
  exp: "global",
  imp: "global",
  tokens: "global",
  register: "global",
  reg: "global",
  ens: "global",
  chat: "global",
  inbox: "global",
  chatfee: "global",
  board: "global",
  boardfee: "global",
  channel: "global",
  channels: "global",
  clear: "global",
  msg: "global",
  messages: "global",
  rain: "global",
  feedback: "global",
  bind: "global",
  wallet: "global",
  ipfs: "global",
  share: "global",
  unshare: "global",
  look: "global",
  feed: "global",

  // —— invest ——
  price: "invest",
  pool: "invest",
  liquidity: "invest",
  swap: "invest",
  dexes: "invest",
  dex: "invest",
  balance: "invest",
  bal: "invest",
  portfolio: "invest",
  snapshot: "invest",
  pnl: "invest",
  createpool: "invest",
  getpool: "invest",
  findpool: "invest",
  initialize: "invest",
  initpool: "invest",
  addliq: "invest",
  provideliq: "invest",
  ticker: "invest",
  news: "invest",
  vault: "invest",
  poly: "invest",
  plan: "invest",
  when: "invest",
  will: "invest",
  arb: "invest",

  // —— dev ——
  deploy: "dev",
  dev: "dev",
  solc: "dev",

  // —— forensic ——
  kyt: "forensic",
  kya: "forensic",
  sim: "forensic",
  trace: "forensic",

  // —— shared dig ∩ forensic ——
  is: "shared",
  info: "shared"
};

/**
 * Forensic read-only helpers: invest verbs also allowed in forensic (view).
 * Blocked in forensic: swap / createpool / addliq / initialize / arb / plan execute.
 */
const FORENSIC_READ_HELPERS = new Set([
  "price",
  "balance",
  "bal",
  "portfolio"
]);

/** Invest verbs that stay invest-only (explicit forensic block list + siblings). */
const FORENSIC_BLOCKED_INVEST = new Set([
  "swap",
  "createpool",
  "addliq",
  "provideliq",
  "initialize",
  "initpool",
  "arb",
  "plan",
  "getpool",
  "findpool",
  "pool",
  "liquidity",
  "dex",
  "dexes",
  "snapshot",
  "pnl",
  "ticker",
  "news",
  "vault",
  "poly",
  "when",
  "will"
]);

export function isTerminalMode(value: unknown): value is TerminalMode {
  return value === "invest" || value === "dev" || value === "forensic";
}

/** Resolve `mode <name>` / alias → canonical id, or null if unknown. */
export function resolveModeId(raw: string | null | undefined): TerminalMode | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return MODE_ALIAS_TO_ID[key] ?? null;
}

export function loadMode(
  storage: Pick<Storage, "getItem"> | null | undefined
): TerminalMode {
  try {
    const raw = storage?.getItem(MODE_STORAGE_KEY);
    const resolved = resolveModeId(raw);
    return resolved ?? DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMode(
  storage: Pick<Storage, "setItem"> | null | undefined,
  mode: TerminalMode
): void {
  try {
    storage?.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // privacy mode / quota — non-fatal
  }
}

export function commandAffinity(cmd: string): CommandAffinity | null {
  const key = cmd.trim().toLowerCase();
  if (!key) return null;
  return COMMAND_AFFINITY[key] ?? null;
}

/**
 * Fail-closed gate. Unknown verbs return true so the shell can emit
 * "Command not recognized" (same as today); only classified out-of-mode verbs
 * are blocked here.
 */
export function isCommandAllowed(mode: TerminalMode, cmd: string): boolean {
  const key = cmd.trim().toLowerCase();
  const affinity = commandAffinity(key);
  if (affinity === null) return true;
  if (affinity === "global") return true;
  if (affinity === "shared") return mode === "dev" || mode === "forensic";
  if (affinity === mode) return true;
  // Forensic may run a small invest read-helper set
  if (
    mode === "forensic" &&
    affinity === "invest" &&
    FORENSIC_READ_HELPERS.has(key)
  ) {
    return true;
  }
  return false;
}

/** Primary home mode for wrong-mode messaging / CHOICES. */
export function homeModeForCommand(cmd: string): TerminalMode {
  const affinity = commandAffinity(cmd);
  if (affinity === "shared") return "dev";
  if (affinity === "dev") return "dev";
  if (affinity === "forensic") return "forensic";
  if (affinity === "invest") return "invest";
  return "invest";
}

export function wrongModeMessage(cmd: string): string {
  const home = homeModeForCommand(cmd);
  const label = MODE_LABEL[home];
  const article = /^[AEIOU]/i.test(label) ? "an" : "a";
  return `[!] \`${cmd}\` is ${article} ${label} command. Type \`mode ${home}\` or \`help\`.`;
}

export function modeSwitchAck(mode: TerminalMode): string {
  return `[✓] Mode → ${MODE_LABEL[mode]} — ${MODE_BLURB[mode]}`;
}

export function modeStatusText(mode: TerminalMode): string {
  const lines = [
    `Mode: ${MODE_LABEL[mode]} — ${MODE_BLURB[mode]}`,
    "",
    "Modes:",
    ...MODE_ORDER.map(
      (m) =>
        `${m === mode ? "*" : " "} ${MODE_LABEL[m].padEnd(9)} (${m}) — ${MODE_BLURB[m]}`
    ),
    "",
    "Switch: mode <invest|dev|forensic>  (aliases: trade/i, workshop/d, dig/trace/f)"
  ];
  return lines.join("\n");
}

/** CHOICES labels when tapping the MODE chip (no cycle-on-tap). */
export function modeChoiceCommands(): string[] {
  return MODE_ORDER.map((m) => `mode ${m}`);
}

/** Filter autocomplete / Tab candidates to global ∪ current mode. */
export function filterCommandsForMode(
  mode: TerminalMode,
  commands: readonly string[]
): string[] {
  return commands.filter((c) => isCommandAllowed(mode, c));
}

export type HelpRowMode = "global" | TerminalMode | "shared";

export type HelpRow = {
  command: string;
  description: string;
  /** Where the row appears: global always; else matching mode (shared → dev+forensic). */
  modes: HelpRowMode[];
};

/**
 * Help manual rows. `help` shows global ∪ current mode (shared probes in dev/forensic).
 * Keep in sync with live verbs; planned verbs may appear as documentation.
 */
export const HELP_ROWS: HelpRow[] = [
  {
    command: "mode [invest|dev|forensic]",
    description:
      "Show or switch purpose mode (aliases: trade/i, workshop/d, dig/trace/f)",
    modes: ["global"]
  },
  {
    command: "networks",
    description: "List all available blockchain networks",
    modes: ["global"]
  },
  {
    command: "network <name|id>",
    description: "Switch active network",
    modes: ["global"]
  },
  {
    command: "rpc [use|add|remove|alchemy|infura|quicknode]",
    description: "Manage & switch RPC providers",
    modes: ["global"]
  },
  {
    command: "theme <name>",
    description: "Switch terminal color theme / style",
    modes: ["global"]
  },
  {
    command: "register <address> [symbol] [erc20|erc721]",
    description: "Verify and register a custom ERC20 or ERC721/NFT token",
    modes: ["global"]
  },
  {
    command: "tokens [erc20|erc721]",
    description: "List all registered tokens for the active network",
    modes: ["global"]
  },
  {
    command: "export",
    description: "Export settings & custom tokens to JSON (includes mode)",
    modes: ["global"]
  },
  {
    command: "import <json>",
    description: "Import settings & custom tokens from JSON",
    modes: ["global"]
  },
  {
    command: "ens <name.eth | address> | set <name.eth> | clear",
    description:
      "Resolve a name/address, or register/clear your record (one name per address, on the active network)",
    modes: ["global"]
  },
  {
    command: "channel | channel list | channels",
    description:
      "Show active chat channel, or list presets / saved / recent (active marked with ·)",
    modes: ["global"]
  },
  {
    command: "channel use <name|address> | channel use <chain> <address>",
    description:
      "Switch the active channel (wrong-chain refuses send — type network first)",
    modes: ["global"]
  },
  {
    command: "channel add <chain> <address> [name]",
    description: "Verify + save an existing Chat contract locally",
    modes: ["global"]
  },
  {
    command: "channel remove <name|address>",
    description: "Drop a saved channel from the local list (presets stay)",
    modes: ["global"]
  },
  {
    command: "channel deploy <name> [feeWei]",
    description:
      "EIP-1167 clone via ChatFactory on the active chain; sets active (default fee = Sepolia current)",
    modes: ["global"]
  },
  {
    command: "chat <address | ens.eth> <message>",
    description:
      "Send an encrypted 1:1 message on the ACTIVE channel (testnets; key auto-registers on first send)",
    modes: ["global"]
  },
  {
    command: "inbox [<address>]",
    description: "Read & decrypt threads on the ACTIVE channel",
    modes: ["global"]
  },
  {
    command: "chatfee",
    description: "Show message fee on the ACTIVE channel",
    modes: ["global"]
  },
  {
    command: "board post <content>",
    description: "Post public content to the on-chain billboard (tiny fee)",
    modes: ["global"]
  },
  {
    command: "board [list] [count]",
    description: "List the latest public posts (default 5, max 50)",
    modes: ["global"]
  },
  {
    command: "boardfee",
    description: "Show current post fee on the active network",
    modes: ["global"]
  },
  {
    command: "share portfolio",
    description: "Publish portfolio summary for your address",
    modes: ["global"]
  },
  {
    command: "share pnl",
    description: "Publish PnL vs your last snapshot",
    modes: ["global"]
  },
  {
    command: "share / share status",
    description: "Show your share status",
    modes: ["global"]
  },
  {
    command: "unshare / share off",
    description: "Revoke public share",
    modes: ["global"]
  },
  {
    command: "look <address|ens>",
    description: "View someone's shared card",
    modes: ["global"]
  },
  {
    command: "feed [n]",
    description: "Recent shares (default 10, max 50)",
    modes: ["global"]
  },
  {
    command: "Social tab",
    description:
      "Header TERMINAL | SOCIAL switch — Inbox + Board live here (not pinnable). Unread badges poll ~60s. Commands inbox / chat / board / channel* still work from the prompt on either tab.",
    modes: ["global"]
  },

  // invest
  {
    command: "dexes",
    description: "List available DEXes",
    modes: ["invest"]
  },
  {
    command: "dex <id>",
    description: "Set active DEX protocol",
    modes: ["invest"]
  },
  {
    command: "price <tA> [tB] [pool|api]",
    description: "Query token price from on-chain pool or API",
    modes: ["invest", "forensic"]
  },
  {
    command: "createpool <tA> <tB> [fee]",
    description: "Deploy pool contract",
    modes: ["invest"]
  },
  {
    command: "getpool <tA> <tB> [fee]",
    description: "Query pool address",
    modes: ["invest"]
  },
  {
    command: "initialize <tA> <tB> [fee]",
    description: "Initialize V3 pool price curve",
    modes: ["invest"]
  },
  {
    command: "addliq <tA> <tB> <amtA> <amtB> [fee]",
    description: "Add liquidity position",
    modes: ["invest"]
  },
  {
    command: "swap <amt> <from> <to>",
    description: "Execute token swap",
    modes: ["invest"]
  },
  {
    command: "pool <address>",
    description: "Check V2/V3 pool metrics",
    modes: ["invest"]
  },
  {
    command: "balance <token>",
    description: "Check token balance",
    modes: ["invest", "forensic"]
  },
  {
    command: "portfolio [native|erc20]",
    description:
      "Wallet balances + USD value across all chains (P/L vs snapshot)",
    modes: ["invest", "forensic"]
  },
  {
    command: "snapshot [label]",
    description: "Record current portfolio baseline for P/L tracking",
    modes: ["invest"]
  },
  {
    command: "pnl",
    description: "Show portfolio P/L vs last snapshot",
    modes: ["invest"]
  },

  // dev
  {
    command: "deploy <erc20|erc721> <name> <symbol> [decimals]",
    description: "Deploy token clone on the active testnet",
    modes: ["dev"]
  },
  {
    command: "is <erc20|erc721> <address>",
    description: "Check if address is a valid ERC20 or ERC721/NFT contract",
    modes: ["shared"]
  },
  {
    command: "info <address>",
    description: "Print metadata of an ERC20 or ERC721/NFT token contract",
    modes: ["shared"]
  }
];

export function helpRowsForMode(mode: TerminalMode): HelpRow[] {
  return HELP_ROWS.filter((row) => {
    if (row.modes.includes("global")) return true;
    if (row.modes.includes(mode)) return true;
    if (
      row.modes.includes("shared") &&
      (mode === "dev" || mode === "forensic")
    )
      return true;
    return false;
  });
}

/** Exported for tests — full classification table. */
export function classifyLiveVerb(cmd: string): CommandAffinity | null {
  return commandAffinity(cmd);
}

/** True when an invest verb is blocked in forensic despite invest affinity. */
export function isForensicBlockedInvestVerb(cmd: string): boolean {
  return FORENSIC_BLOCKED_INVEST.has(cmd.trim().toLowerCase());
}
