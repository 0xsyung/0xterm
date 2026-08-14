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

// Supported chains registry
const SUPPORTED_CHAINS: Chain[] = [
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia
];

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

// Standard ERC-20 ABI
const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
]);

// Preset tokens across supported chains
const COMMON_TOKENS: Record<
  number,
  Record<
    string,
    { address: Address; decimals: number; symbol: string; name: string }
  >
> = {
  1: {
    // Ethereum Mainnet
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
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
      symbol: "DAI",
      name: "Dai Stablecoin"
    }
  },
  42161: {
    // Arbitrum One
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
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      symbol: "USDT",
      name: "Tether USD"
    },
    ARB: {
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      decimals: 18,
      symbol: "ARB",
      name: "Arbitrum"
    }
  },
  8453: {
    // Base
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
  137: {
    // Polygon
    MATIC: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "MATIC",
      name: "Polygon"
    },
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin"
    },
    USDT: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58d90",
      decimals: 6,
      symbol: "USDT",
      name: "Tether USD"
    }
  },
  10: {
    // Optimism
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Ethereum"
    },
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097F853",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin"
    },
    OP: {
      address: "0x4200000000000000000000000000000000000042",
      decimals: 18,
      symbol: "OP",
      name: "Optimism"
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
      (q === "ethereum" && c.id === 1) ||
      (q === "arb" && c.id === 42161) ||
      (q === "matic" && c.id === 137) ||
      (q === "op" && c.id === 10)
  );
};

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
          <div className="text-xs text-[#00ff66]/60 flex flex-col gap-1 mt-2 border-t border-[#00ff66]/10 pt-2">
            <div>
              24h Vol: ${parseFloat(pair.volume?.h24 || 0).toLocaleString()}
            </div>
            <div>
              Liquidity: $
              {parseFloat(pair.liquidity?.usd || 0).toLocaleString()}
            </div>
          </div>
        </div>
      );
    } catch {
      return (
        <div className="text-red-400">
          Failed to fetch ticker data. Check network connection.
        </div>
      );
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
    const chainId = targetChain.id;
    const chainName = targetChain.name;

    if (!queryToken) {
      const rawBalance = await client.getBalance({ address: userAddress });
      const formatted = parseFloat(formatEther(rawBalance)).toLocaleString(
        undefined,
        { maximumFractionDigits: 4 }
      );
      const symbol = targetChain.nativeCurrency.symbol;

      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
          <div className="flex justify-between items-center text-xs text-[#00ff66]/70 mb-1">
            <span>NATIVE BALANCE</span>
            <span>
              {chainName.toUpperCase()} (ID: {chainId})
            </span>
          </div>
          <div className="text-2xl font-bold my-1 text-[#00ff66]">
            {formatted}{" "}
            <span className="text-sm font-normal text-[#00ff66]/80">
              {symbol}
            </span>
          </div>
          <div className="text-xs text-[#00ff66]/50 truncate mt-2 border-t border-[#00ff66]/10 pt-2">
            HOLDER: {userAddress}
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
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
          <div className="flex justify-between items-center text-xs text-[#00ff66]/70 mb-1">
            <span>NATIVE BALANCE</span>
            <span>{chainName.toUpperCase()}</span>
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
      <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
        <div className="flex justify-between items-center text-xs text-[#00ff66]/70 mb-1">
          <span>{token.name.toUpperCase()}</span>
          <span>
            {chainName.toUpperCase()} (ID: {chainId})
          </span>
        </div>
        <div className="text-2xl font-bold my-1 text-[#00ff66]">
          {formattedBal}{" "}
          <span className="text-sm font-normal text-[#00ff66]/80">
            {token.symbol}
          </span>
        </div>
        <div className="text-xs text-[#00ff66]/50 truncate mt-2 border-t border-[#00ff66]/10 pt-2 flex flex-col gap-0.5">
          <div>CONTRACT: {token.address}</div>
          <div>HOLDER: {userAddress}</div>
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
              <div>Authenticate Web3 wallet session</div>

              <div className="font-bold text-[#00ff66]">disconnect</div>
              <div>Disconnect active wallet session</div>

              <div className="font-bold text-[#00ff66]">
                balance [token] [net]
              </div>
              <div>Query native or ERC-20 token balance</div>

              <div className="font-bold text-[#00ff66]">
                swap &lt;amt&gt; &lt;from&gt; &lt;to&gt; [slip]
              </div>
              <div>
                Route and execute DEX token swaps
                <div className="text-[#00ff66]/50 text-[11px]">
                  E.g.:{" "}
                  <span className="text-[#00ff66]/80">swap 0.1 ETH USDC</span>,{" "}
                  <span className="text-[#00ff66]/80">
                    swap 100 USDC ETH 0.5%
                  </span>
                </div>
              </div>

              <div className="font-bold text-[#00ff66]">
                price &lt;symbol&gt;
              </div>
              <div>Query DEX pair prices &amp; market metrics</div>

              <div className="font-bold text-[#00ff66]">rain</div>
              <div>Toggle background Matrix digital rain animation</div>

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
                selection
              </div>
            </div>
          );
        } else if (args[1] === "0") {
          setActiveChainId(null);
          outputContent = (
            <div className="text-yellow-400 my-1 font-bold">
              [✓] ACTIVE NETWORK DESELECTED. NO NETWORK ACTIVE.
            </div>
          );
        } else {
          const targetChain = resolveChain(args[1]);
          if (!targetChain) {
            outputContent = (
              <div className="text-red-400">
                Error: Network "{args[1]}" not recognized. Type "network" to
                list supported chains.
              </div>
            );
          } else {
            setActiveChainId(targetChain.id);
            let walletSwitchNotice = "";

            if (isConnected) {
              try {
                await switchChainAsync({ chainId: targetChain.id });
                walletSwitchNotice = " WALLET CHAIN SYNCED.";
              } catch {
                walletSwitchNotice = " (WALLET SWITCH PENDING/REJECTED).";
              }
            }

            outputContent = (
              <div className="text-emerald-400 my-1 font-bold">
                [✓] ACTIVE NETWORK SET TO: {targetChain.name.toUpperCase()}{" "}
                (CHAIN ID: {targetChain.id}).{walletSwitchNotice}
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
            outputContent =
              "NO INJECTED WALLET DETECTED (INSTALL METAMASK / RABBY).";
          }
        }
        break;

      case "disconnect":
        disconnect();
        outputContent = "SESSION TERMINATED. WALLET DISCONNECTED.";
        break;

      case "swap":
        if (!isConnected || !address) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] WALLET NOT CONNECTED. TYPE{" "}
              <span
                className="font-bold underline cursor-pointer"
                onClick={() => handleCommand("connect")}
              >
                connect
              </span>{" "}
              TO AUTHENTICATE.
            </div>
          );
        } else if (!activeChainId) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] NO NETWORK SELECTED. SELECT ONE USING{" "}
              <span
                className="font-bold underline cursor-pointer"
                onClick={() => handleCommand("network")}
              >
                network &lt;name|id&gt;
              </span>{" "}
              BEFORE SWAPPING.
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
              "Usage: swap <amount> <fromToken> <toToken> [slippage] (e.g., swap 0.1 ETH USDC 0.5%)";
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
                content: `FETCHING DEX SWAP ROUTE ON ${targetChain.name.toUpperCase()}...`
              }
            ]);

            try {
              const [fromToken, toToken] = await Promise.all([
                resolveTokenDetails(fromQuery, targetChain),
                resolveTokenDetails(toQuery, targetChain)
              ]);

              const amountInWei = parseUnits(amountInput, fromToken.decimals);
              const slippageDecimal =
                parseFloat(slippageStr.replace("%", "")) / 100 || 0.005;

              // Fetch route quote via Li.Fi Aggregator API
              const url = `https://li.quest/v1/quote?fromChain=${targetChain.id}&toChain=${targetChain.id}&fromToken=${fromToken.address}&toToken=${toToken.address}&fromAmount=${amountInWei.toString()}&fromAddress=${address}&slippage=${slippageDecimal}`;
              const res = await fetch(url);
              const quote = await res.json();

              if (!res.ok || !quote.transactionRequest) {
                throw new Error(
                  quote.message ||
                    "No swap route found for selected pair/liquidity."
                );
              }

              const toAmountFormatted = parseFloat(
                formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)
              ).toLocaleString(undefined, { maximumFractionDigits: 6 });
              const estimatedGasUsd =
                quote.estimate.feeCosts?.[0]?.amountUSD || "0.05";

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
                    to: quote.transactionRequest.to as Address,
                    data: quote.transactionRequest.data,
                    value: quote.transactionRequest.value || "0x0"
                  }}
                  approvalAddress={
                    quote.estimate.approvalAddress as Address | undefined
                  }
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
                  content: `ERROR: ${err.message || "Failed to fetch swap route."}`
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
              [!] WALLET NOT CONNECTED. TYPE{" "}
              <span
                className="font-bold underline cursor-pointer"
                onClick={() => handleCommand("connect")}
              >
                connect
              </span>{" "}
              TO AUTHENTICATE.
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
                [!] NO NETWORK SELECTED. SELECT ONE USING{" "}
                <span
                  className="font-bold underline cursor-pointer"
                  onClick={() => handleCommand("network")}
                >
                  network &lt;name|id&gt;
                </span>{" "}
                OR SPECIFY ONE IN QUERY.
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
                content: `ERROR: ${err.message || "FAILED TO FETCH BALANCE."}`
              }
            ]);
            return;
          }
        }
        break;

      case "price":
        if (!args[1]) {
          outputContent = "Usage: price <symbol> (e.g. price ETH)";
        } else {
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "FETCHING ON-CHAIN METRICS..."
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
        outputContent = "BACKGROUND DIGITAL RAIN TOGGLED.";
        break;

      default:
        outputContent = `Command not recognized: "${command}". Type "help" for instructions.`;
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

      <div className="mt-4 flex items-center whitespace-nowrap border-t border-[#00ff66]/20 pt-3 text-[#00ff66] shrink-0">
        <span className="mr-2 shrink-0 font-bold matrix-glow">
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
          className="min-w-0 flex-1 bg-transparent outline-none text-[#00ff66] caret-[#00ff66] matrix-glow"
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
