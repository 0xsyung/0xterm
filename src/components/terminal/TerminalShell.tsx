"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import {
  formatEther,
  formatUnits,
  parseUnits,
  isAddress,
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
          decimals: number;
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

  const handleThemeSwitch = (newTheme: ThemeMode) => {
    onThemeChange(newTheme);
    savePreference("theme", newTheme);
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

    const client = createPublicClient({ chain, transport: http() });
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
      // Ignore fetch errors during token resolution and let it throw below
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

    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });
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
            className={`${theme.text} select-all p-2 bg-current/10 rounded border ${theme.border} text-center my-2 font-mono`}
          >
            {pairAddress}
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

    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });

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
    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });
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
    args: string[]
  ) => Promise<LogEntry | LogEntry[] | null> | LogEntry | LogEntry[] | null;

  const commands: Record<string, CommandHandler> = {
    clear: () => {
      setLogs([]);
      return null;
    },
    help: () => ({ id: generateId(), type: "help" }),
    networks: () => ({ id: generateId(), type: "networks" }),
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
    register: async (args) => {
      if (!activeChainId)
        return {
          id: generateId(),
          type: "text",
          text: "Select network first using 'network <name>'."
        };
      if (!args[1] || !isAddress(args[1]))
        return {
          id: generateId(),
          type: "text",
          text: "Usage: register <tokenAddress> [customSymbol]"
        };

      const targetChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId)!;
      const tokenAddress = args[1] as Address;
      const client = createPublicClient({
        chain: targetChain,
        transport: http()
      });

      let contractSymbol: string,
        contractDecimals: number,
        contractName: string;
      try {
        const [symRes, decRes, nameRes] = await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "symbol"
          }),
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "name"
          })
        ]);
        contractSymbol = String(symRes);
        contractDecimals = Number(decRes);
        contractName = String(nameRes);
      } catch {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Error: Address ${tokenAddress} is not a valid ERC20 token on ${targetChain.name} (failed to read contract methods).`
        };
      }

      const symbolToUse = (args[2] ? args[2] : contractSymbol).toUpperCase();

      const existingCommon = COMMON_TOKENS[targetChain.id]?.[symbolToUse];
      const existingCustom = customTokens[targetChain.id]?.[symbolToUse];
      const isNative =
        symbolToUse === targetChain.nativeCurrency.symbol.toUpperCase();

      if (existingCommon || existingCustom || isNative) {
        return {
          id: generateId(),
          type: "text",
          text: `[!] Error: Symbol "${symbolToUse}" already exists on ${targetChain.name}. Please register with a unique symbol (e.g., 'register ${tokenAddress} UNIQUE_SYMBOL').`
        };
      }

      const newToken = {
        address: tokenAddress,
        symbol: symbolToUse,
        name: contractName,
        decimals: contractDecimals,
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

      return {
        id: generateId(),
        type: "text",
        text: `[✓] Successfully registered token "${symbolToUse}" (${contractName}, ${contractDecimals} decimals) at ${tokenAddress} on ${targetChain.name}.`
      };
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

          const client = createPublicClient({
            chain: targetChain!,
            transport: http()
          });
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
                className={`text-[9px] ${theme.text}/40 truncate pt-1 border-t ${theme.border}`}
              >
                POOL ADDRESS: {pairAddress}
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

      const client = createPublicClient({
        chain: targetChain,
        transport: http()
      });
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

  // Assign Command Aliases
  commands.nets = commands.networks;
  commands.net = commands.network;
  commands.initpool = commands.initialize;
  commands.findpool = commands.getpool;
  commands.provideliq = commands.addliq;
  commands.bal = commands.balance;
  commands.liquidity = commands.pool;
  commands.reg = commands.register;

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

    // FIXED: Split by 1 or more whitespace characters and filter out empty strings
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
      const result = await handler(args);
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
        handleCommand(input);
        setInput("");
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
          className="flex-1 overflow-y-auto space-y-2.5 pt-2 pr-2"
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
