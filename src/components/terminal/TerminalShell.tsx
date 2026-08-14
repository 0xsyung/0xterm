"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import {
  formatEther,
  formatUnits,
  parseUnits,
  isAddress,
  parseAbi,
  createPublicClient,
  http,
  encodeFunctionData,
  toHex,
  type Address,
  type Chain
} from "viem";
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia
} from "viem/chains";
import SwapWidget from "./SwapWidget";

type LogItem = {
  id: string;
  type: "input" | "text" | "component";
  content: React.ReactNode;
};

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const SUPPORTED_CHAINS: Chain[] = [
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia
];
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

// MockUSDC
// 0x80E382C4457b46bC8C924C330e3a697713A9AE46

// MockDAI
// 0x3e702A0Aa3c379C473A65Fc39113581A1C794DBF

// MockDEX
// 0x17cBab9967cA141a44346233951c1d574f23B0c0

const MOCK_DEX_ADDRESS: Address = "0x17cBab9967cA141a44346233951c1d574f23B0c0";

const mockDexAbi = parseAbi([
  "function swap(address tokenIn, address tokenOut, uint256 amountIn) returns (uint256)",
  "function swapETHForToken(address tokenOut) payable returns (uint256)"
]);

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
]);

const COMMON_TOKENS: Record<
  number,
  Record<
    string,
    { address: Address; decimals: number; symbol: string; name: string }
  >
> = {
  1: {
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Ethereum"
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin"
    },
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      symbol: "USDT",
      name: "Tether USD"
    },
    WBTC: {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      symbol: "WBTC",
      name: "Wrapped BTC"
    }
  },
  42161: {
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Ethereum"
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin"
    },
    ARB: {
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      decimals: 18,
      symbol: "ARB",
      name: "Arbitrum"
    }
  },
  8453: {
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Ethereum"
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin"
    },
    AERO: {
      address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
      decimals: 18,
      symbol: "AERO",
      name: "Aerodrome"
    }
  },
  11155111: {
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Sepolia Ethereum"
    }
  }
};

const resolveChain = (query?: string): Chain | undefined => {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  return SUPPORTED_CHAINS.find(
    (c) =>
      c.id.toString() === q ||
      c.name.toLowerCase() === q ||
      c.nativeCurrency.symbol.toLowerCase() === q ||
      (q === "mainnet" && c.id === 1) ||
      (q === "arb" && c.id === 42161)
  );
};

// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------
export default function TerminalShell({
  onToggleRain
}: {
  onToggleRain: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: "1",
      type: "text",
      content: "0xTERM v1.0.0 [MATRIX CONSTRUCT LOADED]"
    },
    {
      id: "2",
      type: "text",
      content: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n'
    }
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

  const resolveTokenDetails = async (queryToken: string, chain: Chain) => {
    const sym = queryToken.toUpperCase();
    const isNative =
      sym === chain.nativeCurrency.symbol ||
      sym === "ETH" ||
      queryToken === NATIVE_TOKEN_ADDRESS;

    if (isNative) {
      return {
        address: NATIVE_TOKEN_ADDRESS as Address,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: 18,
        isNative: true
      };
    }

    const preset = COMMON_TOKENS[chain.id]?.[sym];
    if (preset) {
      return { ...preset, isNative: preset.address === NATIVE_TOKEN_ADDRESS };
    }

    const client = createPublicClient({ chain, transport: http() });

    if (isAddress(queryToken)) {
      const addr = queryToken as Address;
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
    }

    // DexScreener Fallback
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
    }

    throw new Error(
      `Unable to resolve token "${queryToken}" on ${chain.name}.`
    );
  };

  const fetchPrice = async (symbol: string) => {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${symbol}`
      );
      const data = await res.json();
      const pair = data.pairs?.[0];

      if (!pair) {
        return (
          <div className="text-red-400">
            Error: Token "{symbol}" not found on DEX aggregators.
          </div>
        );
      }

      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
          <div className="flex justify-between text-xs text-[#00ff66]/70">
            <span>
              {pair.baseToken.name} ({pair.baseToken.symbol})
            </span>
            <span>
              {pair.dexId.toUpperCase()} • {pair.chainId.toUpperCase()}
            </span>
          </div>
          <div className="text-2xl font-bold my-1 text-[#00ff66]">
            ${parseFloat(pair.priceUsd).toLocaleString()}
            <span
              className={`text-xs ml-2 ${pair.priceChange?.h24 >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              ({pair.priceChange?.h24}% 24h)
            </span>
          </div>
        </div>
      );
    } catch {
      return <div className="text-red-400">Failed to fetch ticker data.</div>;
    }
  };

  const fetchTokenBalance = async (
    userAddress: Address,
    targetChain: Chain,
    queryToken?: string
  ) => {
    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });

    if (!queryToken) {
      const rawBalance = await client.getBalance({ address: userAddress });
      const formatted = parseFloat(formatEther(rawBalance)).toLocaleString(
        undefined,
        { maximumFractionDigits: 4 }
      );
      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow text-xs">
          <div className="flex justify-between items-center text-[#00ff66]/70 mb-1">
            <span>NATIVE BALANCE</span>
            <span>
              {targetChain.name.toUpperCase()} (ID: {targetChain.id})
            </span>
          </div>
          <div className="text-2xl font-bold my-1 text-[#00ff66]">
            {formatted}{" "}
            <span className="text-sm font-normal text-[#00ff66]/80">
              {targetChain.nativeCurrency.symbol}
            </span>
          </div>
        </div>
      );
    }

    const token = await resolveTokenDetails(queryToken, targetChain);

    if (token.isNative) {
      const rawBalance = await client.getBalance({ address: userAddress });
      const formatted = parseFloat(formatEther(rawBalance)).toLocaleString(
        undefined,
        { maximumFractionDigits: 4 }
      );
      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow text-xs">
          <div className="flex justify-between items-center text-[#00ff66]/70 mb-1">
            <span>NATIVE BALANCE</span>
            <span>{targetChain.name.toUpperCase()}</span>
          </div>
          <div className="text-2xl font-bold my-1 text-[#00ff66]">
            {formatted}{" "}
            <span className="text-sm font-normal text-[#00ff66]/80">
              {token.symbol}
            </span>
          </div>
        </div>
      );
    }

    const rawBal = await client.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    });

    const formattedBal = parseFloat(
      formatUnits(rawBal as bigint, token.decimals)
    ).toLocaleString(undefined, { maximumFractionDigits: 4 });

    return (
      <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow text-xs">
        <div className="flex justify-between items-center text-[#00ff66]/70 mb-1">
          <span>{token.name.toUpperCase()}</span>
          <span>
            {targetChain.name.toUpperCase()} (ID: {targetChain.id})
          </span>
        </div>
        <div className="text-2xl font-bold my-1 text-[#00ff66]">
          {formattedBal}{" "}
          <span className="text-sm font-normal text-[#00ff66]/80">
            {token.symbol}
          </span>
        </div>
        <div className="text-[#00ff66]/50 truncate mt-2 border-t border-[#00ff66]/10 pt-2 flex flex-col gap-0.5">
          <div>CONTRACT: {token.address}</div>
        </div>
      </div>
    );
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userLog: LogItem = {
      id: Date.now().toString(),
      type: "input",
      content: `$ ${trimmed}`
    };
    const args = trimmed.split(" ");
    const command = args[0].toLowerCase();

    let outputContent: React.ReactNode;

    switch (command) {
      case "clear":
        setLogs([]);
        return;

      case "help":
        outputContent = (
          <div className="text-xs space-y-2 my-2 text-[#00ff66]/90 max-w-2xl">
            <div className="border-b border-[#00ff66]/20 pb-1 font-bold text-[#00ff66] tracking-wider">
              SYSTEM COMMAND MANUAL
            </div>
            <div className="grid grid-cols-[220px_1fr] gap-x-4 gap-y-2 pt-1">
              <div className="font-bold text-[#00ff66]">
                network &lt;name|id&gt;
              </div>
              <div>Switch active network session (or "net 0" to clear)</div>

              <div className="font-bold text-[#00ff66]">connect</div>
              <div>Authenticate Web3 wallet</div>

              <div className="font-bold text-[#00ff66]">disconnect</div>
              <div>Disconnect wallet</div>

              <div className="font-bold text-[#00ff66]">
                balance [token] [net]
              </div>
              <div>Query token balances</div>

              <div className="font-bold text-[#00ff66]">
                swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
              </div>
              <div>Route and execute DEX token swaps</div>

              <div className="font-bold text-[#00ff66]">
                price &lt;symbol&gt;
              </div>
              <div>Query DEX pair prices</div>

              <div className="font-bold text-[#00ff66]">rain</div>
              <div>Toggle background digital rain</div>

              <div className="font-bold text-[#00ff66]">clear</div>
              <div>Flush terminal buffer log</div>
            </div>
          </div>
        );
        break;

      case "network":
      case "net":
      case "chain":
        if (!args[1]) {
          const currentChainObj = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          );
          outputContent = (
            <div className="my-2 p-3 border border-[#00ff66]/30 bg-[#001105]/80 rounded max-w-md text-xs">
              <div className="font-bold text-[#00ff66] mb-2">
                ACTIVE NETWORK:{" "}
                {currentChainObj
                  ? `${currentChainObj.name.toUpperCase()} (ID: ${currentChainObj.id})`
                  : "NONE SELECTED"}
              </div>
              <div className="text-[#00ff66]/70 mb-1 font-bold">
                SUPPORTED NETWORKS:
              </div>
              <div className="grid grid-cols-2 gap-1 text-[#00ff66]/60">
                {SUPPORTED_CHAINS.map((c) => (
                  <div key={c.id}>
                    • {c.name}{" "}
                    <span className="text-[10px] text-[#00ff66]/40">
                      (ID: {c.id})
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[#00ff66]/40 mt-2 text-[11px]">
                Usage: network &lt;name|id&gt; • Type "net 0" to clear network
              </div>
            </div>
          );
        } else if (args[1] === "0") {
          setActiveChainId(null);
          outputContent = (
            <div className="text-yellow-400 my-1 font-bold">
              [✓] NETWORK CLEARED.
            </div>
          );
        } else {
          const targetChain = resolveChain(args[1]);
          if (!targetChain) {
            outputContent = (
              <div className="text-red-400">
                Error: Network "{args[1]}" not recognized.
              </div>
            );
          } else {
            setActiveChainId(targetChain.id);
            let notice = "";
            if (isConnected) {
              try {
                await switchChainAsync({ chainId: targetChain.id });
                notice = " WALLET SYNCED.";
              } catch {
                notice = " (WALLET SWITCH PENDING/REJECTED).";
              }
            }
            outputContent = (
              <div className="text-emerald-400 my-1 font-bold">
                [✓] NETWORK SET TO: {targetChain.name.toUpperCase()}.{notice}
              </div>
            );
          }
        }
        break;

      case "connect":
        if (isConnected) {
          outputContent = `WALLET CONNECTED: ${address}`;
        } else {
          const injectedConn = connectors[0];
          if (injectedConn) {
            connect({ connector: injectedConn });
            outputContent = "INITIATING WALLET HANDSHAKE...";
          } else {
            outputContent = "NO WALLET DETECTED.";
          }
        }
        break;

      case "disconnect":
        disconnect();
        outputContent = "SESSION TERMINATED.";
        break;

      case "swap":
        if (!isConnected || !address) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] WALLET NOT CONNECTED.
            </div>
          );
        } else if (!activeChainId) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] NO NETWORK SELECTED.
            </div>
          );
        } else {
          const amountInput = args[1];
          const fromQuery = args[2];
          const toQuery = args[3];
          const slippageStr = args[4] || "0.5%";

          if (
            !amountInput ||
            !fromQuery ||
            !toQuery ||
            isNaN(parseFloat(amountInput))
          ) {
            outputContent =
              "Usage: swap <amount> <fromToken> <toToken> [slippage]";
          } else {
            const targetChain = SUPPORTED_CHAINS.find(
              (c) => c.id === activeChainId
            )!;
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "text",
                content: `FETCHING SWAP ROUTE ON ${targetChain.name.toUpperCase()}...`
              }
            ]);

            try {
              const [fromToken, toToken] = await Promise.all([
                resolveTokenDetails(fromQuery, targetChain),
                resolveTokenDetails(toQuery, targetChain)
              ]);

              // PREVENT SENDING TO DEX ITSELF
              if (
                toToken.address.toLowerCase() === MOCK_DEX_ADDRESS.toLowerCase()
              ) {
                throw new Error(
                  "Target token cannot be the MockDEX address itself. Ensure you deploy two ERC-20 tokens."
                );
              }

              const amountInWei = parseUnits(amountInput, fromToken.decimals);

              let txTo: Address;
              let txData: `0x${string}`;
              let txValue: `0x${string}` = "0x0";
              let approvalAddress: Address | undefined = undefined;
              let toAmountFormatted = amountInput;
              let estimatedGasUsd = "0.01";

              if (
                targetChain.id === sepolia.id ||
                targetChain.id === 11155111
              ) {
                // SEPOLIA TESTNET ROUTING
                txTo = MOCK_DEX_ADDRESS;
                if (fromToken.isNative) {
                  txData = encodeFunctionData({
                    abi: mockDexAbi,
                    functionName: "swapETHForToken",
                    args: [toToken.address]
                  });
                  txValue = toHex(amountInWei);
                } else {
                  txData = encodeFunctionData({
                    abi: mockDexAbi,
                    functionName: "swap",
                    args: [fromToken.address, toToken.address, amountInWei]
                  });
                  approvalAddress = MOCK_DEX_ADDRESS;
                }
              } else {
                // MAINNET LI.FI ROUTING
                const slippageDecimal =
                  parseFloat(slippageStr.replace("%", "")) / 100 || 0.005;
                const url = `https://li.quest/v1/quote?fromChain=${targetChain.id}&toChain=${targetChain.id}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${amountInWei.toString()}&fromAddress=${address}&slippage=${slippageDecimal}`;
                const res = await fetch(url);
                const quote = await res.json();

                if (!res.ok || !quote.transactionRequest) {
                  throw new Error(quote.message || "No swap route found.");
                }

                txTo = quote.transactionRequest.to as Address;
                txData = quote.transactionRequest.data;
                txValue = quote.transactionRequest.value || "0x0";
                approvalAddress = quote.estimate.approvalAddress as
                  | Address
                  | undefined;
                toAmountFormatted = parseFloat(
                  formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)
                ).toLocaleString(undefined, { maximumFractionDigits: 6 });
                estimatedGasUsd =
                  quote.estimate.feeCosts?.[0]?.amountUSD || "0.05";
              }

              const swapWidget = (
                <SwapWidget
                  userAddress={address}
                  targetChain={targetChain}
                  fromToken={fromToken}
                  toToken={toToken}
                  fromAmountFormatted={amountInput}
                  toAmountFormatted={toAmountFormatted}
                  amountInWei={amountInWei}
                  transactionRequest={{
                    to: txTo,
                    data: txData,
                    value: txValue
                  }}
                  approvalAddress={approvalAddress}
                  estimatedGasUsd={estimatedGasUsd}
                />
              );

              setLogs((prev) => [
                ...prev.slice(0, -1),
                {
                  id: Date.now().toString(),
                  type: "component",
                  content: swapWidget
                }
              ]);
              setHistory((prev) => [...prev, trimmed]);
              setHistoryIdx(-1);
              return;
            } catch (err: any) {
              setLogs((prev) => [
                ...prev.slice(0, -1),
                {
                  id: Date.now().toString(),
                  type: "text",
                  content: `ERROR: ${err.message}`
                }
              ]);
              return;
            }
          }
        }
        break;

      case "balance":
      case "bal":
        if (!isConnected || !address) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] WALLET NOT CONNECTED.
            </div>
          );
        } else {
          let targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          );
          let queryToken: string | undefined = undefined;

          const arg1Chain = resolveChain(args[1]);
          const arg2Chain = resolveChain(args[2]);

          if (arg2Chain) {
            targetChain = arg2Chain;
            queryToken = args[1];
          } else if (arg1Chain) {
            targetChain = arg1Chain;
            queryToken = args[2];
          } else {
            queryToken = args[1];
          }

          if (!targetChain) {
            outputContent = (
              <div className="text-yellow-400/90 my-1">
                [!] NO NETWORK SELECTED.
              </div>
            );
            break;
          }

          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: `QUERYING BALANCE ON ${targetChain.name.toUpperCase()}...`
            }
          ]);

          try {
            const balanceWidget = await fetchTokenBalance(
              address,
              targetChain,
              queryToken
            );
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: balanceWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "text",
                content: `ERROR: ${err.message}`
              }
            ]);
            return;
          }
        }
        break;

      case "price":
        if (!args[1]) {
          outputContent = "Usage: price <symbol>";
        } else {
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "FETCHING METRICS..."
            }
          ]);
          const priceWidget = await fetchPrice(args[1]);
          setLogs((prev) => [
            ...prev.slice(0, -1),
            {
              id: Date.now().toString(),
              type: "component",
              content: priceWidget
            }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "rain":
        onToggleRain();
        outputContent = "BACKGROUND RAIN TOGGLED.";
        break;

      default:
        outputContent = `Command not recognized: "${command}". Type "help".`;
    }

    setLogs((prev) => [
      ...prev,
      userLog,
      { id: (Date.now() + 1).toString(), type: "text", content: outputContent }
    ]);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx < history.length) {
        setHistoryIdx(nextIdx);
        setInput(history[history.length - 1 - nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[history.length - 1 - nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInput("");
      }
    }
  };

  const activeChainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);

  return (
    <div
      className="relative z-10 w-full h-full p-6 pt-10 flex flex-col cursor-text overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pt-2 pr-2"
      >
        {logs.map((log) => (
          <div
            key={log.id}
            className={
              log.type === "input"
                ? "text-[#00ff66] font-bold matrix-glow"
                : "text-[#00ff66]/90"
            }
          >
            {log.content}
          </div>
        ))}
      </div>

      <div className="flex items-center mt-4 text-[#00ff66] border-t border-[#00ff66]/20 pt-3 shrink-0">
        <span className="mr-2 font-bold matrix-glow shrink-0 whitespace-nowrap">
          {mounted && isConnected
            ? `[${activeChainObj ? activeChainObj.name.toUpperCase() : "NO NET"} | ${address?.slice(0, 6)}...] >`
            : `${activeChainObj ? `[${activeChainObj.name.toUpperCase()}] ` : ""}>`}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-[#00ff66] caret-[#00ff66] matrix-glow"
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
