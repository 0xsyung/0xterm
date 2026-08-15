/**
 * @file TerminalShell.tsx
 * @description 0xTERM Terminal Shell Component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
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
  resolveChain
} from "./constants";
import type { LogEntry, ThemeMode, DexProtocol } from "./types";

const MAX_LOGS = 100;

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
      className={`cursor-pointer font-mono transition-colors relative group inline-flex items-center gap-1 ${
        copied ? "text-green-400 font-bold" : "hover:underline"
      } ${className}`}
      title="Click to copy address"
    >
      <span>{address}</span>
      <span className="text-[10px] opacity-60 group-hover:opacity-100">
        {copied ? "[COPIED!]" : "📋"}
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
              <span className="text-green-400 font-bold">COPIED!</span>
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
        className={`p-3 bg-black/40 rounded border ${theme.border} font-mono text-[10px] overflow-x-auto select-all max-h-48 text-green-400`}
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

  // Custom User-Registered Tokens Map: ChainId -> { SYMBOL: TokenDetails }
  const [customTokens, setCustomTokens] = useState<
    Record<
      number,
      Record<
        string,
        {
          address: Address;
          symbol: string;
          name: string;
          decimals?: number; // ERC-20 only; ERC-721 has no decimals
          tokenType?: "erc20" | "erc721";
          isNative: boolean;
        }
      >
    >
  >({});

  const theme = THEMES[currentThemeKey];

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", type: "text", text: "0xTERM v1.5.0 [FULL ON-CHAIN DEFI SUITE]" },
    { id: "2", type: "text", text: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n' }
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);

  // Pending interactive confirmation (e.g. register an unverified contract).
  // When set, the next Enter routes the typed input through this resolver.
  const [pendingConfirm, setPendingConfirm] = useState<{
    onYes: () => void;
    onNo: () => void;
  } | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

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

  const saveCustomTokenToStorage = (updatedTokens: typeof customTokens) => {
    if (!isConnected || !address) return;
    const storageKey = `0xterm_custom_tokens_${address.toLowerCase()}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedTokens));
    } catch (e) {
      console.error("Failed to save custom tokens", e);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      const storageKey = `0xterm_user_${address.toLowerCase()}`;
      const tokensKey = `0xterm_custom_tokens_${address.toLowerCase()}`;
      try {
        const savedTokens = localStorage.getItem(tokensKey);
        if (savedTokens) {
          setCustomTokens(JSON.parse(savedTokens));
        }

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const prefs = JSON.parse(saved);
          const loadedDetails: string[] = [];

          if (prefs.theme && THEMES[prefs.theme as ThemeMode]) {
            onThemeChange(prefs.theme as ThemeMode);
            loadedDetails.push(
              `Theme: ${THEMES[prefs.theme as ThemeMode].name}`
            );
          }

          if (prefs.rpcProviders) setRpcProviders(prefs.rpcProviders);
          if (prefs.activeRpcProviders)
            setActiveRpcProviders(prefs.activeRpcProviders);

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
<<<<<<< HEAD
            client.readContract({ address, abi: erc20FullAbi, functionName: "decimals" }),
            client.readContract({ address, abi: erc20FullAbi, functionName: "symbol" }),
            client.readContract({ address, abi: erc20FullAbi, functionName: "name" })
          ]);
          return { type: "erc20", name: String(name), symbol: String(sym), decimals: Number(decimals) };
=======
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
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
        }
      } catch {}
    }

    // Fallback: probe core functions directly (many tokens lack ERC-165).
    const erc721Candidates = hint === "erc20" ? [] : ["ownerOf", "tokenURI"];
    for (const fn of erc721Candidates) {
      try {
<<<<<<< HEAD
        await client.readContract({ address, abi: erc721Abi, functionName: fn as any });
        let name = "", symbol = "";
        try {
          const [n, s] = await Promise.all([
            client.readContract({ address, abi: erc721Abi, functionName: "name" }),
            client.readContract({ address, abi: erc721Abi, functionName: "symbol" })
          ]);
          name = String(n); symbol = String(s);
=======
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
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
        } catch {}
        return { type: "erc721", name, symbol };
      } catch {}
    }

    // ERC-20 fallback: totalSupply + decimals + symbol + name must all succeed
    if (hint !== "erc721") {
      try {
        const [total, dec, sym, name] = await Promise.all([
<<<<<<< HEAD
          client.readContract({ address, abi: erc20FullAbi, functionName: "totalSupply" }),
          client.readContract({ address, abi: erc20FullAbi, functionName: "decimals" }),
          client.readContract({ address, abi: erc20FullAbi, functionName: "symbol" }),
          client.readContract({ address, abi: erc20FullAbi, functionName: "name" })
=======
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
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
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

    const preset =
      COMMON_TOKENS[chain.id]?.[sym] || customTokens[chain.id]?.[sym];
    if (preset) return { ...preset, isNative: false };

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
          <div className="text-yellow-400 my-2 p-3 border border-yellow-900/50 bg-yellow-950/30 rounded max-w-md text-xs">
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
    help: () => ({ id: generateId(), type: "help" }),
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
      const custom = customTokens[activeChainId] || {};

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

      for (const [symbol, info] of Object.entries(custom)) {
        allTokens.push({
          symbol,
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
          if (isConnected)
            await switchChainAsync({ chainId: targetChain.id }).catch(() => {});
          netText = `[✓] Network set to ${targetChain.name}`;
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
      const themeKeys = Object.keys(THEMES) as ThemeMode[];
      if (!args[1]) {
        return {
          id: generateId(),
          type: "text",
          text: `Active Theme: ${theme.name}.\nAvailable themes: ${themeKeys.join(", ")}`
        };
      }

      const targetThemeKey = args[1].toLowerCase() as ThemeMode;
      if (!THEMES[targetThemeKey]) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Error: Theme "${args[1]}" not found.\nAvailable themes: ${themeKeys.join(", ")}`
        };
      }

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
<<<<<<< HEAD
      const symbolArg = args[2] && !lowerArgs[0].match(/^(erc20|erc721|nft)$/)
        ? args[2]
        : undefined;
=======
      const symbolArg =
        args[2] && !lowerArgs[0].match(/^(erc20|erc721|nft)$/)
          ? args[2]
          : undefined;
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)

      const detected = await detectTokenType(tokenAddress, targetChain, hint);

      // Confirmation resolver: register anyway or cancel
<<<<<<< HEAD
      const doRegister = (info: { name: string; symbol: string; decimals?: number; tokenType: "erc20" | "erc721" }) => {
=======
      const doRegister = (info: {
        name: string;
        symbol: string;
        decimals?: number;
        tokenType: "erc20" | "erc721";
      }) => {
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
        const symbolToUse = (symbolArg ? symbolArg : info.symbol).toUpperCase();

        const existingCommon = COMMON_TOKENS[targetChain.id]?.[symbolToUse];
        const existingCustom = customTokens[targetChain.id]?.[symbolToUse];
        const isNative =
          symbolToUse === targetChain.nativeCurrency.symbol.toUpperCase();

        if (existingCommon || existingCustom || isNative) {
<<<<<<< HEAD
          setLogs((prev) => [
            ...prev,
            {
              id: generateId(),
              type: "text",
              text: `[!] Error: Symbol "${symbolToUse}" already exists on ${targetChain.name}. Please register with a unique symbol (e.g., 'register ${tokenAddress} UNIQUE_SYMBOL').`
            } as LogEntry
          ].slice(-MAX_LOGS));
=======
          setLogs((prev) =>
            [
              ...prev,
              {
                id: generateId(),
                type: "text",
                text: `[!] Error: Symbol "${symbolToUse}" already exists on ${targetChain.name}. Please register with a unique symbol (e.g., 'register ${tokenAddress} UNIQUE_SYMBOL').`
              } as LogEntry
            ].slice(-MAX_LOGS)
          );
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
          return;
        }

        const newToken = {
          address: tokenAddress,
          symbol: symbolToUse,
          name: info.name,
          decimals: info.decimals,
          tokenType: info.tokenType,
          isNative: false
        };

        const updatedChainTokens = {
          ...(customTokens[targetChain.id] || {}),
          [symbolToUse]: newToken
        };
        const updatedAllTokens = {
          ...customTokens,
          [targetChain.id]: updatedChainTokens
        };

        setCustomTokens(updatedAllTokens);
        saveCustomTokenToStorage(updatedAllTokens);

<<<<<<< HEAD
        setLogs((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "text",
            text: `[✓] Successfully registered ${info.tokenType === "erc721" ? "NFT" : "token"} "${symbolToUse}" (${info.name}${info.decimals !== undefined ? `, ${info.decimals} decimals` : ""}) at ${tokenAddress} on ${targetChain.name}.`
          } as LogEntry
        ].slice(-MAX_LOGS));
=======
        setLogs((prev) =>
          [
            ...prev,
            {
              id: generateId(),
              type: "text",
              text: `[✓] Successfully registered ${info.tokenType === "erc721" ? "NFT" : "token"} "${symbolToUse}" (${info.name}${info.decimals !== undefined ? `, ${info.decimals} decimals` : ""}) at ${tokenAddress} on ${targetChain.name}.`
            } as LogEntry
          ].slice(-MAX_LOGS)
        );
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
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
<<<<<<< HEAD
          setLogs((prev) => [
            ...prev,
            {
              id: generateId(),
              type: "text",
              text: `[✓] Cancelled. ${tokenAddress} was not registered.`
            } as LogEntry
          ].slice(-MAX_LOGS))
=======
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
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
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
      const target = args[1]?.toLowerCase();
      const kind = target === "erc721" || target === "nft" ? "erc721" : "erc20";
      let addrArg = kind === "erc721" ? args[2] : args[1];

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
          text:
            kind === "erc721"
              ? "Usage: is erc721 <contractAddress>"
              : "Usage: is erc20 <contractAddress>"
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
        const fnChecks: [string, string][] = [
          ["balanceOf", "balanceOf(address) → uint256"],
          ["ownerOf", "ownerOf(uint256) → address"],
          ["safeTransferFrom", "safeTransferFrom(address,address,uint256)"]
        ];
        for (const [fn, label] of fnChecks) {
          try {
            await client.readContract({
              address,
              abi: erc721Abi,
              functionName: fn as any
            });
            verified.push(label);
          } catch {
            checks.push(label);
          }
        }
      } else {
        const fnChecks: [string, string][] = [
          ["totalSupply", "totalSupply() → uint256"],
          ["balanceOf", "balanceOf(address) → uint256"],
          ["transfer", "transfer(address,uint256) → bool"],
          ["transferFrom", "transferFrom(address,address,uint256) → bool"],
          ["approve", "approve(address,uint256) → bool"],
          ["allowance", "allowance(address,address) → uint256"]
        ];
        for (const [fn, label] of fnChecks) {
          try {
            await client.readContract({
              address,
              abi: erc20FullAbi,
              functionName: fn as any
            });
            verified.push(label);
          } catch {
            checks.push(label);
          }
        }
      }

      const okCount = verified.length;
      const missingCount = checks.length;
      const allCore = okCount === (isErc721 ? 3 : 6);

      // Report optional metadata too
      let meta = "";
      try {
        const [sym, name] = await Promise.all([
<<<<<<< HEAD
          client.readContract({ address, abi: erc20FullAbi, functionName: "symbol" }),
          client.readContract({ address, abi: erc20FullAbi, functionName: "name" })
=======
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
>>>>>>> ec2c6ba (feat: add tokens command to list registered tokens)
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
        `Core functions callable: ${okCount}/${isErc721 ? 3 : 6}`,
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
        customTokens: tokens
      };

      const exportWidget = (
        <ExportWidget exportData={exportData} theme={theme} address={address} />
      );
      return { id: generateId(), type: "component", component: exportWidget };
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
          if (
            data.preferences.theme &&
            THEMES[data.preferences.theme as ThemeMode]
          ) {
            onThemeChange(data.preferences.theme as ThemeMode);
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
          localStorage.setItem(tokensKey, JSON.stringify(data.customTokens));
          setCustomTokens(data.customTokens);
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
          text: "Usage: price <tokenA> [tokenB] [pool|api]"
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
              args: [addrA, addrB, 3000]
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
            component: priceWidget
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

        const chainName = targetChain ? targetChain.name.toLowerCase() : "";

        let pair = data.pairs.find((p: any) => {
          const matchesChain = p.chainId.toLowerCase() === chainName;
          const matchesQuote = queryB
            ? p.quoteToken.symbol.toLowerCase() === queryB.toLowerCase()
            : true;
          return matchesChain && matchesQuote;
        });

        if (!pair)
          pair = data.pairs.find(
            (p: any) => p.chainId.toLowerCase() === chainName
          );
        if (!pair) pair = data.pairs[0];

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
                  className={`text-base font-bold ${h24 >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {h24 !== undefined ? `${h24 > 0 ? "+" : ""}${h24}%` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        );

        return { id: generateId(), type: "component", component: priceWidget };
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
      return { id: generateId(), type: "component", component: poolWidget };
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
      const activeDex = DEX_REGISTRY[activeChainId].find(
        (d) => d.id === activeDexId
      )!;

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
          text: "Usage: swap <amount> <fromToken> <toToken>"
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const activeDex = DEX_REGISTRY[activeChainId].find(
        (d) => d.id === activeDexId
      )!;

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
            args: [0n, [addrIn, addrOut], address, deadline]
          });
          txValue = toHex(amountInWei);
        } else {
          txData = encodeFunctionData({
            abi: parseAbi([
              "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)"
            ]),
            functionName: "swapExactTokensForTokens",
            args: [amountInWei, 0n, [addrIn, addrOut], address, deadline]
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
              fee: 3000,
              recipient: address,
              deadline,
              amountIn: amountInWei,
              amountOutMinimum: 0n,
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
          transactionRequest={{
            to: activeDex.router,
            data: txData,
            value: txValue
          }}
          approvalAddress={approvalAddress}
        />
      );

      return { id: generateId(), type: "component", component: swapWidget };
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
      return { id: generateId(), type: "component", component: poolWidget };
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

        if (
          (command === "network" || command === "net") &&
          currentArgIdx === 1
        ) {
          candidates = SUPPORTED_CHAINS.map((c) => c.name);
        } else if (command === "dex" && currentArgIdx === 1) {
          if (activeChainId && DEX_REGISTRY[activeChainId]) {
            candidates = DEX_REGISTRY[activeChainId].map((d) => d.id);
          }
        } else if (
          (command === "theme" || command === "style") &&
          currentArgIdx === 1
        ) {
          candidates = Object.keys(THEMES);
        } else if (command === "is" && currentArgIdx === 1) {
          candidates = ["erc20", "erc721", "nft"];
        } else if (command === "register" && currentArgIdx === 3) {
          candidates = ["erc20", "erc721"];
        } else if (command === "rpc") {
          if (currentArgIdx === 1) {
            candidates = [
              "use",
              "add",
              "remove",
              "alchemy",
              "infura",
              "quicknode"
            ];
          } else if (
            currentArgIdx === 2 &&
            (rawArgs[1]?.toLowerCase() === "use" ||
              rawArgs[1]?.toLowerCase() === "switch" ||
              rawArgs[1]?.toLowerCase() === "remove")
          ) {
            candidates = ["default"];
            if (activeChainId && rpcProviders[activeChainId]) {
              candidates.push(...Object.keys(rpcProviders[activeChainId]));
            }
          }
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
            candidates = Object.keys(COMMON_TOKENS[activeChainId] || {});
            const customForChain = Object.keys(
              customTokens[activeChainId] || {}
            );
            candidates.push(...customForChain);
            const chainObj = SUPPORTED_CHAINS.find(
              (c) => c.id === activeChainId
            );
            if (chainObj) candidates.push(chainObj.nativeCurrency.symbol);
            if (command === "price") candidates.push("pool", "api");
            candidates = Array.from(new Set(candidates));
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
        setSuggestionIdx((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSuggestionIdx(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length
        );
      } else if (e.key === "Enter") {
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
    >
      {/* EXCLUSIVE SCANLINE OVERLAY */}
      {currentThemeKey === "matrix" && (
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-70 z-20"></div>
      )}
      {currentThemeKey === "bloomberg" && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffb000_1px,transparent_1px)] [background-size:16px_16px] opacity-10 z-20"></div>
      )}

      {/* TOP HEADER BAR */}
      <TerminalHeader
        theme={theme}
        currentThemeKey={currentThemeKey}
        onThemeChange={handleThemeSwitch}
      />

      {/* TERMINAL CONTENT CONTAINER */}
      <div
        className="flex-1 flex flex-col p-6 pt-20 overflow-hidden relative z-10"
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
          />
        </div>

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
