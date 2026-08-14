"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

type LogItem = {
  id: string;
  type: "input" | "text" | "component";
  content: React.ReactNode;
};

export default function TerminalShell({
  onToggleRain
}: {
  onToggleRain: () => void;
}) {
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

  // Scroll to bottom without triggering browser flexbox layout shifts
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
          {isConnected ? `[${address?.slice(0, 6)}...] >` : ">"}
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
