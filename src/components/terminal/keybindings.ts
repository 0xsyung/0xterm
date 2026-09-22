/**
 * @file keybindings.ts
 * @description Pure logic for the `bind` command — F1–F12 keymap, bindings
 * data model, validation, and storage (#28)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { ThemeMode } from "./types";

export type FKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12";

export const FKEYS: FKey[] = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12"
];

/** Factory default keymap. F4 is theme-cycling so F-keys stay useful on every theme. */
export const DEFAULTS: Record<FKey, string> = {
  F1: "help",
  F2: "networks",
  F3: "dexes",
  F4: "theme next",
  F5: "swap",
  F6: "ticker",
  F7: "portfolio",
  F8: "news",
  F9: "kyt",
  F10: "sim",
  F11: "plan ls",
  F12: "feedback"
};

/** Commands the issue lists as not-yet-shipped. Fire path warns with the issue. */
export const FUTURE_COMMANDS = [
  "ticker",
  "news",
  "kyt",
  "kya",
  "sim",
  "trace",
  "plan",
  "vault",
  "poly",
  "arb",
  "will",
  "when",
  "pf",
  "ipfs",
  "share",
  "feedback",
  "bind",
  "wallet"
];

/** Issue tracker number per FUTURE_COMMANDS entry ("not shipped yet — #N"). */
export const COMMAND_ISSUE: Record<string, number> = {
  kyt: 16,
  kya: 17,
  sim: 18,
  trace: 21,
  plan: 24,
  vault: 20,
  poly: 9,
  arb: 10,
  will: 11,
  when: 12,
  pf: 13,
  ipfs: 14,
  feedback: 19,
  bind: 28,
  wallet: 25
};

/** Command prefixes that must be typed-YES-confirmed when bound AND when fired. */
export const DANGEROUS_COMMANDS: string[][] = [
  ["wallet", "create"],
  ["wallet", "import"],
  ["wallet", "export"],
  ["wallet", "nuke"]
];

/** Device-level bindings state. `map` stores only diffs-from-default + clears. */
export type BindingsState = {
  version: 1;
  footer: boolean;
  map: Partial<Record<FKey, string>>;
};

export const BINDINGS_STORAGE_KEY = "0xterm_bindings";

export function defaultBindings(): BindingsState {
  return { version: 1, footer: true, map: {} };
}

/** Normalize "f6" / "F6" / "F12" to a canonical FKey, else null. */
export function normalizeFKey(raw: string): FKey | null {
  const m = raw.trim().match(/^f([1-9]|1[0-2])$/i);
  return m ? (`F${m[1]}` as FKey) : null;
}

export type ParseBindResult =
  | { op: "list" }
  | { op: "reset" }
  | { op: "footer"; value: "on" | "off" | "toggle" }
  | { op: "show"; key: FKey }
  | { op: "set"; key: FKey; cmd: string }
  | { op: "default"; key: FKey }
  | { op: "clear"; key: FKey }
  | { op: "error"; message: string };

export const BIND_USAGE =
  "Usage:\n• bind — list the full F1–F12 keymap\n• bind <F1..F12> <command> — bind a key\n• bind <F1..F12> — show a key's binding\n• bind <F1..F12> default — restore factory default\n• bind clear <F1..F12> — unbind a key\n• bind footer [on|off] — F-key hint footer in the prompt\n• bind reset — restore all factory defaults";

/** Parse `bind` subcommand args. Key matching is case-insensitive. */
export function parseBindArgs(args: string[]): ParseBindResult {
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "list") return { op: "list" };
  if (sub === "reset") return { op: "reset" };
  if (sub === "footer") {
    const v = args[2]?.toLowerCase();
    if (v && v !== "on" && v !== "off") {
      return { op: "error", message: `Usage: bind footer [on|off]` };
    }
    return { op: "footer", value: (v as "on" | "off" | undefined) ?? "toggle" };
  }
  const key = normalizeFKey(args[1] ?? "");
  if (!key) return { op: "error", message: BIND_USAGE };
  if (!args[2]) return { op: "show", key };
  const action = args[2].toLowerCase();
  if (action === "default" && args.length === 3) return { op: "default", key };
  if (action === "clear" && args.length === 3) return { op: "clear", key };
  return { op: "set", key, cmd: args.slice(2).join(" ") };
}

export type BindingValidation = {
  ok: boolean;
  canonical?: string;
  message?: string;
};

