/**
 * @file chatChannels.ts
 * @description Chat channel model: id, resolve, persist, verify helpers (#58).
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { getAddress, isAddress, type Address, type PublicClient } from "viem";
import {
  CHAT_PRESETS,
  chatAbi,
  SUPPORTED_CHAINS,
} from "./constants";

/** Default per-message fee (wei) when `channel deploy` omits fee — Sepolia current. */
export const DEFAULT_CHAT_FEE_WEI = 100000000000000n; // 0.0001 ETH

export const CHANNELS_STORAGE_KEY = "0xterm.chat.channels";
export const ACTIVE_CHANNEL_STORAGE_KEY = "0xterm.chat.activeId";

export type ChannelSource = "preset" | "saved" | "recent";

export type ChatChannel = {
  chainId: number;
  address: Address;
  /** On-chain or preset name; may be empty for legacy contracts without name(). */
  name: string;
  /** Shared implementation the clone delegates to, when known. */
  implementation?: Address;
  source?: ChannelSource;
};

export type ChannelId = string; // `${chainId}:${address.toLowerCase()}`

export type ChannelStore = {
  channels: ChatChannel[];
  activeId: ChannelId | null;
};

export type ResolveResult =
  | { ok: true; channel: ChatChannel }
  | { ok: false; reason: "empty" | "choices" | "not_found"; choices?: ChatChannel[]; message: string };

export type VerifyResult =
  | { ok: true; name: string; fee: bigint }
  | { ok: false; reason: string };

export function channelId(chainId: number, address: string): ChannelId {
  return `${chainId}:${address.toLowerCase()}`;
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function chainName(chainId: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name || `chain ${chainId}`;
}

/** Display label; when `disambiguate` and name collides, append short address. */
export function formatChannelLabel(
  ch: ChatChannel | null | undefined,
  opts?: { disambiguate?: boolean; all?: ChatChannel[] }
): string {
  if (!ch) return "—";
  const name = (ch.name || "").trim();
  if (!name) return shortAddress(ch.address);
  if (opts?.disambiguate && opts.all) {
    const lower = name.toLowerCase();
    const dupes = opts.all.filter((c) => (c.name || "").trim().toLowerCase() === lower);
    if (dupes.length > 1) return `${name} · ${shortAddress(ch.address)}`;
  }
  return name;
}

/** Social / chip label for the active channel (with optional duplicate suffix). */
export function activeChannelChipLabel(
  active: ChatChannel | null,
  all: ChatChannel[]
): string {
  if (!active) return "—";
  return formatChannelLabel(active, { disambiguate: true, all });
}

export function presetsAsChannels(): ChatChannel[] {
  const out: ChatChannel[] = [];
  for (const [id, entry] of Object.entries(CHAT_PRESETS)) {
    const chainId = Number(id);
    if (!entry?.address) continue;
    out.push({
      chainId,
      address: getAddress(entry.address),
      name: entry.name || "",
      implementation: entry.implementation
        ? getAddress(entry.implementation)
        : undefined,
      source: "preset",
    });
  }
  return out;
}

export function mergeChannelLists(
  presets: ChatChannel[],
  saved: ChatChannel[],
  recent: ChatChannel[] = []
): ChatChannel[] {
  const map = new Map<ChannelId, ChatChannel>();
  for (const ch of presets) map.set(channelId(ch.chainId, ch.address), { ...ch, source: "preset" });
  for (const ch of saved) {
    const id = channelId(ch.chainId, ch.address);
    const prev = map.get(id);
    map.set(id, {
      ...ch,
      source: prev?.source === "preset" ? "preset" : "saved",
      name: ch.name || prev?.name || "",
    });
  }
  for (const ch of recent) {
    const id = channelId(ch.chainId, ch.address);
    if (!map.has(id)) map.set(id, { ...ch, source: "recent" });
  }
  return Array.from(map.values());
}

/** Ordered for `channel list`: presets, then saved, then recent (deduped). */
export function listChannelsOrdered(store: ChannelStore): ChatChannel[] {
  const presets = presetsAsChannels();
  const saved = store.channels.filter((c) => c.source !== "recent");
  const recent = store.channels.filter((c) => c.source === "recent");
  const presetIds = new Set(presets.map((p) => channelId(p.chainId, p.address)));
  const savedOnly = saved.filter((c) => !presetIds.has(channelId(c.chainId, c.address)));
  const known = new Set([
    ...presetIds,
    ...savedOnly.map((c) => channelId(c.chainId, c.address)),
  ]);
  const recentOnly = recent.filter((c) => !known.has(channelId(c.chainId, c.address)));
  return [...presets, ...savedOnly, ...recentOnly];
}

export function loadChannelStore(storage: Storage | null | undefined): ChannelStore {
  const presets = presetsAsChannels();
  if (!storage) return { channels: [], activeId: null };
  let channels: ChatChannel[] = [];
  try {
    const raw = storage.getItem(CHANNELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        channels = parsed
          .map(normalizeChannel)
          .filter((c): c is ChatChannel => !!c);
      }
    }
  } catch {
    channels = [];
  }
  let activeId: ChannelId | null = null;
  try {
    activeId = storage.getItem(ACTIVE_CHANNEL_STORAGE_KEY) || null;
  } catch {
    activeId = null;
  }
  // Validate activeId points at something we know (saved or preset)
  if (activeId) {
    const all = mergeChannelLists(presets, channels);
    if (!all.some((c) => channelId(c.chainId, c.address) === activeId)) {
      activeId = null;
    }
  }
  return { channels, activeId };
}

