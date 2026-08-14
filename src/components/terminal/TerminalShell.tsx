"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import {
  formatEther,
  formatUnits,
  isAddress,
  parseAbi,
  type Address
} from "viem";

type LogItem = {
  id: string;
  type: "input" | "text" | "component";
  content: React.ReactNode;
};

// Standard ERC-20 minimal ABI for reading token state
const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
]);

// Preset token registry for high-frequency assets
const COMMON_TOKENS: Record<
  number,
  Record<
    string,
    { address: Address; decimals: number; symbol: string; name: string }
  >
> = {
  1: {
    // Mainnet
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
    },
    UNI: {
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      decimals: 18,
      symbol: "UNI",
      name: "Uniswap"
    },
    LINK: {
      address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      decimals: 18,
      symbol: "LINK",
      name: "ChainLink"
    }
  },
  42161: {
    // Arbitrum
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
    WBTC: {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      decimals: 8,
      symbol: "WBTC",
      name: "Wrapped BTC"
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
  }
};

export default function TerminalShell({
  onToggleRain
}: {
  onToggleRain: () => void;
}) {
  const [mounted, setMounted] = useState(false);
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
  const publicClient = usePublicClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

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
    queryToken?: string
  ) => {
    if (!publicClient) throw new Error("Client unavailable");

    const chainId = publicClient.chain.id;
    const chainName = publicClient.chain.name || "Ethereum";

    // 1. Fetch Native Token (ETH) Balance if no token specified
    if (!queryToken) {
      const rawBalance = await publicClient.getBalance({
        address: userAddress
      });
      const formatted = parseFloat(formatEther(rawBalance)).toLocaleString(
        undefined,
        { maximumFractionDigits: 4 }
      );
      const symbol = publicClient.chain?.nativeCurrency?.symbol || "ETH";

      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
          <div className="flex justify-between items-center text-xs text-[#00ff66]/70 mb-1">
            <span>NATIVE ACCOUNT BALANCE</span>
            <span>{chainName.toUpperCase()}</span>
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

    let tokenAddress: Address | null = null;
    let tokenDecimals = 18;
    let tokenSymbol = queryToken.toUpperCase();
    let tokenName = "ERC-20 Token";

    // 2. Case A: Direct Contract Address (0x...)
    if (isAddress(queryToken)) {
      tokenAddress = queryToken as Address;
      try {
        const [rawDec, sym, name] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "symbol"
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "name"
          })
        ]);
        tokenDecimals = Number(rawDec);
        tokenSymbol = String(sym);
        tokenName = String(name);
      } catch {
        return (
          <div className="text-red-400">
            Error: Target address {queryToken} is not a valid ERC-20 contract on{" "}
            {chainName}.
          </div>
        );
      }
    } else {
      // 3. Case B: Preset registry lookup
      const preset = COMMON_TOKENS[chainId]?.[tokenSymbol];
      if (preset) {
        tokenAddress = preset.address;
        tokenDecimals = preset.decimals;
        tokenSymbol = preset.symbol;
        tokenName = preset.name;
      } else {
        // Fallback: DexScreener search
        try {
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${queryToken}`
          );
          const data = await res.json();
          const pair = data.pairs?.find(
            (p: { chainId: string }) =>
              p.chainId.toLowerCase() ===
                publicClient.chain.name.toLowerCase() ||
              p.chainId === "ethereum"
          );

          if (pair?.baseToken?.address && isAddress(pair.baseToken.address)) {
            tokenAddress = pair.baseToken.address as Address;
            tokenSymbol = pair.baseToken.symbol;
            tokenName = pair.baseToken.name;
            tokenDecimals = Number(
              await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "decimals"
              })
            );
          }
        } catch {
          // Pass-through
        }
      }
    }

    if (!tokenAddress) {
      return (
        <div className="text-red-400">
          Error: Could not resolve token "{queryToken}" on {chainName}. Try
          passing the contract address directly.
        </div>
      );
    }

    // 4. Query ERC-20 balanceOf
    const rawBal = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    });

    const formattedBal = parseFloat(
      formatUnits(rawBal as bigint, tokenDecimals)
    ).toLocaleString(undefined, { maximumFractionDigits: 4 });

    return (
      <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow">
        <div className="flex justify-between items-center text-xs text-[#00ff66]/70 mb-1">
          <span>{tokenName.toUpperCase()}</span>
          <span>{chainName.toUpperCase()}</span>
        </div>
        <div className="text-2xl font-bold my-1 text-[#00ff66]">
          {formattedBal}{" "}
          <span className="text-sm font-normal text-[#00ff66]/80">
            {tokenSymbol}
          </span>
        </div>
        <div className="text-xs text-[#00ff66]/50 truncate mt-2 border-t border-[#00ff66]/10 pt-2 flex flex-col gap-0.5">
          <div>CONTRACT: {tokenAddress}</div>
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
          <div className="text-xs space-y-1 my-1 text-[#00ff66]/90">
            <div>
              <span className="font-bold">connect</span> - Authenticate Web3
              wallet
            </div>
            <div>
              <span className="font-bold">disconnect</span> - Disconnect current
              wallet session
            </div>
            <div>
              <span className="font-bold">balance [symbol|address]</span> (or{" "}
              <span className="font-bold">bal</span>) - Query ETH or ERC-20
              token balance (e.g. bal, bal USDC, bal 0xa0b8...)
            </div>
            <div>
              <span className="font-bold">price &lt;symbol&gt;</span> - Query
              DEX pair prices (e.g., price ETH, price PEPE)
            </div>
            <div>
              <span className="font-bold">rain</span> - Toggle background
              digital rain canvas
            </div>
            <div>
              <span className="font-bold">clear</span> - Flush terminal buffer
            </div>
          </div>
        );
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

      case "balance":
      case "bal":
        if (!isConnected || !address) {
          outputContent = (
            <div className="text-yellow-400/90 my-1">
              [!] WALLET NOT CONNECTED. PLEASE TYPE{" "}
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
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "QUERYING ON-CHAIN BALANCE..."
            }
          ]);

          try {
            const tokenQuery = args[1];
            const balanceWidget = await fetchTokenBalance(address, tokenQuery);
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
          } catch {
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "text",
                content: "ERROR: FAILED TO FETCH BALANCE FROM RPC."
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
        <span className="mr-2 font-bold matrix-glow">
          {mounted && isConnected ? `[${address?.slice(0, 6)}...] >` : ">"}
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