const FORBIDDEN_BINDING = /[\n;]|{{|<script|javascript:/i;

/**
 * Validate a command string for binding. First token must be a real or
 * future command; scripts and command chaining are rejected. Empty string is
 * valid (it clears the key).
 */
export function validateBinding(
  cmd: string,
  availableCommands: string[]
): BindingValidation {
  const trimmed = cmd.trim();
  if (!trimmed) return { ok: true, canonical: "" };
  if (FORBIDDEN_BINDING.test(trimmed)) {
    return {
      ok: false,
      message:
        "[!] Bindings are command strings only: no newlines, ';', '{{', '<script', or 'javascript:'."
    };
  }
  const first = trimmed.split(/\s+/)[0].toLowerCase();
  if (!availableCommands.includes(first) && !FUTURE_COMMANDS.includes(first)) {
    return { ok: false, message: `[!] Unknown command "${first}".` };
  }
  return { ok: true, canonical: trimmed };
}

/** True when the command starts with a dangerous prefix (wallet create/import/export/nuke). */
export function isDangerousBinding(cmd: string): boolean {
  const tokens = cmd.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return DANGEROUS_COMMANDS.some((prefix) =>
    prefix.every((tok, i) => tokens[i] === tok)
  );
}

export type BindingResolution = {
  cmd: string;
  origin: "default" | "user" | "cleared";
};

export function resolveBinding(
  state: BindingsState,
  key: FKey
): BindingResolution {
  const val = state.map[key];
  if (val === undefined) return { cmd: DEFAULTS[key], origin: "default" };
  if (val === "") return { cmd: "", origin: "cleared" };
  return { cmd: val, origin: "user" };
}

/** Serialize to storage JSON — only diffs-from-default and clears are kept. */
export function serializeBindings(state: BindingsState): string {
  const map: Partial<Record<FKey, string>> = {};
  for (const k of FKEYS) {
    const val = state.map[k];
    if (val === undefined) continue;
    map[k] = val;
  }
  return JSON.stringify({ version: state.version, footer: state.footer, map });
}

export function loadBindings(storage: Pick<Storage, "getItem">): BindingsState {
  try {
    const raw = storage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return defaultBindings();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultBindings();
    const src = (parsed as Record<string, unknown>).map;
    const map: Partial<Record<FKey, string>> = {};
    if (src && typeof src === "object") {
      for (const k of FKEYS) {
        const v = (src as Record<string, unknown>)[k];
        if (typeof v === "string") map[k] = v;
      }
    }
    return {
      version: 1,
      footer: (parsed as Record<string, unknown>).footer !== false,
      map
    };
  } catch {
    return defaultBindings();
  }
}

export function saveBindings(
  storage: Pick<Storage, "setItem">,
  state: BindingsState
): void {
  try {
    storage.setItem(BINDINGS_STORAGE_KEY, serializeBindings(state));
  } catch {
    // storage unavailable — in-memory state still works for this session
  }
}

export function footerVisible(state: BindingsState): boolean {
  return state.footer;
}

/**
 * F-key hint footer for the prompt card. On Bloomberg the header already shows
 * F1–F5 buttons, so only F6–F12 + user customs are hinted. Elsewhere the
 * marquee defaults (F1/F5/F12) plus all user customs are hinted.
 */
export function footerLabel(state: BindingsState, themeKey: ThemeMode): string {
  if (!state.footer) return "";
  const parts: string[] = [];
  const added = new Set<FKey>();
  const push = (key: FKey) => {
    if (added.has(key)) return;
    added.add(key);
    const r = resolveBinding(state, key);
    if (!r.cmd) return;
    parts.push(
      `${key} ${r.origin === "default" ? r.cmd.toUpperCase() : r.cmd}`
    );
  };
  const pushCustom = (key: FKey) => {
    const r = resolveBinding(state, key);
    if (r.origin === "user") parts.push(`${key} ${r.cmd}`);
  };
  if (themeKey === "bloomberg") {
    for (const k of FKEYS.slice(5)) push(k);
    for (const k of FKEYS.slice(0, 5)) pushCustom(k);
  } else {
    push("F1");
    push("F5");
    push("F12");
    for (const k of FKEYS) pushCustom(k);
  }
  return parts.join("  ·  ");
}

/** Merge an imported bindings blob into the device state. Device wins if it has any custom key. */
export function mergeImportedBindings(
  device: BindingsState,
  imported?: unknown
): BindingsState {
  const next: BindingsState = { ...device, map: { ...device.map } };
  if (!imported || typeof imported !== "object") return next;
  const imp = imported as { map?: unknown; footer?: unknown };
  if (typeof imp.footer === "boolean") next.footer = imp.footer;
  const src = imp.map as Record<string, unknown> | undefined;
  if (src && typeof src === "object") {
    const deviceHasCustom = FKEYS.some(
      (k) => typeof device.map[k] === "string" && device.map[k] !== DEFAULTS[k]
    );
    if (!deviceHasCustom) {
      for (const k of FKEYS) {
        const v = src[k];
        if (typeof v === "string") next.map[k] = v;
      }
    }
  }
  return next;
}

/**
 * Should the F-key listener ignore this keydown target? Editable surfaces
 * (textarea, inputs, contenteditable, retain-focus panels) keep F-keys for the
 * browser/editing. The prompt input itself (data-0xterm-prompt) is exempt so
 * F-keys fire from the prompt.
 */
export function isEditableTarget(el: unknown): boolean {
  if (!el || typeof el !== "object") return false;
  const node = el as Element;
  const tag = node.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (node as HTMLInputElement).type?.toLowerCase();
    if (type === "password") return true;
    if (node.hasAttribute?.("data-0xterm-prompt")) return false;
    return true;
  }
  if (node instanceof HTMLElement && node.isContentEditable) return true;
  if (node.hasAttribute?.("data-retain-focus")) return true;
  return false;
}
