/**
 * @file settingsPrefs.ts
 * @description Pure helpers for Settings panel — mask secrets, export/import (#81)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { CustomTokensMap, PinnedManifest, ThemeMode } from "./types";
import type { RpcProviders, ActiveRpcProviders } from "./rpc";
import type { TerminalMode } from "./mode";
import { isTerminalMode } from "./mode";
import { resolveThemeKey } from "./constants";
import type { ChannelStore } from "./chatChannels";
import { exportChannelsPayload, importChannelsPayload } from "./chatChannels";
import { migrateCustomTokens } from "./helpers";
import { isPinnableManifest } from "./helpers";

/** Blob shape aligned with the `export` / `import` commands (no new schema). */
export type SettingsExportBlob = {
  version: string;
  wallet?: string;
  preferences: {
    theme?: ThemeMode | string;
    mode?: TerminalMode | string;
    rpcProviders?: RpcProviders;
    activeRpcProviders?: ActiveRpcProviders;
    pinned?: unknown[];
    chainId?: number;
    dexId?: string;
    [key: string]: unknown;
  };
  customTokens?: CustomTokensMap | Record<string, unknown>;
  pinned?: unknown[];
  chatChannels?: ReturnType<typeof exportChannelsPayload>;
};

export function maskSecret(
  value: string,
  opts?: { reveal?: boolean; keepLast?: number }
): string {
  if (opts?.reveal) return value;
  if (!value) return "";
  const keep = opts?.keepLast ?? 4;
  if (value.length <= keep) return "••••••••";
  return `••••••••${value.slice(-keep)}`;
}

/** Mid-truncate long addresses for dense tables: `0x…abcd`. */
export function truncateMid(value: string, head = 4, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export type ParseImportResult =
  | { ok: true; data: SettingsExportBlob }
  | { ok: false; error: string };

export function parseImportJson(raw: string): ParseImportResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Empty JSON — paste an export blob." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Invalid JSON";
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Invalid configuration JSON format." };
  }
  const data = parsed as SettingsExportBlob;
  if (!data.preferences && !data.customTokens && !data.chatChannels) {
    return { ok: false, error: "Invalid configuration JSON format." };
  }
  return { ok: true, data };
}

export type BuildExportInput = {
  wallet?: string | null;
  theme: ThemeMode;
  mode: TerminalMode;
  rpcProviders: RpcProviders;
  activeRpcProviders: ActiveRpcProviders;
  customTokens: CustomTokensMap;
  pinned: PinnedManifest[];
  channelStore: ChannelStore;
  /** Extra preference fields already in `0xterm_user_*` (chainId, dexId, …). */
  existingPreferences?: Record<string, unknown>;
};

export function buildExportBlob(input: BuildExportInput): SettingsExportBlob {
  const serializablePins = input.pinned.map(
    ({ payload: _p, component: _c, ...rest }) => rest
  );
  const preferences: SettingsExportBlob["preferences"] = {
    ...(input.existingPreferences || {}),
    theme: input.theme,
    mode: input.mode,
    rpcProviders: input.rpcProviders,
    activeRpcProviders: input.activeRpcProviders,
    pinned: serializablePins
  };
  return {
    version: "1.0",
    ...(input.wallet ? { wallet: input.wallet } : {}),
    preferences,
    customTokens: input.customTokens,
    pinned: serializablePins,
    chatChannels: exportChannelsPayload(input.channelStore)
  };
}

export type ApplyImportResult = {
  theme?: ThemeMode;
  mode?: TerminalMode;
  rpcProviders?: RpcProviders;
  activeRpcProviders?: ActiveRpcProviders;
  customTokens?: CustomTokensMap;
  pinned?: PinnedManifest[];
  channelStore?: ChannelStore;
  preferencesToPersist: Record<string, unknown>;
};

/**
 * Normalize an import blob into state patches. Does not touch localStorage —
 * the shell applies persistence to the same keys commands use.
 */
export function applyImportBlob(
  data: SettingsExportBlob,
  currentChannels: ChannelStore
): ApplyImportResult {
  const prefs = (data.preferences && typeof data.preferences === "object"
    ? { ...data.preferences }
    : {}) as Record<string, unknown>;

  const result: ApplyImportResult = {
    preferencesToPersist: prefs
  };

  if (typeof prefs.theme === "string") {
    result.theme = resolveThemeKey(prefs.theme);
  }
  if (isTerminalMode(prefs.mode)) {
    result.mode = prefs.mode;
  }
  if (prefs.rpcProviders && typeof prefs.rpcProviders === "object") {
    result.rpcProviders = prefs.rpcProviders as RpcProviders;
  }
  if (prefs.activeRpcProviders && typeof prefs.activeRpcProviders === "object") {
    result.activeRpcProviders = prefs.activeRpcProviders as ActiveRpcProviders;
  }

  if (data.customTokens) {
    result.customTokens = migrateCustomTokens(data.customTokens);
  }

  const pinSource = Array.isArray(data.pinned)
    ? data.pinned
    : Array.isArray(prefs.pinned)
      ? prefs.pinned
      : null;
  if (pinSource) {
    result.pinned = pinSource.filter(
      (p): p is PinnedManifest =>
        !!p &&
        typeof p === "object" &&
        !!(p as PinnedManifest).id &&
        !!(p as PinnedManifest).kind &&
        isPinnableManifest(p)
    );
  }

  if (data.chatChannels) {
    result.channelStore = importChannelsPayload(data.chatChannels, currentChannels);
  }

  return result;
}
