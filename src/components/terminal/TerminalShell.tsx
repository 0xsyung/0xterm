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

import SwapWidget from "./SwapWidget";
import TerminalHeader from "./TerminalHeader";
import HelpManual from "./widgets/HelpManual";
import CreatePoolWidget from "./widgets/CreatePoolWidget";
import InitializePoolWidget from "./widgets/InitializePoolWidget";
import AddLiquidityWidget from "./widgets/AddLiquidityWidget";
import BalanceWidget from "./widgets/BalanceWidget";
import NetworksList from "./widgets/NetworksList";
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

  const theme = THEMES[currentThemeKey];

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", type: "text", text: "0xTERM v1.4.9 [FULL ON-CHAIN DEFI SUITE]" },
    { id: "2", type: "text", text: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n' }
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Helper to save preferences for the active wallet ID
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

  // Load user settings upon wallet connection
  useEffect(() => {
    if (isConnected && address) {
      const storageKey = `0xterm_user_${address.toLowerCase()}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const prefs = JSON.parse(saved);
          const loadedDetails: string[] = [];

          if (prefs.theme && THEMES[prefs.theme]) {
            onThemeChange(prefs.theme);
            loadedDetails.push(`Theme: ${THEMES[prefs.theme].name}`);
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
            setLogs((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                type: "text",
                text: `[✓] Profile loaded for wallet ${address.slice(0, 6)}...${address.slice(-4)} (${loadedDetails.join(" | ")})`
              }
            ]);
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

    const preset = COMMON_TOKENS[chain.id]?.[sym];
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
    throw new Error(
      `Unable to resolve token "${queryToken}" on ${chain.name}.`
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
    if (!isAddress(poolAddress)) {
      return (
        <div className="text-red-400">
          Error: Provide a valid pool contract address (0x...).
        </div>
      );
    }

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

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userLog: LogEntry = {
      id: Date.now().toString(),
      type: "input",
      text: `$ ${trimmed}`
    };
    const args = trimmed.split(" ");
    const command = args[0].toLowerCase();

    let newEntry: LogEntry = userLog;

    switch (command) {
      case "clear":
        setLogs([]);
        return;

      case "help":
        setLogs((prev) => [
          ...prev,
          userLog,
          { id: (Date.now() + 1).toString(), type: "help" }
        ]);
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIdx(-1);
        return;
      case "networks":
      case "nets":
        setLogs((prev) => [
          ...prev,
          userLog,
          { id: (Date.now() + 1).toString(), type: "networks" }
        ]);
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIdx(-1);
        return;
      case "network":
      case "net":
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
              await switchChainAsync({ chainId: targetChain.id }).catch(
                () => {}
              );
            netText = `[✓] Network set to ${targetChain.name}`;
          }
        }
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: netText
        };
        break;

      case "dexes":
        if (!activeChainId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network first."
          };
        } else {
          setLogs((prev) => [
            ...prev,
            userLog,
            { id: (Date.now() + 1).toString(), type: "dexes" }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "dex":
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
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: dexText
        };
        break;

      case "createpool":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === activeDexId
          );
          if (!activeDex) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: 'Invalid active DEX for this network. Type "dexes" to see available DEXes and "dex <id>" to select one.'
            };
            break;
          }
          if (!args[1] || !args[2]) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: "Usage: createpool <tokenA> <tokenB> [fee]"
            };
          } else {
            try {
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

              setLogs((prev) => [
                ...prev,
                userLog,
                {
                  id: (Date.now() + 1).toString(),
                  type: "createpool",
                  payload: {
                    targetChain,
                    activeDex,
                    tokenA,
                    tokenB,
                    addrA,
                    addrB,
                    fee
                  }
                }
              ]);
              setHistory((prev) => [...prev, trimmed]);
              setHistoryIdx(-1);
              return;
            } catch (err: any) {
              newEntry = {
                id: (Date.now() + 1).toString(),
                type: "text",
                text: `ERROR: ${err.message}`
              };
            }
          }
        }
        break;

      case "initialize":
      case "initpool":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === activeDexId
          );
          if (!activeDex) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: 'Invalid active DEX for this network. Type "dexes" to choose a valid DEX.'
            };
            break;
          }
          if (activeDex.type !== "V3") {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: "Initialization is only applicable to Uniswap V3 pools."
            };
            break;
          }
          if (!args[1] || !args[2]) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: "Usage: initialize <tokenA> <tokenB> [fee]"
            };
          } else {
            try {
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

              setLogs((prev) => [
                ...prev,
                userLog,
                {
                  id: (Date.now() + 1).toString(),
                  type: "initialize",
                  payload: { targetChain, poolAddress, tokenA, tokenB }
                }
              ]);
              setHistory((prev) => [...prev, trimmed]);
              setHistoryIdx(-1);
              return;
            } catch (err: any) {
              newEntry = {
                id: (Date.now() + 1).toString(),
                type: "text",
                text: `ERROR: ${err.message}`
              };
            }
          }
        }
        break;

      case "getpool":
      case "findpool":
        if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === activeDexId
          );
          if (!activeDex) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: 'Invalid active DEX for this network. Type "dexes" to check available DEXes.'
            };
            break;
          }
          if (!args[1] || !args[2]) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: "Usage: getpool <tokenA> <tokenB> [fee]"
            };
          } else {
            try {
              const poolWidget = await fetchPoolAddress(
                args[1],
                args[2],
                targetChain,
                activeDex,
                args[3]
              );
              setLogs((prev) => [
                ...prev,
                userLog,
                {
                  id: (Date.now() + 1).toString(),
                  type: "component",
                  component: poolWidget
                }
              ]);
              setHistory((prev) => [...prev, trimmed]);
              setHistoryIdx(-1);
              return;
            } catch (err: any) {
              newEntry = {
                id: (Date.now() + 1).toString(),
                type: "text",
                text: `ERROR: ${err.message}`
              };
            }
          }
        }
        break;
      case "addliq":
      case "provideliq":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2] || !args[3] || !args[4]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: addliq <tokenA> <tokenB> <amtA> <amtB> [fee]"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
            const [tokenA, tokenB] = await Promise.all([
              resolveTokenDetails(args[1], targetChain),
              resolveTokenDetails(args[2], targetChain)
            ]);
            const amountAWei = parseUnits(args[3], tokenA.decimals);
            const amountBWei = parseUnits(args[4], tokenB.decimals);
            const fee = args[5] ? parseInt(args[5]) : 3000;

            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
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
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "swap":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2] || !args[3]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: swap <amount> <fromToken> <toToken>"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
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
                  abi: [
                    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable"
                  ],
                  functionName: "swapExactETHForTokens",
                  args: [0n, [addrIn, addrOut], address, deadline]
                });
                txValue = toHex(amountInWei);
              } else {
                txData = encodeFunctionData({
                  abi: [
                    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)"
                  ],
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
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "component",
                component: swapWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "balance":
      case "bal":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else {
          const targetChain =
            SUPPORTED_CHAINS.find((c) => c.id === activeChainId) ||
            SUPPORTED_CHAINS[5];
          try {
            const balData = await fetchTokenBalanceData(
              address,
              targetChain,
              args[1]
            );
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "balance",
                payload: balData
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "pool":
      case "liquidity":
        if (!activeChainId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network first."
          };
        } else if (!args[1]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: pool <poolAddress>"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const poolWidget = await fetchOnChainLiquidity(args[1], targetChain);
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "component",
              component: poolWidget
            }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "connect":
        if (isConnected) connect({ connector: connectors[0] });
        else
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Initiating handshake..."
          };
        break;

      case "disconnect":
        disconnect();
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: "Disconnected."
        };
        break;

      case "rain":
        onToggleRain();
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: "Rain toggled."
        };
        break;

      default:
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: `Command not recognized: "${command}". Type "help".`
        };
    }

    setLogs((prev) => [...prev, userLog, newEntry]);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
  };

  const activeChainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
  const activeDexObj = activeChainId
    ? DEX_REGISTRY[activeChainId]?.find((d) => d.id === activeDexId)
    : null;

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
          {logs.map((log) => {
            if (log.type === "input") {
              return (
                <div
                  key={log.id}
                  className={`${theme.primary} font-bold ${theme.glow}`}
                >
                  {log.text}
                </div>
              );
            }
            if (log.type === "help") {
              return <HelpManual key={log.id} theme={theme} />;
            }
            if (log.type === "dexes") {
              const dexList = DEX_REGISTRY[activeChainId!] || [];
              return (
                <div
                  key={log.id}
                  className={`text-xs space-y-1 my-2 ${theme.text}`}
                >
                  {dexList.map((d) => (
                    <div key={d.id}>
                      • {d.name} ({d.type}) - ID:{" "}
                      <span className={`font-bold ${theme.primary}`}>
                        {d.id}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            if (log.type === "networks") {
              return <NetworksList key={log.id} theme={theme} />;
            }
            if (log.type === "createpool") {
              return (
                <CreatePoolWidget key={log.id} {...log.payload} theme={theme} />
              );
            }
            if (log.type === "initialize") {
              return (
                <InitializePoolWidget
                  key={log.id}
                  {...log.payload}
                  theme={theme}
                />
              );
            }
            if (log.type === "addliq") {
              return (
                <AddLiquidityWidget
                  key={log.id}
                  {...log.payload}
                  theme={theme}
                />
              );
            }
            if (log.type === "balance") {
              return (
                <BalanceWidget key={log.id} {...log.payload} theme={theme} />
              );
            }
            return (
              <div key={log.id} className={`${theme.text}/90`}>
                {log.text}
                {log.component}
              </div>
            );
          })}
        </div>

        {/* TWO-LINE PROMPT LAYOUT */}
        <div
          className={`mt-4 border-t ${theme.border} pt-3 shrink-0 flex flex-col space-y-1.5`}
        >
          {/* Line 1: Status Bar (Network, DEX, Address) */}
          {mounted && (
            <div
              className={`text-[11px] ${theme.text}/70 flex items-center space-x-2 px-1`}
            >
              <span className={`font-bold ${theme.primary}`}>
                [{activeChainObj ? activeChainObj.name.toUpperCase() : "NO NET"}{" "}
                | {activeDexObj ? activeDexObj.id.toUpperCase() : "NO DEX"} |{" "}
                {isConnected && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "DISCONNECTED"}
                ]
              </span>
            </div>
          )}

          {/* Line 2: Prompt Indicator and Input */}
          <div className="flex items-center">
            <span
              className={`mr-2 font-bold ${theme.glow} shrink-0 whitespace-nowrap ${theme.primary}`}
            >
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full bg-transparent outline-none ${theme.text} caret-current ${theme.glow}`}
              autoFocus
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
