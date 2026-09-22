/**
 * @file explorerKeys.ts
 * @description Explorer (Etherscan) API key storage keyed by chainId, persisted
 * inside the `0xterm_user_<address>` preferences blob so export/import ride along.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { RpcProviders } from "./rpc";

/** Explorer API keys keyed by chainId, mirroring the rpcProviders shape. */
export type ExplorerKeys = Record<number, string>;

export const EXPLORER_KEYS_PREF_KEY = "explorerKeys";

export function loadExplorerKeys(
  existingPreferences?: Record<string, unknown> | null
): ExplorerKeys {
  const raw = existingPreferences?.[EXPLORER_KEYS_PREF_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ExplorerKeys = {};
  for (const [k, v] of Object.entries(raw)) {
    const chainId = Number(k);
    if (Number.isInteger(chainId) && typeof v === "string" && v) {
      out[chainId] = v;
    }
  }
  return out;
}

/**
 * Persist a new keys map into the prefs blob. Keeps every other preference
 * field intact — the exact pattern `savePreference` uses for rpcProviders.
 */
export function saveExplorerKeys(
  keys: ExplorerKeys,
  walletAddress: string,
  existingPreferences?: Record<string, unknown> | null
): void {
  const prefKey = `0xterm_user_${walletAddress.toLowerCase()}`;
  const stored = localStorage.getItem(prefKey);
  let prefs: Record<string, unknown> = {};
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") prefs = parsed as Record<string, unknown>;
    } catch {
      prefs = {};
    }
  }
  prefs[EXPLORER_KEYS_PREF_KEY] = keys;
  localStorage.setItem(prefKey, JSON.stringify(prefs));
}

/** A key set for exactly one chain: the same shape RpcProviders uses. */
export function asRpcShape(keys: ExplorerKeys): RpcProviders {
  const out: RpcProviders = {};
  for (const [chainId, key] of Object.entries(keys)) {
    out[Number(chainId)] = { default: key };
  }
  return out;
}