function normalizeChannel(raw: unknown): ChatChannel | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const chainId = Number(o.chainId);
  const address = typeof o.address === "string" ? o.address : "";
  if (!Number.isFinite(chainId) || !isAddress(address)) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const implementation =
    typeof o.implementation === "string" && isAddress(o.implementation)
      ? getAddress(o.implementation)
      : undefined;
  const source =
    o.source === "preset" || o.source === "saved" || o.source === "recent"
      ? o.source
      : "saved";
  return {
    chainId,
    address: getAddress(address),
    name,
    implementation,
    source,
  };
}

export function saveChannelStore(
  storage: Storage | null | undefined,
  store: ChannelStore
): void {
  if (!storage) return;
  try {
    // Persist user channels only (not presets)
    const toSave = store.channels.filter((c) => c.source !== "preset");
    storage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(toSave));
    if (store.activeId) storage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, store.activeId);
    else storage.removeItem(ACTIVE_CHANNEL_STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}

/**
 * Boot: restore last active; else official preset for current network; else null.
 */
export function bootActiveChannel(
  store: ChannelStore,
  currentChainId: number | null | undefined
): ChatChannel | null {
  const all = mergeChannelLists(presetsAsChannels(), store.channels);
  if (store.activeId) {
    const found = all.find((c) => channelId(c.chainId, c.address) === store.activeId);
    if (found) return found;
  }
  if (currentChainId != null) {
    const preset = presetsAsChannels().find((c) => c.chainId === currentChainId);
    if (preset) return preset;
  }
  return null;
}

export function getActiveChannel(store: ChannelStore): ChatChannel | null {
  if (!store.activeId) return null;
  const all = mergeChannelLists(presetsAsChannels(), store.channels);
  return all.find((c) => channelId(c.chainId, c.address) === store.activeId) || null;
}

/**
 * Resolve `channel use <name|address>` on the active chain (or explicit chain).
 * Rules: exact name (ci) → 0x+40 hex on active chain → CHOICES of close matches.
 */
