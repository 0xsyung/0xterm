/**
 * @file TerminalShell.tsx
 * @description 0xTERM Terminal Shell Component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useSignMessage,
  useWriteContract
} from "wagmi";
import {
  formatEther,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  createPublicClient,
  http,
  encodeFunctionData,
  toHex,
  parseAbi,
  namehash,
  type Address,
  type Chain
} from "viem";
import { useAppKit } from "@reown/appkit/react";

// --- Extracted Components ---
import TerminalHeader from "./TerminalHeader";
import SwapWidget from "./SwapWidget";
import TerminalLogList from "./TerminalLogList";
import TerminalPrompt from "./TerminalPrompt";

import {
  THEMES,
  THEME_ORDER,
  resolveThemeKey,
  isKnownThemeInput,
  HEADER_PAD,
  SUPPORTED_CHAINS,
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE,
  DEX_REGISTRY,
  erc20Abi,
  uniV2RouterAbi,
  uniV3RouterAbi,
  uniV3PoolAbi,
  uniV2FactoryAbi,
  uniV3FactoryAbi,
  uniV2PairAbi,
  erc165Abi,
  erc20FullAbi,
  erc721Abi,
  INTERFACE_ID_ERC165,
  INTERFACE_ID_ERC20,
  INTERFACE_ID_ERC721,
  COMMON_TOKENS,
  resolveChain,
  IMPLEMENTATION_ADDRESSES,
  DEXSCREENER_CHAIN,
  CHAT_CONTRACT,
  chatAbi,
  ENS_CONTRACT,
  ensRegistryAbi,
  BILLBOARD_CONTRACT,
  billboardAbi
} from "./constants";
import {
  deriveKeysFromSignature,
  deriveAesKey,
  encryptMessage,
  decryptMessage,
  hexToBytes,
  bytesToHex,
  KEY_MESSAGE
} from "../../lib/chatCrypto";
import type {
  LogEntry,
  ThemeMode,
  DexProtocol,
  PinnedManifest,
  CustomTokenEntry,
  CustomTokensMap
} from "./types";
import PortfolioWidget, {
  type PortfolioHolding,
  type SnapshotHolding
} from "./widgets/PortfolioWidget";
import { trackEvent } from "../../lib/analytics";
import DeployWidget from "./widgets/DeployWidget";
import PinnedPanel from "./PinnedPanel";
import type { ChatMessage } from "./widgets/ChatWidget";
import type { BillboardPost } from "./widgets/BillboardWidget";

const MAX_LOGS = 100;

// Normalize a raw stored custom-token blob into the current list-per-chain
// shape. Accepts both the new form (chain -> array) and the legacy form
// (chain -> symbol-keyed object). Idempotent; malformed entries are dropped.
const migrateCustomTokens = (raw: any): CustomTokensMap => {
  const out: CustomTokensMap = {};
  const toEntry = (t: any): CustomTokenEntry | null => {
    if (!t || typeof t !== "object" || !t.address) return null;
    const addr = t.address as string;
    return {
      id: typeof t.id === "string" ? t.id : `c_${addr.toLowerCase()}`,
      address: addr as Address,
      symbol: String(t.symbol ?? "?"),
      name: String(t.name ?? ""),
      decimals: typeof t.decimals === "number" ? t.decimals : undefined,
      tokenType:
        t.tokenType === "erc721"
          ? "erc721"
          : t.tokenType === "erc20"
            ? "erc20"
            : undefined,
      isNative: !!t.isNative
    };
  };
  for (const [chainIdStr, value] of Object.entries(raw ?? {})) {
    const chainId = Number(chainIdStr);
    const entries: CustomTokenEntry[] = [];
    if (Array.isArray(value)) {
      for (const t of value) {
        const e = toEntry(t);
        if (e) entries.push(e);
      }
    } else if (value && typeof value === "object") {
      // legacy: symbol-keyed token map
      for (const t of Object.values(value)) {
        const e = toEntry(t);
        if (e) entries.push(e);
      }
    }
    if (entries.length > 0) out[chainId] = entries;
  }
  return out;
};

// Helper: Formats ugly Viem RPC errors into clean terminal output
const formatViemError = (err: any): string => {
  const msg = err?.shortMessage || err?.message || String(err);
  if (msg.includes("User rejected")) return "Transaction rejected by user.";
  if (msg.includes("insufficient funds"))
    return "Insufficient native balance for transaction.";
  if (msg.includes("INSUFFICIENT_OUTPUT_AMOUNT"))
    return "Slippage tolerance exceeded.";
  if (msg.includes("allowance"))
    return "Insufficient ERC20 allowance. Approve tokens first.";
  if (msg.includes("Failed to fetch"))
    return "Network Error: Failed to fetch. If using on-chain data, your RPC node may be down. If using API, check your ad-blocker.";
  return `ERROR: ${msg.split("\n")[0]}`;
};

// --- Click-to-Copy Address Component ---
function CopyableAddress({
  address,
  theme,
  className = ""
}: {
  address: string;
  theme: any;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`cursor-pointer transition-colors relative group inline-flex items-center gap-1 ${
        copied ? `${theme.primary} font-bold` : "hover:underline"
      } ${className}`}
      title="Click to copy address"
    >
      <span>{address}</span>
      <span className={`text-[10px] ${theme.primary} opacity-60 group-hover:opacity-100`}>
        {copied ? "[COPIED]" : "▣"}
      </span>
    </span>
  );
}

// --- Export Widget Component with Copy Icon ---
function ExportWidget({
  exportData,
  theme,
  address
}: {
  exportData: any;
  theme: any;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(exportData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2 max-w-xl`}
    >
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className="font-bold">EXPORT CONFIG & CUSTOM TOKENS</span>
        <div className="flex items-center gap-3">
          <CopyableAddress address={address} theme={theme} />
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${theme.border} bg-current/5 hover:bg-current/15 transition-all text-[11px] font-mono`}
            title="Copy JSON to clipboard"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012-2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            {copied ? (
              <span className={`${theme.primary} font-bold`}>COPIED!</span>
            ) : (
              <span>COPY</span>
            )}
          </button>
        </div>
      </div>
      <div className={`text-[10px] ${theme.text}/60`}>
        Copy the JSON below and run{" "}
        <span className={theme.primary}>import &lt;json&gt;</span> in your new
        wallet terminal:
      </div>
      <pre
        className={`p-3 bg-black/40 rounded border ${theme.border} font-mono text-[10px] overflow-x-auto select-all max-h-48 ${theme.primary}`}
      >
        {jsonString}
      </pre>
    </div>
  );
}

export default function TerminalShell({
  onToggleRain,
  currentThemeKey,
  onThemeChange
}: {
  onToggleRain: () => void;
  currentThemeKey: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const [activeDexId, setActiveDexId] = useState<string | null>(null);

  // Multi-provider RPC maps: ChainId -> { providerName: url } & ChainId -> activeProviderName
  const [rpcProviders, setRpcProviders] = useState<
    Record<number, Record<string, string>>
  >({});
  const [activeRpcProviders, setActiveRpcProviders] = useState<
    Record<number, string>
  >({});

  // Custom user-registered tokens, flat list per chain so multiple tokens can
  // share a symbol. `id` is the stable uniqueness key.
  const [customTokens, setCustomTokens] = useState<CustomTokensMap>({});

  const theme = THEMES[resolveThemeKey(currentThemeKey)];

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", type: "text", text: "0xTERM v1.5.0 [FULL ON-CHAIN DEFI SUITE]" },
    { id: "2", type: "text", text: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n' }
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Pinned widgets (floating right column). `refresh` is a live-data loader
  // re-run every 60s; manifests are what get persisted / exported / imported.
  const REFRESH_INTERVAL = 60; // seconds
  const [pinned, setPinned] = useState<PinnedManifest[]>([]);
  const [pinnedRefresh, setPinnedRefresh] = useState<
    Record<string, () => Promise<any>>
  >({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  // countdown in seconds until the next auto-refresh (per pinned widget).
  // A fresh pin starts at REFRESH_INTERVAL; ticks down each second and resets
  // to REFRESH_INTERVAL on refresh. Stored as a Map via state object so
  // PinnedPanel can render per-widget countdowns.
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  // pinnedRefresh is needed inside the tick interval; keep it in a ref so the
  // per-second interval doesn't re-subscribe (and re-reset countdowns) every
  // time a refresh closure is registered.
  const pinnedRefreshRef = useRef(pinnedRefresh);
  pinnedRefreshRef.current = pinnedRefresh;

  // Run one refresh for a single pinned entry (auto-tick or manual button).
  const refreshPinned = (id: string) => {
    const fn = pinnedRefreshRef.current[id];
    if (!fn) return;
    setRefreshingId(id);
    fn()
      .then((payload) => {
        setPinned((prev) =>
          prev.map((p) => {
            if (p.id !== id || !payload) return p;
            // component pins (e.g. price) re-render from componentData, so a
            // refresh may return data for either slot.
            const hasComponentData =
              payload && typeof payload === "object" && "componentData" in payload;
            return hasComponentData
              ? { ...p, componentData: payload.componentData }
              : { ...p, payload };
          })
        );
      })
      .catch(() => {})
      .finally(() => {
        setRefreshingId((cur) => (cur === id ? null : cur));
        // a completed refresh (auto or manual) restarts the countdown for the
        // refreshed widget, even if it was mid-flight / rehydrated without one
        setCountdowns((c) => ({ ...c, [id]: REFRESH_INTERVAL }));
      });
  };

  // Manual refresh button: refresh now and reset the countdown.
  const onRefreshPinned = (id: string) => {
    setCountdowns((c) => ({ ...c, [id]: REFRESH_INTERVAL }));
    refreshPinned(id);
  };

  // One-second tick: decrement each pinned countdown; refresh + reset at 0.
  // Covers ALL pinned widgets that have a refresh closure (board/balance/
  // portfolio/chat) — the countdown UI shows for every pinned card.
  useEffect(() => {
    const id = setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, number> = {};
        for (const [pid, secs] of Object.entries(prev)) {
          if (secs <= 1) {
            refreshPinned(pid);
            next[pid] = REFRESH_INTERVAL;
          } else {
            next[pid] = secs - 1;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a countdown for a pinned entry once it has a refresh closure (fresh
  // pins get one via buildPinManifest; rehydrated pins via rehydratePinRefresh).
  useEffect(() => {
    const ids = Object.keys(pinnedRefresh);
    if (ids.length === 0) return;
    setCountdowns((c) => {
      const next = { ...c };
      let changed = false;
      for (const id of ids) {
        if (next[id] === undefined) {
          next[id] = REFRESH_INTERVAL;
          changed = true;
        }
      }
      return changed ? next : c;
    });
  }, [pinnedRefresh]);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);

  // Pending interactive confirmation (e.g. register an unverified contract).
  // When set, the next Enter routes the typed input through this resolver.
  const [pendingConfirm, setPendingConfirm] = useState<{
    onYes: () => void;
    onNo: () => void;
  } | null>(null);

  // Pending token picker. When a symbol resolves to multiple custom tokens, the
  // CHOICES bar opens and the awaiting command suspends until a choice (or
  // cancel) resolves this Promise. resolve(null) = user cancelled.
  const [pendingTokenPick, setPendingTokenPick] = useState<{
    choices: Array<{ label: string; token: CustomTokenEntry }>;
    resolve: (token: CustomTokenEntry | null) => void;
  } | null>(null);

  // Base input at the moment a pick opened; the picker's arrow-travel
  // live-previews on top of this so repeated previews never pile up.
  const pickBaseInputRef = useRef<string>("");

  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();

  const { open } = useAppKit();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- Pin / unpin (floating right column) --------------------------------
  // Toggle a log entry between the main feed and the pinned column. `refresh`
  // is the live-data loader (only set for widgets with a live source).
  const onPin = (log: LogEntry) => {
    setPinned((prev) => {
      if (prev.some((p) => p.id === log.id)) {
        const next = prev.filter((p) => p.id !== log.id);
        setPinnedRefresh((refs) => {
          const r = { ...refs };
          delete r[log.id];
          return r;
        });
        setCountdowns((c) => {
          const n = { ...c };
          delete n[log.id];
          return n;
        });
        return next;
      }
      // one pinned widget per kind — can't pin a second inbox/price/board, etc.
      if (prev.some((p) => p.kind === log.type)) return prev;
      const manifest: PinnedManifest = buildPinManifest(log);
      return [...prev, manifest];
    });
  };

  const onUnpin = (id: string) => {
    setPinned((prev) => prev.filter((p) => p.id !== id));
    setPinnedRefresh((refs) => {
      const r = { ...refs };
      delete r[id];
      return r;
    });
    setCountdowns((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });
  };

  const onMinimize = (id: string) => {
    setPinned((prev) =>
      prev.map((p) => (p.id === id ? { ...p, minimized: !p.minimized } : p))
    );
  };

  // register a live-data refresh closure for a pinned entry id
  const registerPinRefresh = (id: string, fn: () => Promise<any>) => {
    setPinnedRefresh((refs) => ({ ...refs, [id]: fn }));
  };

  // Rebuild refresh closures from persisted pin manifests (called on connect /
  // import). `kind` tells us which loader to wire; missing params → no refresh
  // (renders the snapshot payload as a static card).
  const rehydratePinRefresh = (manifests: PinnedManifest[]) => {
    const refs: Record<string, () => Promise<any>> = {};
    for (const m of manifests) {
      // price component pins rebuild their refresh from componentData (which
      // persists); api mode doesn't need a chain.
      if (m.kind === "component" && m.componentData?.kind === "price") {
        const cd = m.componentData;
        if (cd.mode === "onchain" && m.chainId && m.dexId && cd.pairAddress) {
          const chain = SUPPORTED_CHAINS.find((c) => c.id === m.chainId);
          const dex = chain
            ? DEX_REGISTRY[m.chainId!]?.find((d) => d.id === m.dexId)
            : undefined;
          if (chain && dex) {
            const pairAddr = cd.pairAddress as Address;
            refs[m.id] = async () => {
              const client = getClient(chain);
              let priceRatio = 0;
              if (dex.type === "V2") {
                const [token0, reserves] = await Promise.all([
                  client.readContract({
                    address: pairAddr,
                    abi: uniV2PairAbi,
                    functionName: "token0"
                  }),
                  client.readContract({
                    address: pairAddr,
                    abi: uniV2PairAbi,
                    functionName: "getReserves"
                  })
                ]);
                const a = (
                  await resolveWithPreferred(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  )
                ).address;
                const reserveA =
                  (token0 as string).toLowerCase() === a.toLowerCase()
                    ? reserves[0]
                    : reserves[1];
                const reserveB =
                  (token0 as string).toLowerCase() === a.toLowerCase()
                    ? reserves[1]
                    : reserves[0];
                const [decA, decB] = await Promise.all([
                  resolveWithPreferredDecimals(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  ).then((t) => t.decimals),
                  resolveWithPreferredDecimals(
                    cd.symbolB as string,
                    cd.symbolBAddress,
                    chain
                  ).then((t) => t.decimals)
                ]);
                const formattedA = parseFloat(formatUnits(reserveA, decA));
                const formattedB = parseFloat(formatUnits(reserveB, decB));
                if (formattedA === 0)
                  throw new Error("Pool reserve for token A is zero.");
                priceRatio = formattedB / formattedA;
              } else {
                const [token0, slot0] = await Promise.all([
                  client.readContract({
                    address: pairAddr,
                    abi: parseAbi(["function token0() view returns (address)"]),
                    functionName: "token0"
                  }),
                  client.readContract({
                    address: pairAddr,
                    abi: uniV3PoolAbi,
                    functionName: "slot0"
                  })
                ]);
                const a = (
                  await resolveWithPreferred(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  )
                ).address;
                const isTokenA0 =
                  (token0 as string).toLowerCase() === a.toLowerCase();
                const sqrtPriceFloat = Number(slot0[0]) / 2 ** 96;
                const pRaw = Math.pow(sqrtPriceFloat, 2);
                const [decA, decB] = await Promise.all([
                  resolveWithPreferredDecimals(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  ).then((t) => t.decimals),
                  resolveWithPreferredDecimals(
                    cd.symbolB as string,
                    cd.symbolBAddress,
                    chain
                  ).then((t) => t.decimals)
                ]);
                const dec0 = isTokenA0 ? decA : decB;
                const dec1 = isTokenA0 ? decB : decA;
                const pToken0InToken1 = pRaw * Math.pow(10, dec0 - dec1);
                priceRatio = isTokenA0
                  ? pToken0InToken1
                  : 1 / pToken0InToken1;
              }
              return { componentData: { ...cd, rate: priceRatio } };
            };
          }
        } else if (cd.mode === "api" && cd.tokenSymbol) {
          refs[m.id] = async () => {
            const q = `${cd.tokenSymbol} ${cd.quoteSymbol || ""}`;
            const res = await fetch(
              `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
            );
            if (!res.ok) throw new Error(`DexScreener returned ${res.status}`);
            const data = await res.json();
            const pairs: any[] = data.pairs || [];
            const chainSlug = m.chainId
              ? DEXSCREENER_CHAIN[m.chainId]
              : undefined;
            const pair =
              pairs.find(
                (p: any) =>
                  (!chainSlug || p.chainId.toLowerCase() === chainSlug) &&
                  p.baseToken.symbol.toLowerCase() ===
                    cd.tokenSymbol.toLowerCase() &&
                  p.quoteToken.symbol.toLowerCase() ===
                    cd.quoteSymbol.toLowerCase()
              ) ||
              pairs.find((p: any) => p.dexId === cd.dex) ||
              pairs[0];
            if (!pair) throw new Error("No fresh DexScreener data for this pair.");
            return {
              componentData: {
                ...cd,
                priceUsd: pair.priceUsd,
                priceNative: pair.priceNative,
                h24: pair.priceChange?.h24
              }
            };
          };
        }
        continue;
      }
      if (!m.chainId || !address) continue;
      const chain = SUPPORTED_CHAINS.find((c) => c.id === m.chainId);
      if (!chain) continue;
      if (m.kind === "billboard" && m.contract) {
        const c = m.contract as Address;
        const count = m.count || 5;
        refs[m.id] = async () => {
          const client = getClient(chain);
          const total = (await client.readContract({
            address: c,
            abi: billboardAbi,
            functionName: "postCount"
          })) as bigint;
          const posts = ((await client.readContract({
            address: c,
            abi: billboardAbi,
            functionName: "getLatest",
            args: [BigInt(count), 0n]
          })) as unknown as BillboardPost[]).map((x) => ({
            ...x,
            timestamp: Number(x.timestamp)
          }));
          return {
            posts,
            total: Number(total),
            pageSize: count,
            onLoadPage: (offset: number) =>
              client
                .readContract({
                  address: c,
                  abi: billboardAbi,
                  functionName: "getLatest",
                  args: [BigInt(count), BigInt(Math.max(0, offset))]
                })
                .then((r) =>
                  (r as unknown as BillboardPost[]).map((x) => ({
                    ...x,
                    timestamp: Number(x.timestamp)
                  }))
                )
          };
        };
      } else if (m.kind === "balance") {
        refs[m.id] = async () =>
          fetchTokenBalanceData(address as Address, chain, m.token);
      } else if (m.kind === "portfolio") {
        refs[m.id] = async () => ({
          holdings: await fetchPortfolioHoldings(
            address as Address,
            m.filterType
          )
        });
      } else if (m.kind === "chat" && m.contract && m.peer) {
        const contract = m.contract as Address;
        const peer = m.peer as Address;
        const self = getAddress(address);
        refs[m.id] = async () => {
          const client = getClient(chain);
          const count = (await client.readContract({
            address: contract,
            abi: chatAbi,
            functionName: "threadCount",
            args: [self, peer]
          })) as bigint;
          const msgs = (await client.readContract({
            address: contract,
            abi: chatAbi,
            functionName: "getThread",
            args: [self, peer, 0n, count]
          })) as readonly {
            from: string;
            timestamp: bigint;
            iv: string;
            ciphertext: string;
            senderKey: string;
          }[];
          const myPair = await getChatKeyPair();
          const messages: ChatMessage[] = [];
          for (const mm of msgs) {
            try {
              const aesKey = await deriveAesKey(
                myPair.privateKey,
                hexToBytes(mm.senderKey)
              );
              const text = await decryptMessage(aesKey, {
                iv: hexToBytes(mm.iv),
                ciphertext: hexToBytes(mm.ciphertext)
              });
              messages.push({
                from: mm.from,
                timestamp: Number(mm.timestamp),
                iv: mm.iv,
                ciphertext: mm.ciphertext,
                decrypted: text
              });
            } catch {
              messages.push({
                from: mm.from,
                timestamp: Number(mm.timestamp),
                iv: mm.iv,
                ciphertext: mm.ciphertext,
                decryptFailed: true
              });
            }
          }
          const peerLabel = (await ensNameFor(peer)) || undefined;
          return { messages, peer, self, peerLabel };
        };
      }
    }
    setPinnedRefresh(refs);
  };

  // Convert a log entry into a serializable pin manifest + (where possible) a
  // live refresh closure. `refresh` is what the 60s tick re-runs.
  const buildPinManifest = (log: LogEntry): PinnedManifest => {
    const base: PinnedManifest = {
      id: log.id,
      kind: log.type,
      title: log.title || log.type.toUpperCase(),
      payload: log.payload || (log.text ? { text: log.text } : {}),
      // component-kind logs (price/swap/pool/deploy/export) render a React
      // element rather than a payload — carry it so the pinned panel can
      // render it. Stripped before persist/export.
      component: log.type === "component" ? log.component : undefined,
      // render data for re-theming a pinned component widget
      componentData: log.componentData
    };
    const p = log.payload || {};

    if (log.type === "billboard") {
      base.title = "BOARD";
      base.chainId = activeChainId || undefined;
      base.contract = (BILLBOARD_CONTRACT[activeChainId || 0] as string) || undefined;
      base.count = Number(p.pageSize) || 5;
      if (base.chainId && base.contract) {
        registerPinRefresh(log.id, async () => {
          const chain = SUPPORTED_CHAINS.find((c) => c.id === base.chainId)!;
          const client = getClient(chain);
          const total = (await client.readContract({
            address: base.contract as Address,
            abi: billboardAbi,
            functionName: "postCount"
          })) as bigint;
          const posts = ((await client.readContract({
            address: base.contract as Address,
            abi: billboardAbi,
            functionName: "getLatest",
            args: [BigInt(base.count || 5), 0n]
          })) as unknown as BillboardPost[]).map((x) => ({
            ...x,
            timestamp: Number(x.timestamp)
          }));
          return {
            posts,
            total: Number(total),
            pageSize: base.count || 5,
            onLoadPage: (offset: number) =>
              client
                .readContract({
                  address: base.contract as Address,
                  abi: billboardAbi,
                  functionName: "getLatest",
                  args: [BigInt(base.count || 5), BigInt(Math.max(0, offset))]
                })
                .then((r) =>
                  (r as unknown as BillboardPost[]).map((x) => ({
                    ...x,
                    timestamp: Number(x.timestamp)
                  }))
                )
          };
        });
      }
    } else if (log.type === "balance") {
      base.title = `BALANCE${p.symbol ? ` ${p.symbol}` : ""}`;
      base.chainId = activeChainId || undefined;
      // balance payload = { balance, symbol }; store the symbol as the token
      // query (native is implied by symbol matching chain native)
      base.token = p.symbol as string | undefined;
      if (address && base.chainId) {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === base.chainId)!;
        const queryToken = base.token;
        registerPinRefresh(log.id, async () => {
          return fetchTokenBalanceData(address as Address, chain, queryToken);
        });
      }
    } else if (log.type === "portfolio") {
      base.title = "PORTFOLIO";
      base.chainId = activeChainId || undefined;
      base.filterType = p.filterType;
      if (address) {
        registerPinRefresh(log.id, async () => {
          const holdings = await fetchPortfolioHoldings(
            address as Address,
            base.filterType
          );
          return { holdings };
        });
      }
    } else if (log.type === "chat") {
      base.title = "CHAT";
      base.chainId = activeChainId || undefined;
      base.contract = (CHAT_CONTRACT[activeChainId || 0] as string) || undefined;
      base.peer = p.peer;
      if (address && base.chainId && base.contract && base.peer) {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === base.chainId)!;
        const contract = base.contract as Address;
        const peer = base.peer;
        const self = getAddress(address);
        registerPinRefresh(log.id, async () => {
          const client = getClient(chain);
          const count = (await client.readContract({
            address: contract,
            abi: chatAbi,
            functionName: "threadCount",
            args: [self, peer as Address]
          })) as bigint;
          const msgs = (await client.readContract({
            address: contract,
            abi: chatAbi,
            functionName: "getThread",
            args: [self, peer as Address, 0n, count]
          })) as readonly {
            from: string;
            timestamp: bigint;
            iv: string;
            ciphertext: string;
            senderKey: string;
          }[];
          const myPair = await getChatKeyPair();
          const messages: ChatMessage[] = [];
          for (const m of msgs) {
            try {
              const iv = hexToBytes(m.iv);
              const ct = hexToBytes(m.ciphertext);
              const senderPub = hexToBytes(m.senderKey);
              const aesKey = await deriveAesKey(myPair.privateKey, senderPub);
              const text = await decryptMessage(aesKey, { iv, ciphertext: ct });
              messages.push({
                from: m.from,
                timestamp: Number(m.timestamp),
                iv: m.iv,
                ciphertext: m.ciphertext,
                decrypted: text
              });
            } catch {
              messages.push({
                from: m.from,
                timestamp: Number(m.timestamp),
                iv: m.iv,
                ciphertext: m.ciphertext,
                decryptFailed: true
              });
            }
          }
          const peerLabel = (await ensNameFor(peer)) || undefined;
          return { messages, peer, self, peerLabel };
        });
      }
    } else if (
      log.type === "component" &&
      log.componentData?.kind === "price"
    ) {
      const cd = log.componentData;
      base.source = cd.mode; // "pool" | "api"
      if (cd.mode === "onchain") {
        // re-run the on-chain pool price fetch
        base.chainId = activeChainId || undefined;
        base.dexId = activeDexId || undefined;
        const pairAddr = cd.pairAddress as Address | undefined;
        if (base.chainId && base.dexId && pairAddr) {
          const chain = SUPPORTED_CHAINS.find((c) => c.id === base.chainId)!;
          const dex = DEX_REGISTRY[base.chainId]?.find(
            (d) => d.id === base.dexId
          );
          if (chain && dex) {
            registerPinRefresh(log.id, async () => {
              const client = getClient(chain);
              let priceRatio = 0;
              if (dex.type === "V2") {
                const [token0, reserves] = await Promise.all([
                  client.readContract({
                    address: pairAddr,
                    abi: uniV2PairAbi,
                    functionName: "token0"
                  }),
                  client.readContract({
                    address: pairAddr,
                    abi: uniV2PairAbi,
                    functionName: "getReserves"
                  })
                ]);
                const symA = cd.symbolA as string;
                const a = (
                  await resolveWithPreferred(symA, cd.symbolAAddress, chain)
                ).address;
                const reserveA =
                  (token0 as string).toLowerCase() === a.toLowerCase()
                    ? reserves[0]
                    : reserves[1];
                const reserveB =
                  (token0 as string).toLowerCase() === a.toLowerCase()
                    ? reserves[1]
                    : reserves[0];
                const [decA, decB] = await Promise.all([
                  resolveWithPreferredDecimals(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  ).then((t) => t.decimals),
                  resolveWithPreferredDecimals(
                    cd.symbolB as string,
                    cd.symbolBAddress,
                    chain
                  ).then((t) => t.decimals)
                ]);
                const formattedA = parseFloat(formatUnits(reserveA, decA));
                const formattedB = parseFloat(formatUnits(reserveB, decB));
                if (formattedA === 0) throw new Error("Pool reserve for token A is zero.");
                priceRatio = formattedB / formattedA;
              } else {
                const [token0, slot0] = await Promise.all([
                  client.readContract({
                    address: pairAddr,
                    abi: parseAbi(["function token0() view returns (address)"]),
                    functionName: "token0"
                  }),
                  client.readContract({
                    address: pairAddr,
                    abi: uniV3PoolAbi,
                    functionName: "slot0"
                  })
                ]);
                const a = (
                  await resolveWithPreferred(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  )
                ).address;
                const isTokenA0 =
                  (token0 as string).toLowerCase() === a.toLowerCase();
                const sqrtPriceFloat = Number(slot0[0]) / 2 ** 96;
                const pRaw = Math.pow(sqrtPriceFloat, 2);
                const [decA, decB] = await Promise.all([
                  resolveWithPreferredDecimals(
                    cd.symbolA as string,
                    cd.symbolAAddress,
                    chain
                  ).then((t) => t.decimals),
                  resolveWithPreferredDecimals(
                    cd.symbolB as string,
                    cd.symbolBAddress,
                    chain
                  ).then((t) => t.decimals)
                ]);
                const dec0 = isTokenA0 ? decA : decB;
                const dec1 = isTokenA0 ? decB : decA;
                const pToken0InToken1 = pRaw * Math.pow(10, dec0 - dec1);
                priceRatio = isTokenA0
                  ? pToken0InToken1
                  : 1 / pToken0InToken1;
              }
              return {
                componentData: {
                  ...cd,
                  rate: priceRatio
                }
              };
            });
          }
        }
      } else {
        // api mode: re-fetch DexScreener for the same pair query
        registerPinRefresh(log.id, async () => {
          const q = `${cd.tokenSymbol} ${cd.quoteSymbol}`;
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
          );
          if (!res.ok) throw new Error(`DexScreener returned ${res.status}`);
          const data = await res.json();
          const pairs: any[] = data.pairs || [];
          const chainSlug = DEXSCREENER_CHAIN[activeChainId || 0];
          const pair =
            pairs.find(
              (p: any) =>
                (!chainSlug || p.chainId.toLowerCase() === chainSlug) &&
                p.baseToken.symbol.toLowerCase() ===
                  cd.tokenSymbol.toLowerCase() &&
                p.quoteToken.symbol.toLowerCase() ===
                  cd.quoteSymbol.toLowerCase()
            ) ||
            pairs.find((p: any) => p.dexId === cd.dex) ||
            pairs[0];
          if (!pair) throw new Error("No fresh DexScreener data for this pair.");
          return {
            componentData: {
              ...cd,
              priceUsd: pair.priceUsd,
              priceNative: pair.priceNative,
              h24: pair.priceChange?.h24
            }
          };
        });
      }
    }

    return base;
  };

  const savePreference = (key: string, value: any) => {
    if (!isConnected || !address) return;
    const storageKey = `0xterm_user_${address.toLowerCase()}`;
    try {
      const existing = localStorage.getItem(storageKey);
      const prefs = existing ? JSON.parse(existing) : {};
      prefs[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch (e) {
      console.error("Failed to save preference", e);
    }
  };

  // Persist pin manifests whenever they change (so they survive reload + export)
  useEffect(() => {
    if (!isConnected || !address) return;
    const serializable = pinned.map(({ payload, component, ...rest }) => rest);
    savePreference("pinned", serializable);
  }, [pinned, isConnected, address]);

  // True once prefs have been loaded on connect. Persisting logs/history before
  // that would clobber saved scrollback with the default banner lines.
  const prefsLoaded = useRef(false);

  // Persist the terminal scrollback (logs) and up/down command history so the
  // screen looks the same after a refresh. `component`/`componentData` React
  // elements aren't serializable, so strip them; text/input logs survive as-is.
  useEffect(() => {
    if (!isConnected || !address || !prefsLoaded.current) return;
    const serializableLogs = logs.map(({ component, componentData, ...rest }) =>
      rest
    );
    savePreference("logs", serializableLogs.slice(-MAX_LOGS));
    savePreference("history", history.slice(-100));
  }, [logs, history, isConnected, address]);

  const saveCustomTokenToStorage = (updatedTokens: typeof customTokens) => {
    if (!isConnected || !address) return;
    const storageKey = `0xterm_custom_tokens_${address.toLowerCase()}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedTokens));
    } catch (e) {
      console.error("Failed to save custom tokens", e);
    }
  };

  const prevConnected = useRef(isConnected);

  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      trackEvent("wallet_connect");
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      const storageKey = `0xterm_user_${address.toLowerCase()}`;
      const tokensKey = `0xterm_custom_tokens_${address.toLowerCase()}`;
      try {
        const savedTokens = localStorage.getItem(tokensKey);
        if (savedTokens) {
          setCustomTokens(migrateCustomTokens(JSON.parse(savedTokens)));
        }

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const prefs = JSON.parse(saved);
          const loadedDetails: string[] = [];

          if (prefs.theme) {
            const themeKey = resolveThemeKey(prefs.theme);
            onThemeChange(themeKey);
            loadedDetails.push(`Theme: ${THEMES[themeKey].name}`);
          }

          if (prefs.rpcProviders) setRpcProviders(prefs.rpcProviders);
          if (prefs.activeRpcProviders)
            setActiveRpcProviders(prefs.activeRpcProviders);

          if (Array.isArray(prefs.pinned) && prefs.pinned.length > 0) {
            setPinned(prefs.pinned);
            rehydratePinRefresh(prefs.pinned);
          }

          if (Array.isArray(prefs.logs)) {
            setLogs((prev) => [...prefs.logs].slice(-MAX_LOGS));
          }
          if (Array.isArray(prefs.history)) {
            setHistory((prev) => [...prev, ...prefs.history].slice(-100));
          }

          if (prefs.chainId) {
            const chainObj = SUPPORTED_CHAINS.find(
              (c) => c.id === prefs.chainId
            );
            if (chainObj) {
              setActiveChainId(chainObj.id);
              const dexes = DEX_REGISTRY[chainObj.id] || [];
              if (prefs.dexId && dexes.some((d) => d.id === prefs.dexId)) {
                setActiveDexId(prefs.dexId);
              } else if (dexes.length > 0) {
                setActiveDexId(dexes[0].id);
              }
              loadedDetails.push(`Network: ${chainObj.name}`);
            }
          }

          if (loadedDetails.length > 0) {
            setLogs((prev) =>
              [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "text",
                  text: `[✓] Profile loaded for wallet ${address.slice(0, 6)}...${address.slice(-4)} (${loadedDetails.join(" | ")})`
                } as LogEntry
              ].slice(-MAX_LOGS)
            );
          }
        }
      } catch (e) {
        console.error("Failed to load user preferences", e);
      } finally {
        prefsLoaded.current = true;
      }
    }
  }, [isConnected, address]);

  // Helper to create public client using active custom RPC provider or fallback to default
  const getClient = (chain: Chain) => {
    const chainProviders = rpcProviders[chain.id] || {};
    const activeName = activeRpcProviders[chain.id] || "default";
    const activeUrl = chainProviders[activeName];
    return createPublicClient({
      chain,
      transport: activeUrl ? http(activeUrl) : http()
    });
  };

  // --- Chat helpers (encrypted 1:1 messaging) -----------------------------
  // The messaging key pair derives from a wallet signature on KEY_MESSAGE. We
  // cache the derived pair in a ref so repeated chat/inbox calls don't re-sign.
  const chatKeyCache = useRef<import("../../lib/chatCrypto").ChatKeyPair | null>(null);

  const getChatKeyPair = async (): Promise<import("../../lib/chatCrypto").ChatKeyPair> => {
    if (!isConnected || !address) throw new Error("Connect a wallet to use chat.");
    // cache first — signing "0xterm.chat.v1" is only needed once per session;
    // without this, every chat/inbox would re-prompt the user to sign
    if (chatKeyCache.current) return chatKeyCache.current;
    const sig = await signMessageAsync({ message: KEY_MESSAGE });
    const pair = await deriveKeysFromSignature(sig);
    chatKeyCache.current = pair;
    return pair;
  };

  const chatContractAddress = (chainId: number): string | null =>
    CHAT_CONTRACT[chainId] || null;

  // ENS resolves on the ACTIVE chain. Mainnet uses viem's canonical v1
  // universal resolver; testnets use 0xterm's own ENS contract (ENS_CONTRACT),
  // since public testnets run ENSv2 (beta) or deprecated v1.
  const resolveChatRecipient = async (input: string): Promise<Address> => {
    const trimmed = input.trim();
    if (isAddress(trimmed)) return getAddress(trimmed);

    const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
    if (!chain) throw new Error("Set a network first (network <name|id>).");

    if (chain.id === 1) {
      const addr = await getClient(chain).getEnsAddress({ name: trimmed });
      if (!addr)
        throw new Error(`"${trimmed}" has no record on Ethereum mainnet.`);
      return addr;
    }

    const contract = ENS_CONTRACT[chain.id];
    if (!contract)
      throw new Error(
        `No ENS on ${chain.name} yet — deploy via contracts/script/EnsDeploy.md.`
      );
    const node = namehash(trimmed.toLowerCase());
    const addr = (await getClient(chain).readContract({
      address: contract as Address,
      abi: ensRegistryAbi,
      functionName: "addr",
      args: [node]
    })) as `0x${string}`;
    if (addr === "0x0000000000000000000000000000000000000000")
      throw new Error(`"${trimmed}" is not registered on ${chain.name} ENS.`);
    return addr;
  };

  const ensNameFor = async (addr: string): Promise<string | null> => {
    try {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain) return null;

      if (chain.id === 1) {
        return (
          (await getClient(chain).getEnsName({ address: getAddress(addr) })) ||
          null
        );
      }

      const contract = ENS_CONTRACT[chain.id];
      if (!contract) return null;
      const name = (await getClient(chain).readContract({
        address: contract as Address,
        abi: ensRegistryAbi,
        functionName: "nameOfAddr",
        args: [getAddress(addr)]
      })) as string;
      return name || null;
    } catch {
      return null;
    }
  };

  const handleThemeSwitch = (newTheme: ThemeMode) => {
    onThemeChange(newTheme);
    savePreference("theme", newTheme);
  };

  // Detect whether an address is a valid ERC-20 or ERC-721 contract by probing
  // its interface (ERC-165) and core standard functions. Returns the verified
  // type plus metadata, or null if it doesn't clearly match either standard.
  const detectTokenType = async (
    address: Address,
    chain: Chain,
    hint?: "erc20" | "erc721"
  ): Promise<
    | { type: "erc20"; name: string; symbol: string; decimals: number }
    | { type: "erc721"; name: string; symbol: string }
    | null
  > => {
    const client = getClient(chain);

    // ERC-165 interface probe
    let erc165 = false;
    try {
      erc165 = Boolean(
        await client.readContract({
          address,
          abi: erc165Abi,
          functionName: "supportsInterface",
          args: [INTERFACE_ID_ERC165]
        })
      );
    } catch {
      erc165 = false;
    }

    if (erc165) {
      // Confirm it is NOT ERC-721 when checking for ERC-20 and vice versa
      if (hint !== "erc20") {
        try {
          const is721 = Boolean(
            await client.readContract({
              address,
              abi: erc165Abi,
              functionName: "supportsInterface",
              args: [INTERFACE_ID_ERC721]
            })
          );
          if (is721) {
            let name = "",
              symbol = "";
            try {
              const [n, s] = await Promise.all([
                client.readContract({
                  address,
                  abi: erc721Abi,
                  functionName: "name"
                }),
                client.readContract({
                  address,
                  abi: erc721Abi,
                  functionName: "symbol"
                })
              ]);
              name = String(n);
              symbol = String(s);
            } catch {}
            return { type: "erc721", name, symbol };
          }
        } catch {}
      }
      try {
        const is20 = Boolean(
          await client.readContract({
            address,
            abi: erc165Abi,
            functionName: "supportsInterface",
            args: [INTERFACE_ID_ERC20]
          })
        );
        if (is20 && hint !== "erc721") {
          const [decimals, sym, name] = await Promise.all([
            client.readContract({
              address,
              abi: erc20FullAbi,
              functionName: "decimals"
            }),
            client.readContract({
              address,
              abi: erc20FullAbi,
              functionName: "symbol"
            }),
            client.readContract({
              address,
              abi: erc20FullAbi,
              functionName: "name"
            })
          ]);
          return {
            type: "erc20",
            name: String(name),
            symbol: String(sym),
            decimals: Number(decimals)
          };
        }
      } catch {}
    }

    // Fallback: probe core functions directly (many tokens lack ERC-165).
    const erc721Candidates = hint === "erc20" ? [] : ["ownerOf", "tokenURI"];
    for (const fn of erc721Candidates) {
      try {
        await client.readContract({
          address,
          abi: erc721Abi,
          functionName: fn as any
        });
        let name = "",
          symbol = "";
        try {
          const [n, s] = await Promise.all([
            client.readContract({
              address,
              abi: erc721Abi,
              functionName: "name"
            }),
            client.readContract({
              address,
              abi: erc721Abi,
              functionName: "symbol"
            })
          ]);
          name = String(n);
          symbol = String(s);
        } catch {}
        return { type: "erc721", name, symbol };
      } catch {}
    }

    // ERC-20 fallback: totalSupply + decimals + symbol + name must all succeed
    if (hint !== "erc721") {
      try {
        const [total, dec, sym, name] = await Promise.all([
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "totalSupply"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "decimals"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "symbol"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "name"
          })
        ]);
        return {
          type: "erc20",
          name: String(name),
          symbol: String(sym),
          decimals: Number(dec)
        };
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleChainSwitch = (chainId: number) => {
    setActiveChainId(chainId);
    savePreference("chainId", chainId);
    const dexes = DEX_REGISTRY[chainId] || [];
    if (dexes.length > 0) {
      setActiveDexId(dexes[0].id);
      savePreference("dexId", dexes[0].id);
    } else {
      setActiveDexId(null);
      savePreference("dexId", null);
    }
  };

  const resolveTokenDetails = async (queryToken: string, chain: Chain) => {
    const sym = queryToken.toUpperCase();
    const isNative =
      sym === chain.nativeCurrency.symbol ||
      sym === "ETH" ||
      queryToken === NATIVE_TOKEN_ADDRESS;
    if (isNative)
      return {
        address: NATIVE_TOKEN_ADDRESS as Address,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: 18,
        isNative: true
      };

    const customList = customTokens[chain.id] || [];

    // Normalize a custom entry to the fully-resolved shape callers expect
    // (decimals is required there; default 18 like ERC-20 convention).
    const asResolved = (t: CustomTokenEntry) => ({
      address: t.address as Address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals ?? 18,
      isNative: false
    });

    // Picked autocomplete label: SYM@0xaddr — resolve deterministically
    // (never re-picks). The label's address part is truncated (0x7f83…0501), so
    // match the symbol prefix first, then fall back to a full address if given.
    const atIdx = queryToken.indexOf("@");
    if (atIdx !== -1) {
      const symPart = queryToken.slice(0, atIdx).toUpperCase();
      const addrPart = queryToken.slice(atIdx + 1).trim();
      if (addrPart.startsWith("0x") && isAddress(addrPart)) {
        const byLabel = customList.find(
          (t) => t.address.toLowerCase() === (addrPart as string).toLowerCase()
        );
        if (byLabel) return asResolved(byLabel);
      } else {
        const byLabel = customList.find(
          (t) => t.symbol.toUpperCase() === symPart
        );
        if (byLabel) return asResolved(byLabel);
      }
    }

    // Exact address match against registered custom tokens.
    if (isAddress(queryToken)) {
      const byAddr = customList.find(
        (t) => t.address.toLowerCase() === (queryToken as string).toLowerCase()
      );
      if (byAddr) return asResolved(byAddr);
    }

    // Plain symbol: the hardcoded COMMON token wins when present — the @-label
    // is how the user explicitly targets a custom token (custom shadows
    // hardcoded only via the @-qualified form or when no common token exists).
    const common = COMMON_TOKENS[chain.id]?.[sym];
    if (common) return { ...common, isNative: false };

    // No hardcoded token: fall back to custom entries by symbol. A single match
    // resolves directly; multiple matches need the CHOICES picker.
    const matches = customList.filter(
      (t) => t.symbol.toUpperCase() === sym
    );
    if (matches.length === 1) return asResolved(matches[0]);
    if (matches.length > 1) {
      const chosen = await openTokenPicker(matches, chain);
      if (!chosen)
        throw new Error(
          `Token selection cancelled for symbol "${sym}" on ${chain.name}.`
        );
      return asResolved(chosen);
    }

    const client = getClient(chain);
    if (isAddress(queryToken)) {
      const addr = queryToken as Address;
      try {
        const [decimals, tokenSymbol, name] = await Promise.all([
          client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "symbol"
          }),
          client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "name"
          })
        ]);
        return {
          address: addr,
          symbol: String(tokenSymbol),
          name: String(name),
          decimals: Number(decimals),
          isNative: false
        };
      } catch {
        return {
          address: addr,
          symbol: `${addr.slice(0, 6)}...`,
          name: "Custom Token",
          decimals: 18,
          isNative: false
        };
      }
    }

    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${queryToken}`
      );
      const data = await res.json();
      const pair = data.pairs?.find(
        (p: { chainId: string }) =>
          p.chainId.toLowerCase() === chain.name.toLowerCase() ||
          p.chainId === "ethereum"
      );

      if (pair?.baseToken?.address && isAddress(pair.baseToken.address)) {
        const addr = pair.baseToken.address as Address;
        try {
          const decimals = await client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "decimals"
          });
          return {
            address: addr,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            decimals: Number(decimals),
            isNative: false
          };
        } catch {
          return {
            address: addr,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            decimals: 18,
            isNative: false
          };
        }
      }
    } catch {
      // Ignore fetch errors during token resolution
    }

    throw new Error(
      `Unable to resolve token "${queryToken}" on ${chain.name}. Register it first using 'register <address>'.`
    );
  };

  // Pin-refresh resolution: prefer the persisted token address (deterministic,
  // never opens the picker), falling back to symbol resolution for legacy pins.
  const resolveWithPreferred = async (
    symbol: string | undefined,
    preferredAddr: string | undefined,
    chain: Chain
  ) => {
    if (preferredAddr && isAddress(preferredAddr)) {
      const byAddr = (customTokens[chain.id] || []).find(
        (t) => t.address.toLowerCase() === preferredAddr.toLowerCase()
      );
      if (byAddr) return byAddr;
      // not a custom token — read on-chain metadata directly (no picker)
      try {
        const client = getClient(chain);
        const [decimals, name] = await Promise.all([
          client.readContract({
            address: preferredAddr as Address,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          client.readContract({
            address: preferredAddr as Address,
            abi: erc20Abi,
            functionName: "name"
          })
        ]);
        return {
          id: `c_${preferredAddr.toLowerCase()}`,
          address: preferredAddr as Address,
          symbol: symbol || "TOKEN",
          name: String(name),
          decimals: Number(decimals),
          isNative: false
        };
      } catch {
        // fall through to symbol resolution
      }
    }
    return resolveTokenDetails(symbol || "", chain);
  };

  // Resolve with decimals normalized to a concrete number (callers like the
  // pin-price refresh use decimals directly in arithmetic).
  const resolveWithPreferredDecimals = async (
    symbol: string | undefined,
    preferredAddr: string | undefined,
    chain: Chain
  ) => {
    const t = await resolveWithPreferred(symbol, preferredAddr, chain);
    return { ...t, decimals: t.decimals ?? 18 };
  };

  const fetchPoolAddress = async (
    queryA: string,
    queryB: string,
    targetChain: Chain,
    activeDex: DexProtocol,
    feeTierArg?: string
  ) => {
    const [tokenA, tokenB] = await Promise.all([
      resolveTokenDetails(queryA, targetChain),
      resolveTokenDetails(queryB, targetChain)
    ]);

    const addrA = tokenA.isNative
      ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
      : tokenA.address;
    const addrB = tokenB.isNative
      ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
      : tokenB.address;
    if (addrA.toLowerCase() === addrB.toLowerCase())
      throw new Error("Tokens must be different.");

    const client = getClient(targetChain);
    let pairAddress: Address | undefined;

    try {
      if (activeDex.type === "V2") {
        pairAddress = await client.readContract({
          address: activeDex.factory,
          abi: uniV2FactoryAbi,
          functionName: "getPair",
          args: [addrA, addrB]
        });
      } else if (activeDex.type === "V3") {
        const feeTier = feeTierArg ? parseInt(feeTierArg) : 3000;
        pairAddress = await client.readContract({
          address: activeDex.factory,
          abi: uniV3FactoryAbi,
          functionName: "getPool",
          args: [addrA, addrB, feeTier]
        });
      }

      if (!pairAddress || pairAddress === NATIVE_TOKEN_ADDRESS) {
        return (
          <div className={`${theme.warn} my-2 p-3 border ${theme.rounded} max-w-md text-xs`}>
            <div className="font-bold mb-1">NO POOL FOUND</div>
            <div>
              No {activeDex.type} pool exists for {tokenA.symbol}/
              {tokenB.symbol} on {activeDex.name}.
            </div>
          </div>
        );
      }

      return (
        <div
          className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs`}
        >
          <div
            className={`flex justify-between items-center ${theme.text}/70 mb-2 border-b ${theme.border} pb-1`}
          >
            <span className="font-bold">ON-CHAIN POOL LOCATED</span>
            <span>
              {activeDex.name} ({activeDex.type})
            </span>
          </div>
          <div className={`text-lg font-bold ${theme.primary} mb-1`}>
            {tokenA.symbol} / {tokenB.symbol}
          </div>
          <div
            className={`${theme.text} p-2 bg-current/10 rounded border ${theme.border} text-center my-2 font-mono flex items-center justify-center gap-2`}
          >
            <CopyableAddress address={pairAddress} theme={theme} />
          </div>
        </div>
      );
    } catch (err: any) {
      return (
        <div className="text-red-400 my-2 p-3 border border-red-900/50 bg-red-950/30 rounded max-w-md text-xs space-y-1">
          <div className="font-bold">DEBUG ERROR DETAILS:</div>
          <div className="font-mono text-[10px] break-all">
            {err.message || String(err)}
          </div>
        </div>
      );
    }
  };

  const fetchOnChainLiquidity = async (
    poolAddress: string,
    targetChain: Chain
  ) => {
    if (!isAddress(poolAddress))
      return (
        <div className="text-red-400">
          Error: Provide a valid pool contract address (0x...).
        </div>
      );

    const client = getClient(targetChain);

    try {
      const [token0, token1, fee, liquidity, slot0] = await Promise.all([
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function token0() view returns (address)"]),
          functionName: "token0"
        }) as Promise<Address>,
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function token1() view returns (address)"]),
          functionName: "token1"
        }) as Promise<Address>,
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function fee() view returns (uint24)"]),
          functionName: "fee"
        }) as Promise<number>,
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function liquidity() view returns (uint128)"]),
          functionName: "liquidity"
        }) as Promise<bigint>,
        client.readContract({
          address: poolAddress as Address,
          abi: uniV3PoolAbi,
          functionName: "slot0"
        }) as Promise<[bigint, number, number, number, number, number, boolean]>
      ]);

      const [dec0, sym0] = await Promise.all([
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "decimals"
        }) as Promise<number>,
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "symbol"
        }) as Promise<string>
      ]);

      const [dec1, sym1] = await Promise.all([
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "decimals"
        }) as Promise<number>,
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "symbol"
        }) as Promise<string>
      ]);

      return (
        <div
          className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
        >
          <div
            className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
          >
            <span className="font-bold">UNISWAP V3 POOL METRICS</span>
            <span>{targetChain.name.toUpperCase()}</span>
          </div>
          <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
              <div className={`font-bold ${theme.primary}`}>
                {sym0} / {sym1}
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>FEE TIER</div>
              <div className={`font-bold ${theme.primary}`}>
                {Number(fee) / 10000}%
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>
                ACTIVE LIQUIDITY
              </div>
              <div className={`font-bold ${theme.primary}`}>
                {liquidity.toString()}
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>CURRENT TICK</div>
              <div className={`font-bold ${theme.primary}`}>{slot0[1]}</div>
            </div>
          </div>
          <div
            className={`text-[9px] ${theme.text}/40 truncate pt-1 border-t ${theme.border}`}
          >
            SQRT PRICE X96: {slot0[0].toString()}
          </div>
        </div>
      );
    } catch {
      try {
        const [token0, token1, reserves] = await Promise.all([
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "token0"
          }) as Promise<Address>,
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "token1"
          }) as Promise<Address>,
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "getReserves"
          }) as Promise<[bigint, bigint, number]>
        ]);

        const [dec0, sym0] = await Promise.all([
          client.readContract({
            address: token0,
            abi: erc20Abi,
            functionName: "decimals"
          }) as Promise<number>,
          client.readContract({
            address: token0,
            abi: erc20Abi,
            functionName: "symbol"
          }) as Promise<string>
        ]);

        const [dec1, sym1] = await Promise.all([
          client.readContract({
            address: token1,
            abi: erc20Abi,
            functionName: "decimals"
          }) as Promise<number>,
          client.readContract({
            address: token1,
            abi: erc20Abi,
            functionName: "symbol"
          }) as Promise<string>
        ]);

        return (
          <div
            className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
          >
            <div
              className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
            >
              <span className="font-bold">UNISWAP V2 POOL RESERVES</span>
              <span>{targetChain.name.toUpperCase()}</span>
            </div>
            <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  {sym0} RESERVE
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {parseFloat(formatUnits(reserves[0], dec0)).toLocaleString()}
                </div>
              </div>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  {sym1} RESERVE
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {parseFloat(formatUnits(reserves[1], dec1)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      } catch {
        return (
          <div className="text-red-400 my-1 p-2 border border-red-900/50 bg-red-950/30 rounded max-w-md text-xs">
            <div className="font-bold">Failed to read pool contract.</div>
            <div>
              Ensure {poolAddress} is a valid V2 pair or V3 pool address.
            </div>
          </div>
        );
      }
    }
  };

  const fetchTokenBalanceData = async (
    userAddress: Address,
    targetChain: Chain,
    queryToken?: string
  ) => {
    const client = getClient(targetChain);
    if (!queryToken) {
      const bal = await client.getBalance({ address: userAddress });
      return {
        balance: formatEther(bal),
        symbol: targetChain.nativeCurrency.symbol
      };
    }
    const token = await resolveTokenDetails(queryToken, targetChain);
    if (token.isNative) {
      const bal = await client.getBalance({ address: userAddress });
      return { balance: formatEther(bal), symbol: token.symbol };
    }
    const bal = await client.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    });
    return {
      balance: formatUnits(bal as bigint, token.decimals),
      symbol: token.symbol
    };
  };

  // Reusable holdings builder for `portfolio` (and pinned-portfolio refresh).
  // Reads native + registered (COMMON_TOKENS + custom) token balances across
  // all chains, pricing via getTokenPriceUsd.
  const fetchPortfolioHoldings = async (
    userAddress: Address,
    filterType?: string
  ): Promise<PortfolioHolding[]> => {
    const holdings: PortfolioHolding[] = [];

    for (const chain of SUPPORTED_CHAINS) {
      const client = getClient(chain);
      let nativeBal = 0n;
      try {
        nativeBal = await client.getBalance({ address: userAddress });
      } catch {
        nativeBal = 0n;
      }

      const nativePrice = await getTokenPriceUsd(
        chain,
        chain.nativeCurrency.symbol,
        (WRAPPED_NATIVE[chain.id] || NATIVE_TOKEN_ADDRESS) as Address,
        true
      );
      const nativeBalance = formatEther(nativeBal);
      const nativeValue =
        nativePrice !== null ? nativePrice * parseFloat(nativeBalance) : null;

      if (filterType !== "erc20") {
        holdings.push({
          chainName: chain.name,
          chainId: chain.id,
          symbol: chain.nativeCurrency.symbol,
          type: "native",
          balance: nativeBalance,
          priceUsd: nativePrice,
          valueUsd: nativeValue,
          change24h: null,
          priceSource: nativePrice !== null ? "api" : "—",
          isTestnet: !!chain.testnet
        });
      }

      // Custom-first view merged by address: every custom entry (including
      // duplicate symbols), plus COMMON_TOKENS entries not shadowed by a
      // custom token at the same address.
      const customList = customTokens[chain.id] || [];
      const commonMap = COMMON_TOKENS[chain.id] || {};
      const customAddrs = new Set(
        customList.map((t) => t.address.toLowerCase())
      );
      const view = [
        ...customList,
        ...Object.values(commonMap).filter(
          (c) => !customAddrs.has(c.address.toLowerCase())
        )
      ];
      for (const info of view) {
        if (filterType === "native") continue;
        if (info.address === NATIVE_TOKEN_ADDRESS) continue;
        const addr = info.address as Address;
        const symbol = info.symbol;
        try {
          const bal = (await client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [userAddress]
          })) as bigint;
          const decimals = info.decimals ?? 18;
          const formatted = formatUnits(bal, decimals);
          if (parseFloat(formatted) === 0) continue;

          const price = await getTokenPriceUsd(chain, symbol, addr, false);
          holdings.push({
            chainName: chain.name,
            chainId: chain.id,
            symbol,
            type: "erc20",
            address: addr,
            balance: formatted,
            priceUsd: price,
            valueUsd: price !== null ? price * parseFloat(formatted) : null,
            change24h: null,
            priceSource: price !== null ? "api" : "—",
            isTestnet: !!chain.testnet
          });
        } catch {
          // skip tokens that fail to read (e.g. non-ERC20 or wrong chain)
        }
      }
    }

    return holdings;
  };

  // Price a token in USD: DexScreener first, then on-chain V3 pool, then
  // on-chain V2 pool (all quoted against the chain's wrapped native). Native
  // gets priced via DexScreener; tokens derive USD = priceInNative * nativeUsd.
  const getTokenPriceUsd = async (
    chain: Chain,
    symbol: string,
    address: Address,
    isNative: boolean
  ): Promise<number | null> => {
    // 1) DexScreener
    const slug = DEXSCREENER_CHAIN[chain.id];
    if (slug) {
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`
        );
        if (res.ok) {
          const data = await res.json();
          const pairs: any[] = data.pairs || [];
          const pair = pairs.find(
            (p: any) =>
              p.chainId.toLowerCase() === slug &&
              (isNative
                ? true
                : p.baseToken.symbol.toLowerCase() === symbol.toLowerCase() &&
                  p.baseToken.address?.toLowerCase() ===
                    address.toLowerCase())
          );
          if (pair && pair.priceUsd) {
            const usd = parseFloat(pair.priceUsd);
            if (Number.isFinite(usd) && usd > 0) return usd;
          }
        }
      } catch {
        // fall through to on-chain
      }
    }

    // Native: priced via DexScreener only (no pool pair to read).
    if (isNative) return getNativePriceUsd(chain);

    // 2) On-chain V3 pool (quote vs wrapped native)
    // 3) On-chain V2 pool (quote vs wrapped native)
    const dexes = DEX_REGISTRY[chain.id] || [];
    const wrappedNative = WRAPPED_NATIVE[chain.id];
    if (!wrappedNative || dexes.length === 0) return null;

    const client = getClient(chain);
    const nativeUsd = await getNativePriceUsd(chain);
    if (nativeUsd === null) return null;

    for (const dex of dexes) {
      if (dex.type === "V3") {
        for (const feeTier of [3000, 500, 10000]) {
          try {
            const pool = (await client.readContract({
              address: dex.factory,
              abi: uniV3FactoryAbi,
              functionName: "getPool",
              args: [address, wrappedNative, feeTier]
            })) as Address;
            if (!pool || pool === NATIVE_TOKEN_ADDRESS) continue;
            const [token0, slot0] = await Promise.all([
              client.readContract({
                address: pool,
                abi: parseAbi(["function token0() view returns (address)"]),
                functionName: "token0"
              }),
              client.readContract({
                address: pool,
                abi: uniV3PoolAbi,
                functionName: "slot0"
              })
            ]);
            const sqrtPrice = Number(slot0[0]) / 2 ** 96;
            const pRaw = Math.pow(sqrtPrice, 2);
            const isToken0 =
              (token0 as string).toLowerCase() === address.toLowerCase();
            const priceInNative = isToken0 ? pRaw : 1 / pRaw;
            return priceInNative * nativeUsd;
          } catch {
            continue;
          }
        }
      } else if (dex.type === "V2") {
        try {
          const pair = (await client.readContract({
            address: dex.factory,
            abi: uniV2FactoryAbi,
            functionName: "getPair",
            args: [address, wrappedNative]
          })) as Address;
          if (!pair || pair === NATIVE_TOKEN_ADDRESS) continue;
          const [token0, reserves] = await Promise.all([
            client.readContract({
              address: pair,
              abi: uniV2PairAbi,
              functionName: "token0"
            }),
            client.readContract({
              address: pair,
              abi: uniV2PairAbi,
              functionName: "getReserves"
            })
          ]);
          const isToken0 =
            (token0 as string).toLowerCase() === address.toLowerCase();
          const reserveToken = isToken0 ? reserves[0] : reserves[1];
          const reserveNative = isToken0 ? reserves[1] : reserves[0];
          if (reserveNative === 0n) continue;
          const priceInNative =
            Number(reserveToken) / Number(reserveNative);
          return priceInNative * nativeUsd;
        } catch {
          continue;
        }
      }
    }
    return null;
  };

  // Native token USD price via DexScreener (cache per chain in-memory).
  const nativePriceCache: Record<number, number | null> = {};
  const getNativePriceUsd = async (chain: Chain): Promise<number | null> => {
    if (chain.id in nativePriceCache) return nativePriceCache[chain.id];
    const slug = DEXSCREENER_CHAIN[chain.id];
    let price: number | null = null;
    if (slug) {
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(chain.nativeCurrency.symbol)}`
        );
        if (res.ok) {
          const data = await res.json();
          const pair = (data.pairs || []).find(
            (p: any) => p.chainId.toLowerCase() === slug
          );
          if (pair && pair.priceUsd) {
            const usd = parseFloat(pair.priceUsd);
            if (Number.isFinite(usd) && usd > 0) price = usd;
          }
        }
      } catch {
        // leave null
      }
    }
    nativePriceCache[chain.id] = price;
    return price;
  };

  // --- new-message poller ----------------------------------------------
  // Background check every 60s for unread chat messages. When a new message is
  // found it prints a notification (no pause — running `inbox` is just a manual
  // fetch; the poller keeps going and only reports genuinely new messages).
  const chatBaseline = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isConnected || !address) return;
    const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
    const contract = chain ? chatContractAddress(chain.id) : null;
    if (!chain || !contract) return;

    const me = getAddress(address);
    const client = getClient(chain);

    const check = async () => {
      try {
        const senders = (await client.readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "getSenders",
          args: [me]
        })) as readonly Address[];

        const fresh: Record<string, number> = {};
        let newest: Address | null = null;
        let newestCount = 0;
        for (const s of senders) {
          const count = Number(
            await client.readContract({
              address: contract as Address,
              abi: chatAbi,
              functionName: "threadCount",
              args: [me, s]
            })
          );
          fresh[s.toLowerCase()] = count;
          if (count > 0 && count > (chatBaseline.current[s.toLowerCase()] || 0)) {
            if (!newest || count > newestCount) {
              newest = s;
              newestCount = count;
            }
          }
        }

        // First run: just record the baseline, don't notify.
        if (Object.keys(chatBaseline.current).length === 0 && Object.keys(fresh).length > 0) {
          chatBaseline.current = fresh;
          return;
        }

        if (newest) {
          chatBaseline.current = fresh;
          setLogs((prev) =>
            [
              ...prev,
              {
                id: generateId(),
                type: "text",
                text: `🔔 New encrypted message from ${newest.slice(0, 6)}…${newest.slice(-4)} — run "inbox" to read it.`
              } as LogEntry
            ].slice(-MAX_LOGS)
          );
        } else {
          chatBaseline.current = fresh;
        }
      } catch {
        // network/contract hiccup — ignore, try again next tick
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [isConnected, address, activeChainId]);

  // COMMAND REGISTRY
  type CommandHandler = (
    args: string[],
    rawInput: string
  ) => Promise<LogEntry | LogEntry[] | null> | LogEntry | LogEntry[] | null;

  const commands: Record<string, CommandHandler> = {
    clear: () => {
      setLogs([]);
      return null;
    },
    deploy: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;

      // NEW SAFETY CHECK: Prevent deployment on Mainnet
      if (!targetChain.testnet) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Deployment is disabled on mainnet (${targetChain.name}). Please switch to a testnet (e.g., Sepolia or Base Sepolia) to deploy tokens.`
        };
      }

      const type = args[1]?.toLowerCase();
      if (type !== "erc20" && type !== "erc721") {
        return {
          id: generateId(),
          type: "text",
          text: "Usage: deploy <erc20|erc721> <name> <symbol> [decimals]"
        };
      }

      const name = args[2];
      const symbol = args[3];
      const decimals =
        type === "erc20" ? (args[4] ? parseInt(args[4]) : 18) : 0;

      if (!name || !symbol) {
        return {
          id: generateId(),
          type: "text",
          text: `Usage: deploy ${type} <name> <symbol>${type === "erc20" ? " [decimals]" : ""}`
        };
      }

      // Prefer a registry-defined implementation; if missing, the widget will
      // auto-deploy one from the bundled creation bytecode and cache it per chain.
      const implementation = IMPLEMENTATION_ADDRESSES[activeChainId]?.[
        type as "erc20" | "erc721"
      ];

      const deployWidget = (
        <DeployWidget
          theme={theme}
          type={type as "erc20" | "erc721"}
          name={name}
          symbol={symbol}
          decimals={decimals}
          implementation={implementation}
          targetChain={targetChain}
          userAddress={address as Address}
        />
      );

      return {
        id: generateId(),
        type: "component",
        component: deployWidget,
        title: `DEPLOY ${name.toUpperCase()}`
      };
    },
    help: () => ({ id: generateId(), type: "help" }),
    "?": () => ({ id: generateId(), type: "help" }),
    networks: () => ({ id: generateId(), type: "networks" }),
    tokens: (args) => {
      if (!activeChainId) {
        return {
          id: generateId(),
          type: "text",
          text: "Select network first."
        };
      }

      const filterType = args[1]?.toLowerCase();
      if (filterType && filterType !== "erc20" && filterType !== "erc721") {
        return {
          id: generateId(),
          type: "text",
          text: "Invalid filter. Use 'tokens', 'tokens erc20', or 'tokens erc721'."
        };
      }

      const common = COMMON_TOKENS[activeChainId] || {};

      const allTokens: Array<{
        symbol: string;
        address: string;
        type: string;
        isCustom: boolean;
      }> = [];

      for (const [symbol, info] of Object.entries(common)) {
        allTokens.push({
          symbol,
          address: info.address,
          type: "erc20",
          isCustom: false
        });
      }

      for (const info of customTokens[activeChainId] || []) {
        allTokens.push({
          symbol: info.symbol,
          address: info.address,
          type: info.tokenType || "erc20",
          isCustom: true
        });
      }

      let filteredTokens = allTokens;
      if (filterType) {
        filteredTokens = allTokens.filter((t) => t.type === filterType);
      }

      if (filteredTokens.length === 0) {
        return {
          id: generateId(),
          type: "text",
          text: `No ${filterType ? filterType.toUpperCase() + " " : ""}tokens found for this network.`
        };
      }

      const lines = [
        `[Available ${filterType ? filterType.toUpperCase() + " " : ""}Tokens]`
      ];
      for (const t of filteredTokens) {
        const typeBadge = t.type === "erc721" ? "[ERC721]" : "[ERC20]";
        const customBadge = t.isCustom ? "(Custom)" : "";
        lines.push(
          `${t.symbol.padEnd(8)} | ${typeBadge} ${t.address} ${customBadge}`
        );
      }

      return {
        id: generateId(),
        type: "text",
        text: lines.join("\n")
      };
    },
    network: async (args) => {
      let netText = "";
      const queryArg = args.slice(1).join(" ");
      if (!queryArg) {
        const currentChainObj = SUPPORTED_CHAINS.find(
          (c) => c.id === activeChainId
        );
        netText = `Active Network: ${currentChainObj?.name || "None"}`;
      } else if (queryArg === "0") {
        setActiveChainId(null);
        setActiveDexId(null);
        savePreference("chainId", null);
        savePreference("dexId", null);
        netText = "Network cleared.";
      } else {
        const targetChain = resolveChain(queryArg);
        if (!targetChain) netText = "Network not recognized.";
        else {
          handleChainSwitch(targetChain.id);
          if (isConnected) {
            try {
              await switchChainAsync({ chainId: targetChain.id });
              netText = `[✓] Network set to ${targetChain.name}`;
            } catch {
              netText = `[!] Wallet rejected the switch to ${targetChain.name}. Terminal selection changed, but connected wallet is still on the old chain — on-chain commands will hit it.`;
            }
          } else {
            netText = `[✓] Network set to ${targetChain.name}`;
          }
        }
      }
      return { id: generateId(), type: "text", text: netText };
    },
    dexes: () => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first."
        };
      return { id: generateId(), type: "dexes" };
    },
    dex: (args) => {
      let dexText = "";
      if (!activeChainId) dexText = "Select network first.";
      else if (!args[1]) {
        const activeDexObj = DEX_REGISTRY[activeChainId]?.find(
          (d) => d.id === activeDexId
        );
        dexText = `Active DEX: ${activeDexObj?.name || "None"}`;
      } else {
        const targetDex = DEX_REGISTRY[activeChainId]?.find(
          (d) => d.id === args[1].toLowerCase()
        );
        if (!targetDex) dexText = "DEX not found.";
        else {
          setActiveDexId(targetDex.id);
          savePreference("dexId", targetDex.id);
          dexText = `[✓] DEX set to ${targetDex.name}`;
        }
      }
      return { id: generateId(), type: "text", text: dexText };
    },
    theme: (args) => {
      const list = THEME_ORDER.map(
        (k) => `${k === currentThemeKey ? "*" : " "} ${k}`
      ).join("\n");
      if (!args[1]) {
        return {
          id: generateId(),
          type: "text",
          text: `Active Theme: ${theme.name}.\n${list}`
        };
      }

      if (!isKnownThemeInput(args[1])) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Error: Theme "${args[1]}" not found.\n${list}`
        };
      }

      const targetThemeKey = resolveThemeKey(args[1]);
      handleThemeSwitch(targetThemeKey);
      return {
        id: generateId(),
        type: "text",
        text: `[✓] Theme switched to ${THEMES[targetThemeKey].name}`
      };
    },
    rpc: (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };
      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const chainProviders = rpcProviders[targetChain.id] || {};
      const activeName = activeRpcProviders[targetChain.id] || "default";

      if (!args[1]) {
        const defaultUrl = targetChain.rpcUrls.default.http[0];
        const allProviders = { default: defaultUrl, ...chainProviders };

        const providerLines = Object.entries(allProviders).map(
          ([name, url]) => {
            const isActive = name === activeName;
            return `${isActive ? "▶ [ACTIVE]" : "         "} ${name.toUpperCase()}:\n           ${url}`;
          }
        );

        const helpText = [
          `RPC Providers for ${targetChain.name}:`,
          ...providerLines,
          ``,
          `Commands:`,
          `• rpc use <name>`,
          `• rpc add <name> <url>`,
          `• rpc remove <name>`,
          `• rpc alchemy <key>`,
          `• rpc infura <key>`,
          `• rpc quicknode <url>`
        ].join("\n");

        return { id: generateId(), type: "text", text: helpText };
      }

      const sub = args[1].toLowerCase();

      if (sub === "use" || sub === "switch") {
        const providerName = args[2]?.toLowerCase();
        if (!providerName)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc use <providerName> (e.g., 'rpc use alchemy', 'rpc use default')"
          };

        if (providerName !== "default" && !chainProviders[providerName]) {
          return {
            id: generateId(),
            type: "text",
            text: `[!] Provider "${providerName}" not found for ${targetChain.name}. Configure it first.`
          };
        }

        const updatedActive = {
          ...activeRpcProviders,
          [targetChain.id]: providerName
        };
        setActiveRpcProviders(updatedActive);
        savePreference("activeRpcProviders", updatedActive);
        return {
          id: generateId(),
          type: "text",
          text: `[✓] Switched active RPC provider to "${providerName}" on ${targetChain.name}.`
        };
      }

      if (sub === "add") {
        const name = args[2]?.toLowerCase();
        const url = args[3];
        if (!name || !url || !url.startsWith("http")) {
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc add <name> <url>"
          };
        }

        const updatedChainProviders = { ...chainProviders, [name]: url };
        const updatedAll = {
          ...rpcProviders,
          [targetChain.id]: updatedChainProviders
        };
        const updatedActive = { ...activeRpcProviders, [targetChain.id]: name };

        setRpcProviders(updatedAll);
        setActiveRpcProviders(updatedActive);
        savePreference("rpcProviders", updatedAll);
        savePreference("activeRpcProviders", updatedActive);

        return {
          id: generateId(),
          type: "text",
          text: `[✓] Added and activated RPC provider "${name}" for ${targetChain.name}.`
        };
      }

      if (sub === "remove" || sub === "rm") {
        const name = args[2]?.toLowerCase();
        if (!name)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc remove <name>"
          };
        if (name === "default")
          return {
            id: generateId(),
            type: "text",
            text: "Cannot remove default provider."
          };

        if (!chainProviders[name]) {
          return {
            id: generateId(),
            type: "text",
            text: `[!] Provider "${name}" not found.`
          };
        }

        const updatedChainProviders = { ...chainProviders };
        delete updatedChainProviders[name];
        const updatedAll = {
          ...rpcProviders,
          [targetChain.id]: updatedChainProviders
        };

        const updatedActive = { ...activeRpcProviders };
        if (activeName === name) {
          updatedActive[targetChain.id] = "default";
        }

        setRpcProviders(updatedAll);
        setActiveRpcProviders(updatedActive);
        savePreference("rpcProviders", updatedAll);
        savePreference("activeRpcProviders", updatedActive);

        return {
          id: generateId(),
          type: "text",
          text: `[✓] Removed RPC provider "${name}". Active provider reverted to default if needed.`
        };
      }

      let newUrl = "";
      let providerKey = sub;

      if (sub === "alchemy") {
        const key = args[2];
        if (!key)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc alchemy <apiKey>"
          };
        const subDomain = getAlchemySubdomain(targetChain.id);
        if (!subDomain)
          return {
            id: generateId(),
            type: "text",
            text: `[!] Alchemy preset not available for ${targetChain.name}. Use 'rpc add custom <url>'.`
          };
        newUrl = `https://${subDomain}.g.alchemy.com/v2/${key}`;
      } else if (sub === "infura") {
        const key = args[2];
        if (!key)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc infura <apiKey>"
          };
        const subDomain = getInfuraSubdomain(targetChain.id);
        if (!subDomain)
          return {
            id: generateId(),
            type: "text",
            text: `[!] Infura preset not available for ${targetChain.name}. Use 'rpc add custom <url>'.`
          };
        newUrl = `https://${subDomain}.infura.io/v3/${key}`;
      } else if (sub === "quicknode") {
        const endpoint = args[2];
        if (!endpoint)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: rpc quicknode <endpointUrlOrKey>"
          };
        newUrl = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;
      } else if (args[1].startsWith("http")) {
        newUrl = args[1];
        providerKey = "custom";
      } else {
        return {
          id: generateId(),
          type: "text",
          text: "Usage:\n• rpc\n• rpc use <name>\n• rpc add <name> <url>\n• rpc remove <name>\n• rpc alchemy <key>\n• rpc infura <key>\n• rpc quicknode <url>"
        };
      }

      const updatedChainProviders = {
        ...chainProviders,
        [providerKey]: newUrl
      };
      const updatedAll = {
        ...rpcProviders,
        [targetChain.id]: updatedChainProviders
      };
      const updatedActive = {
        ...activeRpcProviders,
        [targetChain.id]: providerKey
      };

      setRpcProviders(updatedAll);
      setActiveRpcProviders(updatedActive);
      savePreference("rpcProviders", updatedAll);
      savePreference("activeRpcProviders", updatedActive);

      return {
        id: generateId(),
        type: "text",
        text: `[✓] Configured and activated RPC provider "${providerKey}" for ${targetChain.name}:\n${newUrl}`
      };
    },
    register: async (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };
      if (!args[1])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: register <tokenAddress> [customSymbol] [erc20|erc721]"
        };

      // Accept addresses with an invalid EIP-55 checksum by normalizing them.
      let rawAddress = args[1];
      if (!isAddress(rawAddress)) {
        try {
          rawAddress = getAddress(rawAddress);
        } catch {
          return {
            id: generateId(),
            type: "text",
            text: `[!] Error: "${rawAddress}" is not a valid address.`
          };
        }
      }
      const tokenAddress = rawAddress as Address;
      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;

      // Type hint may appear as the 2nd or 3rd argument.
      const lowerArgs = args.slice(2).map((a) => a.toLowerCase());
      const hint =
        lowerArgs.includes("erc721") || lowerArgs.includes("nft")
          ? "erc721"
          : lowerArgs.includes("erc20")
            ? "erc20"
            : undefined;
      const symbolArg =
        args[2] && !lowerArgs[0].match(/^(erc20|erc721|nft)$/)
          ? args[2]
          : undefined;

      const detected = await detectTokenType(tokenAddress, targetChain, hint);

      // Confirmation resolver: register anyway or cancel
      const doRegister = (info: {
        name: string;
        symbol: string;
        decimals?: number;
        tokenType: "erc20" | "erc721";
      }) => {
        const symbolToUse = (symbolArg ? symbolArg : info.symbol).toUpperCase();

        const isNative =
          symbolToUse === targetChain.nativeCurrency.symbol.toUpperCase();

        // Native symbol is reserved; an exact address can only be registered
        // once per chain. Same SYMBOL on different addresses is allowed.
        const addrDup = (customTokens[targetChain.id] || []).some(
          (t) =>
            t.address.toLowerCase() === tokenAddress.toLowerCase()
        );

        if (isNative) {
          setLogs((prev) =>
            [
              ...prev,
              {
                id: generateId(),
                type: "text",
                text: `[!] Error: Symbol "${symbolToUse}" is reserved for the native token on ${targetChain.name}. Choose another symbol.`
              } as LogEntry
            ].slice(-MAX_LOGS)
          );
          return;
        }

        if (addrDup) {
          setLogs((prev) =>
            [
              ...prev,
              {
                id: generateId(),
                type: "text",
                text: `[!] Error: ${tokenAddress} is already registered on ${targetChain.name}.`
              } as LogEntry
            ].slice(-MAX_LOGS)
          );
          return;
        }

        const newToken: CustomTokenEntry = {
          id: `c_${tokenAddress.toLowerCase()}`,
          address: tokenAddress,
          symbol: symbolToUse,
          name: info.name,
          decimals: info.decimals,
          tokenType: info.tokenType,
          isNative: false
        };

        const updatedAllTokens: CustomTokensMap = {
          ...customTokens,
          [targetChain.id]: [
            ...(customTokens[targetChain.id] || []),
            newToken
          ]
        };

        setCustomTokens(updatedAllTokens);
        saveCustomTokenToStorage(updatedAllTokens);

        const sameSymbolCount =
          (updatedAllTokens[targetChain.id] || []).filter(
            (t) => t.symbol.toUpperCase() === symbolToUse
          ).length;

        setLogs((prev) =>
          [
            ...prev,
            {
              id: generateId(),
              type: "text",
              text: `[✓] Successfully registered ${info.tokenType === "erc721" ? "NFT" : "token"} "${symbolToUse}" (${info.name}${info.decimals !== undefined ? `, ${info.decimals} decimals` : ""}) at ${tokenAddress} on ${targetChain.name}. ${sameSymbolCount} token(s) now use symbol "${symbolToUse}".`
            } as LogEntry
          ].slice(-MAX_LOGS)
        );
      };

      if (detected) {
        doRegister({
          name: detected.name,
          symbol: detected.symbol,
          decimals: detected.type === "erc20" ? detected.decimals : undefined,
          tokenType: detected.type
        });
        return null;
      }

      // Invalid contract: ask for confirmation before registering anyway
      setPendingConfirm({
        onYes: () =>
          doRegister({
            name: "",
            symbol: symbolArg ? symbolArg : "UNKNOWN",
            decimals: undefined,
            tokenType: hint === "erc721" ? "erc721" : "erc20"
          }),
        onNo: () =>
          setLogs((prev) =>
            [
              ...prev,
              {
                id: generateId(),
                type: "text",
                text: `[✓] Cancelled. ${tokenAddress} was not registered.`
              } as LogEntry
            ].slice(-MAX_LOGS)
          )
      });

      return {
        id: generateId(),
        type: "text",
        text: `[!] Address ${tokenAddress} does not look like a valid ERC20/ERC721 contract on ${targetChain.name}. Register it anyway? (y/n)`
      };
    },
    is: async (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;

      let kind = "erc20"; // Default assumption
      let addrArg = "";

      // Parse arguments: handle both "is erc20 0x..." and "is 0x..."
      if (args[1]) {
        const typeArg = args[1].toLowerCase();
        if (typeArg === "erc721" || typeArg === "nft") {
          kind = "erc721";
          addrArg = args[2];
        } else if (typeArg === "erc20") {
          kind = "erc20";
          addrArg = args[2];
        } else {
          // User likely omitted the type and went straight to the address
          addrArg = args[1];
        }
      }

      // Normalize addresses with an invalid EIP-55 checksum.
      if (addrArg && !isAddress(addrArg)) {
        try {
          addrArg = getAddress(addrArg);
        } catch {
          addrArg = "";
        }
      }

      if (!addrArg)
        return {
          id: generateId(),
          type: "text",
          text: "Usage: is <erc20|erc721> <contractAddress>"
        };

      const client = getClient(targetChain);
      const address = addrArg as Address;
      const isErc721 = kind === "erc721";

      // 1) ERC-165 supportsInterface — the canonical signal
      let erc165 = false;
      try {
        erc165 = Boolean(
          await client.readContract({
            address,
            abi: erc165Abi,
            functionName: "supportsInterface",
            args: [INTERFACE_ID_ERC165]
          })
        );
      } catch {
        erc165 = false;
      }

      const wantsId = isErc721 ? INTERFACE_ID_ERC721 : INTERFACE_ID_ERC20;
      let interfaceSupported = false;
      if (erc165) {
        try {
          interfaceSupported = Boolean(
            await client.readContract({
              address,
              abi: erc165Abi,
              functionName: "supportsInterface",
              args: [wantsId]
            })
          );
        } catch {
          interfaceSupported = false;
        }
      }

      if (interfaceSupported) {
        return {
          id: generateId(),
          type: "text",
          text: `[✓] ${address} is ${isErc721 ? "an ERC-721 (NFT)" : "an ERC-20"} contract on ${targetChain.name} (via ERC-165 interface ${wantsId}).`
        };
      }

      // 2) Fallback: verify all core standard functions are callable
      const checks: string[] = [];
      const verified: string[] = [];

      if (isErc721) {
        // Only view functions can be probed read-only. safeTransferFrom /
        // transferFrom are writes: they revert on eth_call against a real NFT
        // (no approval), so they always false-negative — skip them. ownerOf is
        // the strongest signal; try tokenId 0 then 1 so an unminted first token
        // doesn't false-negative.
        const fnChecks: [string, readonly unknown[], string][] = [
          ["ownerOf", [0n], "ownerOf(0) → address"],
          ["ownerOf", [1n], "ownerOf(1) → address"],
          ["balanceOf", [address], "balanceOf(address) → uint256"]
        ];
        for (const [fn, fnArgs, label] of fnChecks) {
          try {
            await client.readContract({
              address,
              abi: erc721Abi,
              functionName: fn as any,
              args: fnArgs as [bigint] | [bigint] | [Address]
            });
            verified.push(label);
          } catch {
            checks.push(label);
          }
        }
      } else {
        // Only view functions can be probed read-only. transfer / transferFrom
        // / approve are writes: they revert on eth_call against a real ERC-20,
        // so they always false-negative — skip them.
        const fnChecks: [string, readonly unknown[], string][] = [
          ["totalSupply", [], "totalSupply() → uint256"],
          ["balanceOf", [address], "balanceOf(address) → uint256"],
          ["allowance", [address, address], "allowance(address,address) → uint256"]
        ];
        for (const [fn, fnArgs, label] of fnChecks) {
          try {
            await client.readContract({
              address,
              abi: erc20FullAbi,
              functionName: fn as any,
              args: fnArgs as readonly [Address] | readonly [Address, Address]
            });
            verified.push(label);
          } catch {
            checks.push(label);
          }
        }
      }

      const okCount = verified.length;
      const missingCount = checks.length;
      const allCore = okCount === 3;

      // Report optional metadata too
      let meta = "";
      try {
        const [sym, name] = await Promise.all([
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "symbol"
          }),
          client.readContract({
            address,
            abi: erc20FullAbi,
            functionName: "name"
          })
        ]);
        meta = ` (${String(name)} / ${String(sym)})`;
      } catch {
        meta = "";
      }

      const resultLines = [
        `Interface check for ${address} on ${targetChain.name}:`,
        `ERC-165: ${erc165 ? "supported" : "not supported"}`,
        `${
          isErc721 ? "ERC-721" : "ERC-20"
        } interface (${wantsId}): ${interfaceSupported ? "yes" : "no"}`,
        `Core functions callable: ${okCount}/3`,
        ...verified.map((v) => `  ✓ ${v}`),
        ...checks.map((c) => `  ✗ ${c}`),
        ``
      ];

      if (allCore) {
        resultLines.push(
          `[✓] ${address} appears to be a valid ${isErc721 ? "ERC-721 (NFT)" : "ERC-20"} contract${meta}.`
        );
      } else if (okCount > 0) {
        resultLines.push(
          `[?] ${address} has some ${isErc721 ? "ERC-721" : "ERC-20"} characteristics but is missing: ${checks.join(", ")}.`
        );
      } else {
        resultLines.push(
          `[✗] ${address} does not look like a ${isErc721 ? "ERC-721" : "ERC-20"} contract.`
        );
      }

      return { id: generateId(), type: "text", text: resultLines.join("\n") };
    },
    info: async (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };
      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      let addrArg = args[1];
      if (addrArg && !isAddress(addrArg)) {
        try {
          addrArg = getAddress(addrArg);
        } catch {
          addrArg = "";
        }
      }
      if (!addrArg)
        return {
          id: generateId(),
          type: "text",
          text: "Usage: info <contractAddress>"
        };

      const tokenAddress = addrArg as Address;
      const detected = await detectTokenType(tokenAddress, targetChain);
      if (!detected)
        return {
          id: generateId(),
          type: "text",
          text: `[✗] ${tokenAddress} does not look like a valid ERC20 or ERC721 contract on ${targetChain.name}.`
        };

      const client = getClient(targetChain);
      const lines = [
        `Token info for ${tokenAddress} on ${targetChain.name}:`,
        `Type:      ${detected.type === "erc20" ? "ERC-20 (fungible token)" : "ERC-721 (non-fungible token / NFT)"}`,
        `Name:      ${detected.name || "—"}`,
        `Symbol:    ${detected.symbol || "—"}`
      ];

      if (detected.type === "erc20") {
        lines.push(`Decimals:  ${detected.decimals}`);
        try {
          const total = (await client.readContract({
            address: tokenAddress,
            abi: erc20FullAbi,
            functionName: "totalSupply"
          })) as bigint;
          lines.push(
            `Total:     ${formatUnits(total, detected.decimals)} ${detected.symbol}`
          );
        } catch {
          lines.push(`Total:     n/a`);
        }
        if (isConnected && address) {
          try {
            const bal = (await client.readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address]
            })) as bigint;
            lines.push(
              `Balance:   ${formatUnits(bal, detected.decimals)} ${detected.symbol} (connected wallet)`
            );
          } catch {}
        }
      } else {
        try {
          const total = (await client.readContract({
            address: tokenAddress,
            abi: erc20FullAbi,
            functionName: "totalSupply"
          })) as bigint;
          lines.push(`Total:     ${String(total)} items`);
        } catch {
          lines.push(`Total:     n/a`);
        }
      }

      return { id: generateId(), type: "text", text: lines.join("\n") };
    },
    export: () => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected. Connect a wallet to export its profile and custom tokens."
        };
      const userKey = `0xterm_user_${address.toLowerCase()}`;
      const tokensKey = `0xterm_custom_tokens_${address.toLowerCase()}`;
      const prefs = localStorage.getItem(userKey)
        ? JSON.parse(localStorage.getItem(userKey)!)
        : {};
      const tokens = localStorage.getItem(tokensKey)
        ? JSON.parse(localStorage.getItem(tokensKey)!)
        : {};

      const exportData = {
        version: "1.0",
        wallet: address,
        preferences: prefs,
        customTokens: tokens,
        pinned: pinned.map(({ payload, component, ...rest }) => rest)
      };

      const exportWidget = (
        <ExportWidget exportData={exportData} theme={theme} address={address} />
      );
      return { id: generateId(), type: "component", component: exportWidget, title: "EXPORT" };
    },
    import: (args, rawInput) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected. Connect your target wallet first before importing."
        };

      const match = rawInput.trim().match(/^(import|imp)\s+([\s\S]+)$/i);
      if (!match || !match[2]) {
        return {
          id: generateId(),
          type: "text",
          text: "Usage: import <json_payload>"
        };
      }

      const jsonStr = match[2].trim();

      try {
        const data = JSON.parse(jsonStr);
        if (!data.preferences && !data.customTokens) {
          return {
            id: generateId(),
            type: "text",
            text: "[!] Error: Invalid configuration JSON format."
          };
        }

        const userKey = `0xterm_user_${address.toLowerCase()}`;
        const tokensKey = `0xterm_custom_tokens_${address.toLowerCase()}`;

        if (data.preferences) {
          localStorage.setItem(userKey, JSON.stringify(data.preferences));
          if (data.preferences.theme) {
            onThemeChange(resolveThemeKey(data.preferences.theme));
          }
          if (data.preferences.rpcProviders)
            setRpcProviders(data.preferences.rpcProviders);
          if (data.preferences.activeRpcProviders)
            setActiveRpcProviders(data.preferences.activeRpcProviders);
          if (data.preferences.chainId) {
            setActiveChainId(data.preferences.chainId);
            if (data.preferences.dexId) {
              setActiveDexId(data.preferences.dexId);
            }
          }
        }

        if (data.customTokens) {
          const migrated = migrateCustomTokens(data.customTokens);
          localStorage.setItem(tokensKey, JSON.stringify(migrated));
          setCustomTokens(migrated);
        }

        if (Array.isArray(data.pinned)) {
          const cleaned = data.pinned.filter((p: any) => p && p.id && p.kind);
          setPinned(cleaned);
          rehydratePinRefresh(cleaned);
          savePreference("pinned", cleaned);
        }

        if (Array.isArray(data.preferences?.logs)) {
          setLogs((prev) => [...data.preferences.logs].slice(-MAX_LOGS));
        }
        if (Array.isArray(data.preferences?.history)) {
          setHistory((prev) => [
            ...prev,
            ...data.preferences.history
          ].slice(-100));
        }

        return {
          id: generateId(),
          type: "text",
          text: `[✓] Successfully imported settings and custom tokens to wallet ${address.slice(0, 6)}...${address.slice(-4)}!`
        };
      } catch (e: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Error parsing JSON: ${e.message}`
        };
      }
    },
    price: async (args) => {
      if (!args[1])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: price <tokenA> [tokenB] [feeTier] [pool|api]"
        };

      let source = "pool";
      const filteredArgs = [...args.slice(1)];
      const lastArg = filteredArgs[filteredArgs.length - 1].toLowerCase();

      if (["api", "pool", "dexscreener", "onchain"].includes(lastArg)) {
        source =
          lastArg === "api" || lastArg === "dexscreener" ? "api" : "pool";
        filteredArgs.pop();
      }

      const queryA = filteredArgs[0];
      let queryB = filteredArgs[1];
      // Optional fee tier for V3 pool lookups (e.g. 'price ETH USDC 3000').
      // Only valid for the on-chain pool source.
      let feeTier = 3000;
      const feeArg = filteredArgs[2];
      if (feeArg !== undefined) {
        const parsed = Number(feeArg);
        if (Number.isFinite(parsed) && [100, 500, 3000, 10000].includes(parsed)) {
          feeTier = parsed;
        }
      }
      const targetChain = activeChainId
        ? SUPPORTED_CHAINS.find((c) => c.id === activeChainId)
        : null;

      if (
        source === "api" &&
        targetChain &&
        (targetChain.testnet ||
          targetChain.id === 11155111 ||
          targetChain.name.toLowerCase().includes("sepolia"))
      ) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] API Blocked: DexScreener does not track testnets like ${targetChain.name}. Omit 'api' to fetch the price directly from the on-chain pool contract.`
        };
      }

      if (source === "pool") {
        if (!activeChainId || !activeDexId) {
          return {
            id: generateId(),
            type: "text",
            text: "Select network and DEX first to query on-chain pool price, or pass 'api' (e.g. 'price ETH USDC api')."
          };
        }

        const activeDex = DEX_REGISTRY[activeChainId]?.find(
          (d) => d.id === activeDexId
        );
        if (!activeDex)
          return {
            id: generateId(),
            type: "text",
            text: "Invalid active DEX."
          };

        if (!queryB) {
          const common = COMMON_TOKENS[targetChain!.id];
          if (common?.USDC) queryB = "USDC";
          else if (common?.USDT) queryB = "USDT";
          else queryB = targetChain!.nativeCurrency.symbol;
        }

        try {
          const [tokenA, tokenB] = await Promise.all([
            resolveTokenDetails(queryA, targetChain!),
            resolveTokenDetails(queryB, targetChain!)
          ]);

          const addrA = tokenA.isNative
            ? WRAPPED_NATIVE[targetChain!.id] || tokenA.address
            : tokenA.address;
          const addrB = tokenB.isNative
            ? WRAPPED_NATIVE[targetChain!.id] || tokenB.address
            : tokenB.address;

          if (addrA.toLowerCase() === addrB.toLowerCase()) {
            throw new Error("Tokens must be different.");
          }

          const client = getClient(targetChain!);
          let pairAddress: Address | undefined;

          if (activeDex.type === "V2") {
            pairAddress = await client.readContract({
              address: activeDex.factory,
              abi: uniV2FactoryAbi,
              functionName: "getPair",
              args: [addrA, addrB]
            });
          } else if (activeDex.type === "V3") {
            pairAddress = await client.readContract({
              address: activeDex.factory,
              abi: uniV3FactoryAbi,
              functionName: "getPool",
              args: [addrA, addrB, feeTier]
            });
          }

          if (!pairAddress || pairAddress === NATIVE_TOKEN_ADDRESS) {
            return {
              id: generateId(),
              type: "text",
              text: `No ${activeDex.type} pool found for ${tokenA.symbol}/${tokenB.symbol} on ${activeDex.name}.`
            };
          }

          let priceRatio = 0;

          if (activeDex.type === "V2") {
            const [token0, reserves] = await Promise.all([
              client.readContract({
                address: pairAddress,
                abi: uniV2PairAbi,
                functionName: "token0"
              }),
              client.readContract({
                address: pairAddress,
                abi: uniV2PairAbi,
                functionName: "getReserves"
              })
            ]);

            const reserveA =
              (token0 as string).toLowerCase() === addrA.toLowerCase()
                ? reserves[0]
                : reserves[1];
            const reserveB =
              (token0 as string).toLowerCase() === addrA.toLowerCase()
                ? reserves[1]
                : reserves[0];

            const formattedA = parseFloat(
              formatUnits(reserveA, tokenA.decimals)
            );
            const formattedB = parseFloat(
              formatUnits(reserveB, tokenB.decimals)
            );

            if (formattedA === 0)
              throw new Error("Pool reserve for token A is zero.");
            priceRatio = formattedB / formattedA;
          } else {
            const [token0, slot0] = await Promise.all([
              client.readContract({
                address: pairAddress,
                abi: parseAbi(["function token0() view returns (address)"]),
                functionName: "token0"
              }),
              client.readContract({
                address: pairAddress,
                abi: uniV3PoolAbi,
                functionName: "slot0"
              })
            ]);

            const sqrtPriceX96 = slot0[0];
            const isTokenA0 =
              (token0 as string).toLowerCase() === addrA.toLowerCase();

            const sqrtPriceFloat = Number(sqrtPriceX96) / 2 ** 96;
            const pRaw = Math.pow(sqrtPriceFloat, 2);

            const dec0 = isTokenA0 ? tokenA.decimals : tokenB.decimals;
            const dec1 = isTokenA0 ? tokenB.decimals : tokenA.decimals;

            const pToken0InToken1 = pRaw * Math.pow(10, dec0 - dec1);

            if (isTokenA0) {
              priceRatio = pToken0InToken1;
            } else {
              priceRatio = 1 / pToken0InToken1;
            }
          }

          const priceWidget = (
            <div
              className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
            >
              <div
                className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
              >
                <span className="font-bold">
                  ON-CHAIN POOL PRICE ({activeDex.name})
                </span>
                <span className="uppercase">{targetChain!.name}</span>
              </div>
              <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
                <div>
                  <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
                  <div className={`text-base font-bold ${theme.primary}`}>
                    {tokenA.symbol} / {tokenB.symbol}
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] ${theme.text}/50`}>
                    RATE (ON-CHAIN)
                  </div>
                  <div className={`text-base font-bold ${theme.primary}`}>
                    1 {tokenA.symbol} ={" "}
                    {priceRatio.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8
                    })}{" "}
                    {tokenB.symbol}
                  </div>
                </div>
              </div>
              <div
                className={`text-[9px] ${theme.text}/40 truncate pt-1 border-t ${theme.border} flex items-center gap-1`}
              >
                <span>POOL ADDRESS:</span>{" "}
                <CopyableAddress address={pairAddress} theme={theme} />
              </div>
            </div>
          );

          return {
            id: generateId(),
            type: "component",
            component: priceWidget,
            title: `PRICE ${tokenA.symbol}/${tokenB.symbol}`,
            componentData: {
              kind: "price",
              mode: "onchain",
              pairAddress,
              symbolA: tokenA.symbol,
              symbolB: tokenB.symbol,
              symbolAAddress: tokenA.address,
              symbolBAddress: tokenB.address,
              rate: priceRatio,
              dexName: activeDex.name,
              chainName: targetChain!.name
            }
          };
        } catch (err: any) {
          return {
            id: generateId(),
            type: "text",
            text: `On-chain pool error: ${err.message || err}`
          };
        }
      } else {
        const encodedQuery = encodeURIComponent(queryA);
        let res;

        try {
          res = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodedQuery}`
          );
        } catch (e) {
          return {
            id: generateId(),
            type: "text",
            text: "[!] API Fetch Failed: Request timed out or was blocked. Ensure your ad-blocker isn't blocking 'api.dexscreener.com'."
          };
        }

        if (!res.ok) {
          return {
            id: generateId(),
            type: "text",
            text: `DexScreener API returned status error: ${res.status}`
          };
        }

        const data = await res.json();

        if (!data.pairs || data.pairs.length === 0) {
          return {
            id: generateId(),
            type: "text",
            text: `No API price data found for "${queryA}".`
          };
        }

        const chainSlug = targetChain
          ? DEXSCREENER_CHAIN[targetChain.id]
          : undefined;

        let pair = data.pairs.find((p: any) => {
          const matchesChain = chainSlug
            ? p.chainId.toLowerCase() === chainSlug
            : true;
          const matchesQuote = queryB
            ? p.quoteToken.symbol.toLowerCase() === queryB.toLowerCase()
            : true;
          return matchesChain && matchesQuote;
        });

        if (!pair && chainSlug)
          pair = data.pairs.find(
            (p: any) => p.chainId.toLowerCase() === chainSlug
          );

        if (!pair) {
          return {
            id: generateId(),
            type: "text",
            text: `No ${targetChain ? targetChain.name : ""} price data found for "${queryA}"${
              queryB ? ` against ${queryB}` : ""
            }. Try 'price <tokenA> <tokenB>' or omit 'api' to read the pool on-chain.`
          };
        }

        const priceUsd = pair.priceUsd;
        const priceNative = pair.priceNative;
        const tokenSymbol = pair.baseToken.symbol;
        const quoteSymbol = pair.quoteToken.symbol;
        const dex = pair.dexId;
        const chain = pair.chainId;
        const h24 = pair.priceChange?.h24;

        const priceWidget = (
          <div
            className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
          >
            <div
              className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
            >
              <span className="font-bold">
                DEXSCREENER API PRICE ({dex.toUpperCase()})
              </span>
              <span className="uppercase">{chain}</span>
            </div>
            <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {tokenSymbol} / {quoteSymbol}
                </div>
              </div>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  PRICE (USD)
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  $
                  {priceUsd
                    ? parseFloat(priceUsd).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      })
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  PRICE ({quoteSymbol})
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {priceNative
                    ? parseFloat(priceNative).toLocaleString(undefined, {
                        maximumFractionDigits: 6
                      })
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>24H CHANGE</div>
                <div
                  className={`text-base font-bold ${h24 >= 0 ? theme.primary : "text-red-400"}`}
                >
                  {h24 !== undefined ? `${h24 > 0 ? "+" : ""}${h24}%` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        );

        return {
          id: generateId(),
          type: "component",
          component: priceWidget,
          title: `PRICE ${queryA.toUpperCase()}${queryB ? `/${queryB.toUpperCase()}` : ""}`,
          componentData: {
            kind: "price",
            mode: "api",
            priceUsd,
            priceNative,
            tokenSymbol,
            quoteSymbol,
            dex,
            chain,
            h24
          }
        };
      }
    },
    createpool: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      if (!activeChainId || !activeDexId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network and DEX first."
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId]?.find(
        (d) => d.id === activeDexId
      );
      if (!activeDex)
        return {
          id: generateId(),
          type: "text",
          text: 'Invalid active DEX for this network. Type "dexes" to see available DEXes.'
        };
      if (!args[1] || !args[2])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: createpool <tokenA> <tokenB> [fee]"
        };

      const [tokenA, tokenB] = await Promise.all([
        resolveTokenDetails(args[1], targetChain),
        resolveTokenDetails(args[2], targetChain)
      ]);
      const addrA = tokenA.isNative
        ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
        : tokenA.address;
      const addrB = tokenB.isNative
        ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
        : tokenB.address;
      const fee = args[3] ? parseInt(args[3]) : 3000;

      return {
        id: generateId(),
        type: "createpool",
        payload: { targetChain, activeDex, tokenA, tokenB, addrA, addrB, fee }
      };
    },
    initialize: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      if (!activeChainId || !activeDexId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network and DEX first."
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId]?.find(
        (d) => d.id === activeDexId
      );
      if (!activeDex)
        return {
          id: generateId(),
          type: "text",
          text: 'Invalid active DEX for this network. Type "dexes" to choose a valid DEX.'
        };
      if (activeDex.type !== "V3")
        return {
          id: generateId(),
          type: "text",
          text: "Initialization is only applicable to Uniswap V3 pools."
        };
      if (!args[1] || !args[2])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: initialize <tokenA> <tokenB> [fee]"
        };

      const [tokenA, tokenB] = await Promise.all([
        resolveTokenDetails(args[1], targetChain),
        resolveTokenDetails(args[2], targetChain)
      ]);
      const addrA = tokenA.isNative
        ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
        : tokenA.address;
      const addrB = tokenB.isNative
        ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
        : tokenB.address;
      const fee = args[3] ? parseInt(args[3]) : 3000;
      const [token0, token1] =
        addrA.toLowerCase() < addrB.toLowerCase()
          ? [addrA, addrB]
          : [addrB, addrA];

      const client = getClient(targetChain);
      const poolAddress = (await client.readContract({
        address: activeDex.factory,
        abi: uniV3FactoryAbi,
        functionName: "getPool",
        args: [token0, token1, fee]
      })) as Address;

      if (!poolAddress || poolAddress === NATIVE_TOKEN_ADDRESS) {
        throw new Error(
          `Pool does not exist. Run 'createpool ${tokenA.symbol} ${tokenB.symbol} ${fee}' first.`
        );
      }

      return {
        id: generateId(),
        type: "initialize",
        payload: { targetChain, poolAddress, tokenA, tokenB }
      };
    },
    getpool: async (args) => {
      if (!activeChainId || !activeDexId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network and DEX first."
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId]?.find(
        (d) => d.id === activeDexId
      );

      if (!activeDex)
        return {
          id: generateId(),
          type: "text",
          text: 'Invalid active DEX for this network. Type "dexes" to check available DEXes.'
        };
      if (!args[1] || !args[2])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: getpool <tokenA> <tokenB> [fee]"
        };

      const poolWidget = await fetchPoolAddress(
        args[1],
        args[2],
        targetChain,
        activeDex,
        args[3]
      );
      return {
        id: generateId(),
        type: "component",
        component: poolWidget,
        title: `POOL ${args[1].toUpperCase()}/${args[2].toUpperCase()}`
      };
    },
    addliq: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      if (!activeChainId || !activeDexId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network and DEX first."
        };
      if (!args[1] || !args[2] || !args[3] || !args[4])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: addliq <tokenA> <tokenB> <amtA> <amtB> [fee]"
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId]?.find(
        (d) => d.id === activeDexId
      );
      if (!activeDex)
        return {
          id: generateId(),
          type: "text",
          text: `No DEX available on ${targetChain.name}. Type "dexes" to check available DEXes.`
        };

      const [tokenA, tokenB] = await Promise.all([
        resolveTokenDetails(args[1], targetChain),
        resolveTokenDetails(args[2], targetChain)
      ]);
      const amountAWei = parseUnits(args[3], tokenA.decimals);
      const amountBWei = parseUnits(args[4], tokenB.decimals);
      const fee = args[5] ? parseInt(args[5]) : 3000;

      return {
        id: generateId(),
        type: "addliq",
        payload: {
          userAddress: address,
          targetChain,
          activeDex,
          tokenA,
          tokenB,
          amountAWei,
          amountBWei,
          fee
        }
      };
    },
    swap: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      if (!activeChainId || !activeDexId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network and DEX first."
        };
      if (!args[1] || !args[2] || !args[3])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: swap <amount> <fromToken> <toToken> [slippage%] [feeTier]"
        };

      // Optional 4th argument: slippage tolerance as a percentage (e.g. "1" = 1%).
      // Defaults to 0.5% when omitted.
      let slippagePct = 0.5;
      const slippageArg = args[4];
      if (slippageArg !== undefined) {
        const parsed = Number(slippageArg);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
          return {
            id: generateId(),
            type: "text",
            text: `[!] Invalid slippage "${slippageArg}". Use a percentage between 0 and 100 (e.g. 'swap 100 USDC DAI 1').`
          };
        }
        slippagePct = parsed;
      }

      // Optional 5th argument: Uniswap V3 fee tier in basis points (e.g. "3000"
      // = 0.3%). Defaults to 3000 (0.3%). Only used for V3 pools.
      let feeTier = 3000;
      const feeArg = args[5];
      if (feeArg !== undefined) {
        const parsed = Number(feeArg);
        if (!Number.isFinite(parsed) || ![100, 500, 3000, 10000].includes(parsed)) {
          return {
            id: generateId(),
            type: "text",
            text: `[!] Invalid fee tier "${feeArg}". Use one of 100, 500, 3000, 10000 (e.g. 'swap 100 USDC DAI 1 3000').`
          };
        }
        feeTier = parsed;
      }

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId]?.find(
        (d) => d.id === activeDexId
      );
      if (!activeDex)
        return {
          id: generateId(),
          type: "text",
          text: `No DEX available on ${targetChain.name}. Type "dexes" to check available DEXes.`
        };

      const [fromToken, toToken] = await Promise.all([
        resolveTokenDetails(args[2], targetChain),
        resolveTokenDetails(args[3], targetChain)
      ]);
      const amountInWei = parseUnits(args[1], fromToken.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const addrIn = fromToken.isNative
        ? WRAPPED_NATIVE[targetChain.id] || fromToken.address
        : fromToken.address;
      const addrOut = toToken.isNative
        ? WRAPPED_NATIVE[targetChain.id] || toToken.address
        : toToken.address;

      if (addrIn.toLowerCase() === addrOut.toLowerCase()) {
        return {
          id: generateId(),
          type: "text",
          text: "Tokens must be different."
        };
      }

      // Compute a real minimum-output from an on-chain quote, then apply the
      // user's slippage tolerance. Falls back to 0 when the pool can't be
      // quoted (e.g. no liquidity yet), so the swap is not blocked.
      const client = getClient(targetChain);
      let expectedOutWei = 0n;
      try {
        if (activeDex.type === "V2") {
          const pair = (await client.readContract({
            address: activeDex.factory,
            abi: uniV2FactoryAbi,
            functionName: "getPair",
            args: [addrIn, addrOut]
          })) as Address;
          if (pair && pair !== NATIVE_TOKEN_ADDRESS) {
            const [token0, reserves] = await Promise.all([
              client.readContract({
                address: pair,
                abi: uniV2PairAbi,
                functionName: "token0"
              }),
              client.readContract({
                address: pair,
                abi: uniV2PairAbi,
                functionName: "getReserves"
              })
            ]);
            const inIsToken0 =
              (token0 as string).toLowerCase() === addrIn.toLowerCase();
            const reserveIn = inIsToken0 ? reserves[0] : reserves[1];
            const reserveOut = inIsToken0 ? reserves[1] : reserves[0];
            if (reserveIn > 0n && reserveOut > 0n) {
              expectedOutWei = (await client.readContract({
                address: pair,
                abi: uniV2PairAbi,
                functionName: "getAmountOut",
                args: [amountInWei, reserveIn, reserveOut]
              })) as bigint;
            }
          }
        } else {
          const pool = (await client.readContract({
            address: activeDex.factory,
            abi: uniV3FactoryAbi,
            functionName: "getPool",
            args: [addrIn, addrOut, feeTier]
          })) as Address;
          if (pool && pool !== NATIVE_TOKEN_ADDRESS) {
            const [token0, slot0] = await Promise.all([
              client.readContract({
                address: pool,
                abi: parseAbi(["function token0() view returns (address)"]),
                functionName: "token0"
              }),
              client.readContract({
                address: pool,
                abi: uniV3PoolAbi,
                functionName: "slot0"
              })
            ]);
            const inIsToken0 =
              (token0 as string).toLowerCase() === addrIn.toLowerCase();
            // V3 exact-input quote: sqrtPrice -> price -> expected output, with
            // a 0.1% pool fee and 0.5% user slippage applied for safety.
            const sqrtPrice = Number(slot0[0]) / 2 ** 96;
            const price = Math.pow(sqrtPrice, 2);
            const fromDec = fromToken.decimals ?? 18;
            const toDec = toToken.decimals ?? 18;
            const outInDecimals = inIsToken0
              ? (Number(amountInWei) * price) / 10 ** fromDec
              : (Number(amountInWei) / price) / 10 ** fromDec;
            const outFloat = outInDecimals * 10 ** toDec;
            expectedOutWei = BigInt(Math.floor(outFloat * 0.995));
          }
        }
      } catch {
        // Quote failed — leave expectedOutWei as 0.
      }

      // Slippage-tolerance check: only accept a valid slippage when we have a
      // real on-chain quote; otherwise fall back to a 50% guard so a user
      // quoting without liquidity isn't stuck at zero.
      let amountOutMin = 0n;
      if (expectedOutWei > 0n) {
        const tolerated = (expectedOutWei * BigInt(Math.round(slippagePct * 100))) / 10000n;
        amountOutMin = expectedOutWei - tolerated;
      } else {
        const fallbackGuard = (amountInWei * 50n) / 100n;
        amountOutMin =
          fromToken.isNative || toToken.isNative ? fallbackGuard : 0n;
      }

      let txData: `0x${string}`,
        txValue = "0x0" as `0x${string}`,
        approvalAddress: Address | undefined;

      if (activeDex.type === "V2") {
        if (fromToken.isNative) {
          txData = encodeFunctionData({
            abi: parseAbi([
              "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable"
            ]),
            functionName: "swapExactETHForTokens",
            args: [amountOutMin, [addrIn, addrOut], address, deadline]
          });
          txValue = toHex(amountInWei);
        } else {
          txData = encodeFunctionData({
            abi: parseAbi([
              "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)"
            ]),
            functionName: "swapExactTokensForTokens",
            args: [amountInWei, amountOutMin, [addrIn, addrOut], address, deadline]
          });
          approvalAddress = activeDex.router;
        }
      } else {
        txData = encodeFunctionData({
          abi: uniV3RouterAbi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: addrIn,
              tokenOut: addrOut,
              fee: feeTier,
              recipient: address,
              deadline,
              amountIn: amountInWei,
              amountOutMinimum: amountOutMin,
              sqrtPriceLimitX96: 0n
            }
          ]
        });
        if (fromToken.isNative) txValue = toHex(amountInWei);
        else approvalAddress = activeDex.router;
      }

      const swapWidget = (
        <SwapWidget
          userAddress={address}
          targetChain={targetChain}
          fromToken={fromToken}
          toToken={toToken}
          fromAmountFormatted={args[1]}
          toAmountFormatted="ROUTED"
          amountInWei={amountInWei}
          amountOutMin={amountOutMin}
          slippagePct={slippagePct}
          transactionRequest={{
            to: activeDex.router,
            data: txData,
            value: txValue
          }}
          approvalAddress={approvalAddress}
          theme={theme}
        />
      );

      return { id: generateId(), type: "component", component: swapWidget, title: `SWAP ${args[1]} ${fromToken.symbol}→${toToken.symbol}` };
    },
    balance: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      const targetChain =
        SUPPORTED_CHAINS.find((c) => c.id === activeChainId) ||
        SUPPORTED_CHAINS[5];
      const balData = await fetchTokenBalanceData(
        address as Address,
        targetChain,
        args[1]
      );
      return { id: generateId(), type: "balance", payload: balData };
    },
    portfolio: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };

      const filterType = args[1]?.toLowerCase();
      if (filterType && filterType !== "native" && filterType !== "erc20") {
        return {
          id: generateId(),
          type: "text",
          text: "Invalid filter. Use 'portfolio', 'portfolio native', or 'portfolio erc20'."
        };
      }

      const snapshot =
        (typeof window !== "undefined"
          ? JSON.parse(
              localStorage.getItem(
                `0xterm_user_${address.toLowerCase()}`
              ) || "{}"
            ).portfolioSnapshot
          : null) || null;

      const holdings = await fetchPortfolioHoldings(
        address as Address,
        filterType
      );

      // Build snapshot-holding map for the widget (from saved snapshot prices)
      const snapMap: Record<string, SnapshotHolding> = {};
      if (snapshot?.holdings) {
        for (const [key, val] of Object.entries(snapshot.holdings)) {
          const v = val as { price: number | null; balance: string };
          snapMap[key] = { price: v.price ?? null, balance: v.balance ?? "0" };
        }
      }

      return {
        id: generateId(),
        type: "portfolio",
        payload: {
          holdings,
          snapshot: snapMap,
          snapshotLabel: snapshot?.label,
          snapshotTime: snapshot?.timestamp,
          filterType
        }
      };
    },
    snapshot: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };

      const label = args[1] || `snapshot-${Date.now().toString().slice(-6)}`;
      const holdings: Record<string, SnapshotHolding> = {};

      for (const chain of SUPPORTED_CHAINS) {
        const client = getClient(chain);
        let nativeBal = 0n;
        try {
          nativeBal = await client.getBalance({ address: address as Address });
        } catch {
          nativeBal = 0n;
        }
        const nativePrice = await getTokenPriceUsd(
          chain,
          chain.nativeCurrency.symbol,
          WRAPPED_NATIVE[chain.id] || NATIVE_TOKEN_ADDRESS as Address,
          true
        );
        holdings[`${chain.id}:${chain.nativeCurrency.symbol}`] = {
          price: nativePrice,
          balance: formatEther(nativeBal)
        };

        const customList = customTokens[chain.id] || [];
        const commonMap = COMMON_TOKENS[chain.id] || {};
        const customAddrs = new Set(
          customList.map((t) => t.address.toLowerCase())
        );
        const view = [
          ...customList,
          ...Object.values(commonMap).filter(
            (c) => !customAddrs.has(c.address.toLowerCase())
          )
        ];
        for (const info of view) {
          if (info.address === NATIVE_TOKEN_ADDRESS) continue;
          const symbol = info.symbol;
          const addr = info.address as Address;
          try {
            const bal = (await client.readContract({
              address: addr,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as Address]
            })) as bigint;
            const decimals = info.decimals ?? 18;
            // address-keyed so duplicate symbols don't collide in the snapshot
            holdings[`${chain.id}:${addr.toLowerCase()}`] = {
              price: await getTokenPriceUsd(chain, symbol, addr, false),
              balance: formatUnits(bal, decimals)
            };
          } catch {
            // skip failed reads
          }
        }
      }

      savePreference("portfolioSnapshot", {
        label,
        timestamp: Date.now(),
        holdings
      });

      const count = Object.keys(holdings).length;
      return {
        id: generateId(),
        type: "text",
        text: `[✓] Snapshot "${label}" saved (${count} holdings) at ${new Date().toLocaleString()}. Run 'portfolio' to see P/L vs this snapshot.`
      };
    },
    pnl: async (args) => {
      if (!isConnected || !address)
        return {
          id: generateId(),
          type: "text",
          text: "Wallet not connected."
        };
      const prefs = JSON.parse(
        localStorage.getItem(`0xterm_user_${address.toLowerCase()}`) || "{}"
      );
      const snap = prefs.portfolioSnapshot;
      if (!snap) {
        return {
          id: generateId(),
          type: "text",
          text: "No snapshot found. Run 'snapshot' first to establish a P/L baseline."
        };
      }
      return {
        id: generateId(),
        type: "text",
        text: `Snapshot "${snap.label}" at ${new Date(snap.timestamp).toLocaleString()} with ${Object.keys(snap.holdings).length} holdings. Run 'portfolio' for per-token P/L.`
      };
    },
    pool: async (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first."
        };
      if (!args[1])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: pool <poolAddress>"
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const poolWidget = await fetchOnChainLiquidity(args[1], targetChain);
      return { id: generateId(), type: "component", component: poolWidget, title: `POOL ${args[1]}` };
    },
    ens: async (args) => {
      const sub = args[1]?.toLowerCase();

      if (sub === "set" || sub === "clear") {
        if (!isConnected || !address)
          return { id: generateId(), type: "text", text: "[!] Connect a wallet to manage ENS records." };

        const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
        if (!chain)
          return { id: generateId(), type: "text", text: "[!] Set a network first (network <name|id>)." };
        const contract = ENS_CONTRACT[chain.id];
        if (!contract)
          return {
            id: generateId(),
            type: "text",
            text: `[!] No ENS on ${chain.name} yet — deploy via contracts/script/EnsDeploy.md.`
          };
        if (chain.id === 1)
          return {
            id: generateId(),
            type: "text",
            text: "[!] The 0xterm ENS registry is testnet-only; mainnet uses the canonical ENS."
          };

        const who = getAddress(address);
        const doWrite = async (
          fn: "setRecord" | "clearRecord",
          writeArgs:
            | readonly [`0x${string}`, `0x${string}`, string]
            | readonly [`0x${string}`, `0x${string}`],
          label: string
        ): Promise<LogEntry | LogEntry[]> => {
          try {
            const hash = await writeContractAsync({
              address: contract as Address,
              abi: ensRegistryAbi,
              functionName: fn,
              args: writeArgs
            });
            return [
              { id: generateId(), type: "text", text: `[✓] ${label}` },
              { id: generateId(), type: "text", text: `   tx: ${hash}` }
            ];
          } catch (err: any) {
            return { id: generateId(), type: "text", text: `[!] ens ${sub} failed: ${err.message || err}` };
          }
        };

        if (sub === "clear") {
          // no params — remove the caller's own current name (one per address)
          let myName = "";
          try {
            myName = (await getClient(chain).readContract({
              address: contract as Address,
              abi: ensRegistryAbi,
              functionName: "nameOfAddr",
              args: [who]
            })) as string;
          } catch {
            myName = "";
          }
          if (!myName)
            return {
              id: generateId(),
              type: "text",
              text: "[✗] You don't have an ENS name registered on this network."
            };
          const node = namehash(myName.toLowerCase());
          return doWrite("clearRecord", [node, who], `Cleared ${myName} ↔ ${who}`);
        }

        if (args.length < 3)
          return { id: generateId(), type: "text", text: "Usage: ens set <name.eth>" };
        const name = args[2].trim();
        if (isAddress(name))
          return {
            id: generateId(),
            type: "text",
            text: `[!] "${name}" looks like an address — pass a name like alice.eth.`
          };
        const node = namehash(name.toLowerCase());
        return doWrite(
          "setRecord",
          [node, who, name.toLowerCase()],
          `Registered ${name.toLowerCase()} ↔ ${who}`
        );
      }

      if (!args[1])
        return {
          id: generateId(),
          type: "text",
          text: "Usage: ens <name.eth | address> | set <name.eth> | clear — resolve a name/address, or register/clear your record (one name per address, on the active network)."
        };

      const query = args[1].trim();
      const isEnsName =
        query.toLowerCase().endsWith(".eth") ||
        !isAddress(query);

      try {
        if (isEnsName) {
          const addr = await resolveChatRecipient(query);
          return {
            id: generateId(),
            type: "text",
            text: `[✓] ${query} → ${addr}`
          };
        }
        const name = await ensNameFor(getAddress(query));
        return {
          id: generateId(),
          type: "text",
          text: name
            ? `[✓] ${getAddress(query)} → ${name}`
            : `[✗] No primary ENS name found for ${getAddress(query)}.`
        };
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] ENS lookup failed: ${err.message || err}`
        };
      }
    },
    chat: async (args) => {
      if (!isConnected || !address)
        return { id: generateId(), type: "text", text: "[!] Connect a wallet to send chat messages." };
      if (args.length < 3)
        return {
          id: generateId(),
          type: "text",
          text: 'Usage: chat <recipientAddress | ens.eth> "<message...>"'
        };

      const recipientInput = args[1];
      const message = args.slice(2).join(" ");
      let recipient: Address;
      try {
        recipient = await resolveChatRecipient(recipientInput);
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] ${err.message || err}`
        };
      }

      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain)
        return { id: generateId(), type: "text", text: "[!] Set a network first (network <name|id>)." };
      const contract = chatContractAddress(chain.id);
      if (!contract)
        return {
          id: generateId(),
          type: "text",
          text: `[!] No chat contract deployed on ${chain.name}. Testnets only — see contracts/script/ChatDeploy.md.`
        };

      try {
        const myPair = await getChatKeyPair();
        const client = getClient(chain);

        // register my own key so the recipient can reply via address lookup —
        // only once; subsequent chats skip the write (key unchanged)
        const myRegistered = (await client.readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "getPublicKey",
          args: [address as Address]
        })) as `0x${string}`;
        if (!myRegistered || myRegistered === "0x" || myRegistered === "0x0") {
          await writeContractAsync({
            address: contract as Address,
            abi: chatAbi,
            functionName: "setPublicKey",
            args: [bytesToHex(myPair.publicKey)]
          });
        }

        // the recipient's key comes from the on-chain registry — no out-of-band
        // exchange. They must have registered once (their first chat auto-registers).
        const peerKey = (await client.readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "getPublicKey",
          args: [recipient as Address]
        })) as `0x${string}`;
        if (!peerKey || peerKey === "0x" || peerKey === "0x0")
          return {
            id: generateId(),
            type: "text",
            text: `[!] ${recipient} hasn't registered a chat key yet. Ask them to send their first chat message, then retry.`
          };

        const aesKey = await deriveAesKey(myPair.privateKey, hexToBytes(peerKey));
        const { iv, ciphertext } = await encryptMessage(aesKey, message);
        const fee = await client.readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "fee"
        });

        const hash = await writeContractAsync({
          address: contract as Address,
          abi: chatAbi,
          functionName: "sendMessage",
          args: [
            recipient as Address,
            bytesToHex(iv),
            bytesToHex(myPair.publicKey),
            bytesToHex(ciphertext)
          ],
          value: fee
        });

        return [
          {
            id: generateId(),
            type: "text",
            text: `[✓] Encrypted message sent to ${isAddress(recipientInput.trim()) ? recipient : `${recipientInput.trim()} → ${recipient}`} (fee ${fee})`
          },
          {
            id: generateId(),
            type: "text",
            text: `   tx: ${hash}`
          }
        ];
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] chat failed: ${err.message || err}`
        };
      }
    },
    inbox: async (args) => {
      if (!isConnected || !address)
        return { id: generateId(), type: "text", text: "[!] Connect a wallet to read chat." };

      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain)
        return { id: generateId(), type: "text", text: "[!] Set a network first." };
      const contract = chatContractAddress(chain.id);
      if (!contract)
        return {
          id: generateId(),
          type: "text",
          text: `[!] No chat contract deployed on ${chain.name}. Testnets only.`
        };

      // Read YOUR inbox by default; pass an address to read a peer's view of
      // their own threads. In practice reading your own inbox is the main path.
      const target = args[1] && isAddress(args[1]) ? getAddress(args[1]) : getAddress(address);

      try {
        // Enumerate all distinct senders (threads) for the target recipient.
        const senders = (await getClient(chain).readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "getSenders",
          args: [target as Address]
        })) as readonly Address[];

        if (senders.length === 0)
          return {
            id: generateId(),
            type: "text",
            text: `[✗] No messages for ${target}.`
          };

        // Fetch every thread (per-sender), decrypt with our key, and render
        // each sender as its own chat widget. A message only decrypts if it was
        // sent to us (ECDH matches our key + their senderKey).
        const myPair = await getChatKeyPair();
        const threads: LogEntry[] = [];
        for (const sender of senders) {
          const count = await getClient(chain).readContract({
            address: contract as Address,
            abi: chatAbi,
            functionName: "threadCount",
            args: [target as Address, sender]
          });
          const msgs = await getClient(chain).readContract({
            address: contract as Address,
            abi: chatAbi,
            functionName: "getThread",
            args: [target as Address, sender, 0n, count]
          });
          const messages: ChatMessage[] = [];
          for (const m of msgs) {
            try {
              const iv = hexToBytes(m.iv as string);
              const ct = hexToBytes(m.ciphertext as string);
              const senderPub = hexToBytes(m.senderKey as string);
              const aesKey = await deriveAesKey(myPair.privateKey, senderPub);
              const text = await decryptMessage(aesKey, { iv, ciphertext: ct });
              messages.push({
                from: m.from as string,
                timestamp: Number(m.timestamp),
                iv: m.iv as string,
                ciphertext: m.ciphertext as string,
                decrypted: text
              });
            } catch {
              messages.push({
                from: m.from as string,
                timestamp: Number(m.timestamp),
                iv: m.iv as string,
                ciphertext: m.ciphertext as string,
                decryptFailed: true
              });
            }
          }
          const peerLabel = (await ensNameFor(sender)) || undefined;
          threads.push({
            id: generateId(),
            type: "chat",
            payload: { messages, peer: sender, self: address, peerLabel }
          });
        }
        // render oldest thread first (by its first message)
        threads.sort(
          (a, b) =>
            a.payload.messages[0].timestamp - b.payload.messages[0].timestamp
        );

        // messages fetched — reset the poller baseline so it only reports
        // messages that arrive after this read
        const fresh: Record<string, number> = {};
        for (const s of senders) {
          fresh[s.toLowerCase()] = Number(
            await getClient(chain).readContract({
              address: contract as Address,
              abi: chatAbi,
              functionName: "threadCount",
              args: [target as Address, s]
            })
          );
        }
        chatBaseline.current = fresh;

        return threads;
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] inbox failed: ${err.message || err}`
        };
      }
    },
    chatfee: async () => {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain)
        return { id: generateId(), type: "text", text: "[!] Set a network first." };
      const contract = chatContractAddress(chain.id);
      if (!contract)
        return { id: generateId(), type: "text", text: `[!] No chat contract on ${chain.name}.` };
      try {
        const fee = await getClient(chain).readContract({
          address: contract as Address,
          abi: chatAbi,
          functionName: "fee"
        });
        return {
          id: generateId(),
          type: "text",
          text: `Chat fee on ${chain.name}: ${formatEther(fee)} ${chain.nativeCurrency.symbol}`
        };
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] chatfee failed: ${err.message || err}`
        };
      }
    },
    board: async (args) => {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain)
        return { id: generateId(), type: "text", text: "[!] Set a network first (network <name|id>)." };
      const contract = BILLBOARD_CONTRACT[chain.id];
      if (!contract)
        return {
          id: generateId(),
          type: "text",
          text: `[!] No billboard deployed on ${chain.name}. Testnets only — see contracts/script/BillboardDeploy.md.`
        };
      if (chain.id === 1)
        return {
          id: generateId(),
          type: "text",
          text: "[!] The 0xterm billboard is testnet-only; mainnet has no board contract."
        };

      const sub = args[1]?.toLowerCase();

      if (sub === "post") {
        if (!isConnected || !address)
          return { id: generateId(), type: "text", text: "[!] Connect a wallet to post to the board." };
        const content = args.slice(2).join(" ").trim();
        if (!content)
          return {
            id: generateId(),
            type: "text",
            text: "Usage: board post <content>"
          };
        try {
          const fee = await getClient(chain).readContract({
            address: contract as Address,
            abi: billboardAbi,
            functionName: "fee"
          });
          const hash = await writeContractAsync({
            address: contract as Address,
            abi: billboardAbi,
            functionName: "post",
            args: [content],
            value: fee
          });
          return [
            {
              id: generateId(),
              type: "text",
              text: `[✓] Posted to the ${chain.name} board (fee ${formatEther(fee)} ${chain.nativeCurrency.symbol})`
            },
            { id: generateId(), type: "text", text: `   tx: ${hash}` }
          ];
        } catch (err: any) {
          return {
            id: generateId(),
            type: "text",
            text: `[!] board post failed: ${err.message || err}`
          };
        }
      }

      // board / board list [count] — render latest posts as a widget
      const countStr = sub === "list" ? args[2] : args[1];
      let count = 5n;
      if (countStr && !isNaN(Number(countStr)) && Number(countStr) > 0)
        count = BigInt(Math.min(Math.floor(Number(countStr)), 50));

      try {
        const posts = ((await getClient(chain).readContract({
          address: contract as Address,
          abi: billboardAbi,
          functionName: "getLatest",
          args: [count, 0n]
        })) as unknown as BillboardPost[]).map((p) => ({
          ...p,
          timestamp: Number(p.timestamp)
        }));

        const total = (await getClient(chain).readContract({
          address: contract as Address,
          abi: billboardAbi,
          functionName: "postCount"
        })) as bigint;

        const postTotal = Number(total);
        if (postTotal === 0)
          return {
            id: generateId(),
            type: "text",
            text: `[✗] No posts on the ${chain.name} board yet. Post with: board post <content>`
          };

        const onLoadPage = async (offset: number): Promise<BillboardPost[]> => {
          const page = (await getClient(chain).readContract({
            address: contract as Address,
            abi: billboardAbi,
            functionName: "getLatest",
            args: [count, BigInt(Math.max(0, offset))]
          })) as unknown as BillboardPost[];
          return page.map((p) => ({ ...p, timestamp: Number(p.timestamp) }));
        };

        return {
          id: generateId(),
          type: "billboard",
          payload: { posts, total: postTotal, pageSize: Number(count), onLoadPage }
        };
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] board failed: ${err.message || err}`
        };
      }
    },
    boardfee: async () => {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
      if (!chain)
        return { id: generateId(), type: "text", text: "[!] Set a network first." };
      const contract = BILLBOARD_CONTRACT[chain.id];
      if (!contract)
        return { id: generateId(), type: "text", text: `[!] No billboard contract on ${chain.name}.` };
      try {
        const fee = await getClient(chain).readContract({
          address: contract as Address,
          abi: billboardAbi,
          functionName: "fee"
        });
        return {
          id: generateId(),
          type: "text",
          text: `Board fee on ${chain.name}: ${formatEther(fee)} ${chain.nativeCurrency.symbol}`
        };
      } catch (err: any) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] boardfee failed: ${err.message || err}`
        };
      }
    },
    connect: () => {
      if (!isConnected) {
        open();
        return {
          id: generateId(),
          type: "text",
          text: "Opening secure wallet connection modal..."
        };
      }
      return {
        id: generateId(),
        type: "text",
        text: "Wallet is already connected."
      };
    },
    disconnect: () => {
      disconnect();
      return { id: generateId(), type: "text", text: "Disconnected." };
    },
    rain: () => {
      onToggleRain();
      return { id: generateId(), type: "text", text: "Rain toggled." };
    }
  };

  // Helper functions for common RPC providers
  function getAlchemySubdomain(chainId: number): string | null {
    switch (chainId) {
      case 1:
        return "eth-mainnet";
      case 11155111:
        return "eth-sepolia";
      case 42161:
        return "arb-mainnet";
      case 10:
        return "opt-mainnet";
      case 137:
        return "polygon-mainnet";
      case 8453:
        return "base-mainnet";
      default:
        return null;
    }
  }

  function getInfuraSubdomain(chainId: number): string | null {
    switch (chainId) {
      case 1:
        return "mainnet";
      case 11155111:
        return "sepolia";
      case 42161:
        return "arbitrum-mainnet";
      case 10:
        return "optimism-mainnet";
      case 137:
        return "polygon-mainnet";
      case 8453:
        return "base-mainnet";
      default:
        return null;
    }
  }

  // Assign Command Aliases
  commands.nets = commands.networks;
  commands.net = commands.network;
  commands.initpool = commands.initialize;
  commands.findpool = commands.getpool;
  commands.provideliq = commands.addliq;
  commands.bal = commands.balance;
  commands.liquidity = commands.pool;
  commands.reg = commands.register;
  commands.exp = commands.export;
  commands.imp = commands.import;
  commands.style = commands.theme;
  commands.msg = commands.chat;
  commands.messages = commands.inbox;

  const availableCommands = Object.keys(commands);

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userLog: LogEntry = {
      id: generateId(),
      type: "input",
      text: `$ ${trimmed}`
    };

    setLogs((prev) => [...prev, userLog].slice(-MAX_LOGS));
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);

    const args = trimmed.split(/\s+/).filter(Boolean);
    const command = args[0].toLowerCase();
    trackEvent("command_run", { command });
    const handler = commands[command];

    if (!handler) {
      setLogs((prev) =>
        [
          ...prev,
          {
            id: generateId(),
            type: "text",
            text: `Command not recognized: "${command}". Type "help".`
          } as LogEntry
        ].slice(-MAX_LOGS)
      );
      return;
    }

    try {
      const result = await handler(args, trimmed);
      if (result !== null) {
        const newEntries = Array.isArray(result) ? result : [result];
        setLogs((prev) => [...prev, ...newEntries].slice(-MAX_LOGS));
      }
    } catch (err: any) {
      setLogs((prev) =>
        [
          ...prev,
          {
            id: generateId(),
            type: "text",
            text: formatViemError(err)
          } as LogEntry
        ].slice(-MAX_LOGS)
      );
    }
  };

  // Live-preview a highlighted suggestion into the input (replaces the last
  // token, no trailing space) so arrow-travel shows the value without
  // committing; Tab/Space/Enter then finalize via applySuggestion.
  const previewSuggestion = (suggestion: string) => {
    if (input.endsWith(" ")) {
      setInput(input + suggestion);
    } else {
      const lastSpaceIdx = input.lastIndexOf(" ");
      if (lastSpaceIdx === -1) {
        setInput(suggestion);
      } else {
        setInput(input.substring(0, lastSpaceIdx + 1) + suggestion);
      }
    }
  };

  const applySuggestion = (suggestion: string) => {
    if (input.endsWith(" ")) {
      setInput(input + suggestion + " ");
    } else {
      const lastSpaceIdx = input.lastIndexOf(" ");
      if (lastSpaceIdx === -1) {
        setInput(suggestion + " ");
      } else {
        setInput(input.substring(0, lastSpaceIdx + 1) + suggestion + " ");
      }
    }
    setSuggestions([]);
    setSuggestionIdx(-1);
    inputRef.current?.focus();
  };

  // Opens the CHOICES picker for an ambiguous token symbol. Returns a Promise
  // that resolves with the chosen entry, or null if the user cancels (Escape).
  // The awaiting command (via resolveTokenDetails) suspends on this Promise.
  const openTokenPicker = (
    matches: CustomTokenEntry[],
    chain: Chain
  ): Promise<CustomTokenEntry | null> =>
    new Promise((resolve) => {
      const choices = matches.map((t) => ({
        label: `${t.symbol}@${t.address.slice(0, 6)}…${t.address.slice(-4)}`,
        token: t
      }));
      pickBaseInputRef.current = input;
      setPendingTokenPick({ choices, resolve });
      setSuggestions(choices.map((c) => c.label));
      setSuggestionIdx(0);
      previewSuggestion(choices[0].label);
      setLogs((prev) =>
        [
          ...prev,
          {
            id: generateId(),
            type: "text",
            text: `[?] Symbol "${matches[0].symbol}" is ambiguous on ${chain.name} — choose a token:`
          } as LogEntry
        ].slice(-MAX_LOGS)
      );
    });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // While a token pick is open, route all keys to the picker (shadows Tab
    // autocomplete and normal Enter handling).
    if (pendingTokenPick) {
      const { choices, resolve } = pendingTokenPick;
      if (e.key === "Enter" || e.key === "Tab" || e.key === " ") {
        e.preventDefault();
        const idx = Math.max(0, suggestionIdx);
        const chosen = choices[idx]?.token ?? null;
        setPendingTokenPick(null);
        setSuggestions([]);
        setSuggestionIdx(-1);
        // input holds the stale typed value; restore base + chosen label so the
        // resumed command parses exactly what was picked.
        setInput(pickBaseInputRef.current.replace(/\S+$/, "") + choices[idx]?.label + " ");
        resolve(chosen);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSuggestionIdx((prev) => {
          const next = (prev + 1) % choices.length;
          previewSuggestion(choices[next].label);
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSuggestionIdx((prev) => {
          const next = (prev - 1 + choices.length) % choices.length;
          previewSuggestion(choices[next].label);
          return next;
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPendingTokenPick(null);
        setSuggestions([]);
        setSuggestionIdx(-1);
        setInput("");
        resolve(null);
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();

      if (suggestions.length > 0) {
        applySuggestion(suggestions[suggestionIdx]);
        return;
      }

      const rawArgs = input.trimStart().split(/\s+/).filter(Boolean);
      if (rawArgs.length === 0) return;

      const isTypingCommand = rawArgs.length === 1 && !input.endsWith(" ");

      if (isTypingCommand) {
        const val = input.trim().toLowerCase();
        const matches = availableCommands
          .filter((c) => c.startsWith(val))
          .sort();

        if (matches.length === 1) {
          applySuggestion(matches[0]);
        } else if (matches.length > 1) {
          setSuggestions(matches);
          setSuggestionIdx(0);
        }
      } else {
        const command = rawArgs[0].toLowerCase();
        const currentArgIdx = input.endsWith(" ")
          ? rawArgs.length
          : rawArgs.length - 1;
        const partialArg = input.endsWith(" ")
          ? ""
          : rawArgs[rawArgs.length - 1].toLowerCase();

        let candidates: string[] = [];

        // 1. Networks & Dexes
        if (
          (command === "network" || command === "net" || command === "nets") &&
          currentArgIdx === 1
        ) {
          candidates = SUPPORTED_CHAINS.map((c) => c.name);
        } else if (command === "dex" && currentArgIdx === 1) {
          if (activeChainId && DEX_REGISTRY[activeChainId]) {
            candidates = DEX_REGISTRY[activeChainId].map((d) => d.id);
          }

          // 2. Theming
        } else if (
          (command === "theme" || command === "style") &&
          currentArgIdx === 1
        ) {
          candidates = [...THEME_ORDER];

          // 3. Tokens Command
        } else if (command === "tokens" && currentArgIdx === 1) {
          candidates = ["erc20", "erc721"];

          // 4. Contract Checking
        } else if (command === "is" && currentArgIdx === 1) {
          candidates = ["erc20", "erc721", "nft"];

          // 4b. ENS subcommands
        } else if (command === "ens" && currentArgIdx === 1) {
          candidates = ["set", "clear"];

          // 4c. Board subcommands
        } else if (command === "board" && currentArgIdx === 1) {
          candidates = ["post", "list"];

          // 5. Register Command (Allows for optional symbol argument)
        } else if (
          (command === "register" || command === "reg") &&
          (currentArgIdx === 2 || currentArgIdx === 3)
        ) {
          candidates = ["erc20", "erc721"];

          // 6. RPC Management
        } else if (command === "rpc") {
          if (currentArgIdx === 1) {
            candidates = [
              "use",
              "add",
              "remove",
              "rm",
              "alchemy",
              "infura",
              "quicknode"
            ];
          } else if (
            currentArgIdx === 2 &&
            (rawArgs[1]?.toLowerCase() === "use" ||
              rawArgs[1]?.toLowerCase() === "switch" ||
              rawArgs[1]?.toLowerCase() === "remove" ||
              rawArgs[1]?.toLowerCase() === "rm")
          ) {
            candidates = ["default"];
            if (activeChainId && rpcProviders[activeChainId]) {
              candidates.push(...Object.keys(rpcProviders[activeChainId]));
            }
          }

          // 7. Liquidity & Pool Fee Tiers (Arg 3)
        } else if (
          [
            "createpool",
            "initialize",
            "initpool",
            "getpool",
            "findpool"
          ].includes(command) &&
          currentArgIdx === 3
        ) {
          candidates = ["100", "500", "3000", "10000"];

          // 8. Add Liquidity Fee Tiers (Arg 5)
        } else if (
          ["addliq", "provideliq"].includes(command) &&
          currentArgIdx === 5
        ) {
          candidates = ["100", "500", "3000", "10000"];

          // 9. Deploy Command
        } else if (command === "deploy" && currentArgIdx === 1) {
          candidates = ["erc20", "erc721"];

          // 10. Standard Token Resolution
        } else {
          let isTokenArg = false;
          if (
            command === "swap" &&
            (currentArgIdx === 2 || currentArgIdx === 3)
          )
            isTokenArg = true;
          if (
            [
              "addliq",
              "provideliq",
              "createpool",
              "initialize",
              "initpool",
              "getpool",
              "findpool",
              "price"
            ].includes(command) &&
            (currentArgIdx === 1 || currentArgIdx === 2)
          )
            isTokenArg = true;
          if (["balance", "bal"].includes(command) && currentArgIdx === 1)
            isTokenArg = true;

          if (isTokenArg && activeChainId) {
            const commonMap = COMMON_TOKENS[activeChainId] || {};
            const customList = customTokens[activeChainId] || [];

            // Candidate labels: a hardcoded common token always yields its plain
            // symbol; a custom token yields its plain symbol only when it's the
            // sole occurrence of that symbol (otherwise it would be ambiguous),
            // and the address-qualified SYM@0xaddr form always (custom shadows
            // hardcoded in resolveTokenDetails, but the plain common label
            // remains the user's way to reach the hardcoded token).
            const labelSet = new Set<string>();
            const symCounts = new Map<string, number>();
            for (const t of customList)
              symCounts.set(
                t.symbol.toUpperCase(),
                (symCounts.get(t.symbol.toUpperCase()) || 0) + 1
              );
            for (const sym of Object.keys(commonMap))
              labelSet.add(sym);
            for (const t of customList) {
              const k = t.symbol.toUpperCase();
              // Plain label only when this symbol is unique to a single custom
              // token AND no common token shares it (plain common exists then).
              if (symCounts.get(k) === 1 && !(k in commonMap))
                labelSet.add(t.symbol);
              labelSet.add(
                `${t.symbol}@${t.address.slice(0, 6)}…${t.address.slice(-4)}`
              );
            }

            const chainObj = SUPPORTED_CHAINS.find(
              (c) => c.id === activeChainId
            );
            if (chainObj) labelSet.add(chainObj.nativeCurrency.symbol);
            if (command === "price") {
              labelSet.add("pool");
              labelSet.add("api");
            }
            candidates = Array.from(labelSet);
          } else if (command === "price" && currentArgIdx === 3) {
            candidates = ["pool", "api"];
          }
        }

        if (candidates.length > 0) {
          const matches = candidates
            .filter((c) => c.toLowerCase().startsWith(partialArg))
            .sort();

          if (matches.length === 1) {
            applySuggestion(matches[0]);
          } else if (matches.length > 1) {
            setSuggestions(matches);
            setSuggestionIdx(0);
          }
        }
      }
    } else if (suggestions.length > 0) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSuggestionIdx((prev) => {
          const next = (prev + 1) % suggestions.length;
          previewSuggestion(suggestions[next]);
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSuggestionIdx((prev) => {
          const next = (prev - 1 + suggestions.length) % suggestions.length;
          previewSuggestion(suggestions[next]);
          return next;
        });
      } else if (e.key === "Enter" || e.key === "Tab" || e.key === " ") {
        e.preventDefault();
        applySuggestion(suggestions[suggestionIdx]);
      } else if (e.key === "Escape") {
        setSuggestions([]);
        setSuggestionIdx(-1);
      }
    } else {
      if (e.key === "Enter") {
        if (pendingConfirm) {
          const { onYes, onNo } = pendingConfirm;
          setPendingConfirm(null);
          const answer = input.trim().toLowerCase();
          if (answer === "y" || answer === "yes" || answer === "") {
            onYes();
          } else {
            onNo();
          }
          setInput("");
        } else {
          handleCommand(input);
          setInput("");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length > 0 && historyIdx + 1 < history.length) {
          setHistoryIdx(historyIdx + 1);
          setInput(history[history.length - 1 - (historyIdx + 1)]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx > 0) {
          setHistoryIdx(historyIdx - 1);
          setInput(history[history.length - 1 - (historyIdx - 1)]);
        } else {
          setHistoryIdx(-1);
          setInput("");
        }
      }
    }
  };

  return (
    <div
      className={`relative z-10 w-full h-full flex flex-col cursor-text overflow-hidden transition-all duration-300 ${theme.bg} ${theme.text} ${theme.font}`}
      style={{
        ["--phosphor" as string]: theme.phosphor,
        ["--scanline-alpha" as string]: theme.scanlineAlpha,
        ["--grid-color" as string]: theme.gridColor
      }}
    >
      {theme.hasScanlines && <div className="crt-scanlines" />}
      {theme.hasGrid && (
        <div
          className={
            currentThemeKey === "teletype" ? "term-grid-bars" : "term-grid"
          }
        />
      )}

      {/* TOP HEADER BAR */}
      <TerminalHeader
        theme={theme}
        currentThemeKey={currentThemeKey}
        onThemeChange={handleThemeSwitch}
        onCommand={handleCommand}
        chainName={SUPPORTED_CHAINS.find((c) => c.id === activeChainId)?.name}
      />

      {/* TERMINAL CONTENT CONTAINER */}
      <div
        className={`flex-1 flex flex-col px-6 pb-6 ${HEADER_PAD[theme.headerStyle]} overflow-hidden relative z-10`}
        onClick={() => inputRef.current?.focus()}
      >
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto space-y-2.5 pt-2 pr-2 whitespace-pre-wrap"
        >
          <TerminalLogList
            logs={logs}
            theme={theme}
            activeChainId={activeChainId}
            onPin={onPin}
            pinnedIds={new Set(pinned.map((p) => p.id))}
          />
        </div>

        {/* FLOATING PINNED WIDGET COLUMN (right) */}
        <PinnedPanel
          pinned={pinned}
          theme={theme}
          refreshing={refreshingId}
          countdowns={countdowns}
          onRefresh={onRefreshPinned}
          onMinimize={onMinimize}
          onUnpin={onUnpin}
        />

        {/* TWO-LINE PROMPT LAYOUT */}
        <TerminalPrompt
          theme={theme}
          input={input}
          setInput={(val: string) => {
            setInput(val);
            if (suggestions.length > 0) {
              setSuggestions([]);
              setSuggestionIdx(-1);
            }
            if (pendingTokenPick) {
              setPendingTokenPick(null);
            }
          }}
          handleKeyDown={handleKeyDown}
          inputRef={inputRef}
          suggestions={suggestions}
          suggestionIdx={suggestionIdx}
          activeChainId={activeChainId}
          activeDexId={activeDexId}
          isConnected={isConnected}
          address={address}
          mounted={mounted}
        />
      </div>
    </div>
  );
}