export function resolveChannelUse(
  query: string,
  store: ChannelStore,
  activeChainId: number | null,
  explicitChainId?: number
): ResolveResult {
  const q = query.trim();
  if (!q) {
    return { ok: false, reason: "empty", message: "Usage: channel use <name|address>" };
  }
  const all = listChannelsOrdered(store);
  const chainId = explicitChainId ?? activeChainId;

  // Exact name match (case-insensitive), prefer active chain if multiple
  const nameMatches = all.filter(
    (c) => (c.name || "").trim().toLowerCase() === q.toLowerCase()
  );
  if (nameMatches.length === 1) {
    return { ok: true, channel: nameMatches[0] };
  }
  if (nameMatches.length > 1) {
    if (chainId != null) {
      const onChain = nameMatches.filter((c) => c.chainId === chainId);
      if (onChain.length === 1) return { ok: true, channel: onChain[0] };
      if (onChain.length > 1) {
        return {
          ok: false,
          reason: "choices",
          choices: onChain,
          message: `Multiple channels named "${q}". Pick one:`,
        };
      }
    }
    return {
      ok: false,
      reason: "choices",
      choices: nameMatches,
      message: `Multiple channels named "${q}". Pick one:`,
    };
  }

  // Address form
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    if (chainId == null) {
      return {
        ok: false,
        reason: "not_found",
        message: "[!] Set a network first (network <name|id>).",
      };
    }
    const addr = getAddress(q);
    const existing = all.find(
      (c) => c.chainId === chainId && c.address.toLowerCase() === addr.toLowerCase()
    );
    if (existing) return { ok: true, channel: existing };
    return {
      ok: true,
      channel: {
        chainId,
        address: addr,
        name: "",
        source: "recent",
      },
    };
  }

  // Close name matches (substring)
  const close = all.filter((c) =>
    (c.name || "").toLowerCase().includes(q.toLowerCase())
  );
  if (close.length > 0) {
    return {
      ok: false,
      reason: "choices",
      choices: close,
      message: `No exact match for "${q}". Did you mean:`,
    };
  }
  return {
    ok: false,
    reason: "not_found",
    message: `[!] No channel matching "${q}". Type channel list or channel deploy <name>.`,
  };
}

export async function verifyChatContract(
  client: PublicClient,
  address: Address
): Promise<VerifyResult> {
  try {
    const code = await client.getCode({ address });
    if (!code || code === "0x") {
      return { ok: false, reason: "no code" };
    }
  } catch {
    return { ok: false, reason: "code check failed" };
  }

  let fee: bigint;
  try {
    fee = (await client.readContract({
      address,
      abi: chatAbi,
      functionName: "fee",
    })) as bigint;
  } catch {
    return { ok: false, reason: "fee() failed" };
  }

  // name() optional for legacy UUPS presets
  let name = "";
  try {
    name = (await client.readContract({
      address,
      abi: chatAbi,
      functionName: "name",
    })) as string;
  } catch {
    name = "";
  }

  try {
    await client.readContract({
      address,
      abi: chatAbi,
      functionName: "getPublicKey",
      args: ["0x0000000000000000000000000000000000000000" as Address],
    });
  } catch {
    return { ok: false, reason: "getPublicKey() failed" };
  }

  return { ok: true, name: name || "", fee };
}

export function exportChannelsPayload(store: ChannelStore): {
  channels: ChatChannel[];
  activeId: ChannelId | null;
} {
  return {
    channels: store.channels.filter((c) => c.source !== "preset"),
    activeId: store.activeId,
  };
}

export function importChannelsPayload(
  data: unknown,
  current: ChannelStore
): ChannelStore {
  if (!data || typeof data !== "object") return current;
  const o = data as Record<string, unknown>;
  const list = Array.isArray(o.channels) ? o.channels : [];
  const imported = list
    .map(normalizeChannel)
    .filter((c): c is ChatChannel => !!c)
    .map((c) => ({ ...c, source: "saved" as const }));
  const map = new Map<ChannelId, ChatChannel>();
  for (const c of current.channels) map.set(channelId(c.chainId, c.address), c);
  for (const c of imported) map.set(channelId(c.chainId, c.address), c);
  let activeId = current.activeId;
  if (typeof o.activeId === "string" && o.activeId) {
    activeId = o.activeId;
  }
  return { channels: Array.from(map.values()), activeId };
}

/** Designer / Manager fail-closed copy. */
export const NO_ACTIVE_CHANNEL_MSG =
  "[!] No active chat channel. Type channel list or channel deploy <name>.";

export function wrongChainMsg(ch: ChatChannel): string {
  return `[!] Channel is on ${chainName(ch.chainId)}. Type network ${chainName(ch.chainId)} first.`;
}

export function notChatContractMsg(addr: string): string {
  return `[!] Not a Chat contract at ${addr} — not saved.`;
}

export function activeChannelSuccessMsg(ch: ChatChannel): string {
  const label = formatChannelLabel(ch) || shortAddress(ch.address);
  return `[✓] Active channel: ${label} · ${chainName(ch.chainId)} · ${ch.address}`;
}

export function savedChannelSuccessMsg(ch: ChatChannel): string {
  const label = formatChannelLabel(ch) || shortAddress(ch.address);
  return `[✓] Channel saved: ${label} · ${chainName(ch.chainId)} · ${ch.address}`;
}
