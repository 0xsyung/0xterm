"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAINS = [
  "Ethereum",
  "Base",
  "Arbitrum",
  "Optimism",
  "Polygon",
  "+ Sepolia testnets"
];

const FEATURES = [
  {
    title: "Wallet-native terminal",
    desc: "Portfolio, balances, and P/L from a command line. No dashboard — just queries."
  },
  {
    title: "On-chain tokens",
    desc: "Register, probe, and track any ERC-20 across supported chains."
  },
  {
    title: "Swap & deploy",
    desc: "Execute swaps and deploy contracts without leaving the terminal."
  },
  {
    title: "Portfolio snapshots",
    desc: "Snapshot your holdings and compare P/L over time."
  }
];

const COMMANDS = [
  { cmd: "portfolio", desc: "list holdings across all chains" },
  { cmd: "balance eth", desc: "read an on-chain balance" },
  { cmd: "snapshot", desc: "save a P/L baseline" },
  { cmd: "pnl", desc: "compare against a snapshot" },
  { cmd: "is 0x…", desc: "probe a token contract" },
  { cmd: "swap", desc: "swap tokens on-chain" }
];

function Scramble({ text }: { text: string }) {
  const glyphs = "ABCDEF0123456789#%&*+=-";
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let frame = 0;
    const total = 24;
    const interval = window.setInterval(() => {
      frame++;
      if (frame >= total) {
        setDisplay(text);
        window.clearInterval(interval);
        return;
      }
      setDisplay(
        text
          .split("")
          .map((ch, i) =>
            ch === " " || ch === "—"
              ? ch
              : frame + i < total
                ? glyphs[Math.floor(Math.random() * glyphs.length)]
                : text[i]
          )
          .join("")
      );
    }, 40);
    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <span
      style={{ textShadow: "0 0 8px rgba(0,255,102,0.6), 0 0 20px rgba(0,255,102,0.2)" }}
    >
      {display}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-[#00ff66] font-mono relative">
      {/* phosphor grid backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(0,255,102,0.12) 1px, transparent 1px)",
          backgroundSize: "16px 16px"
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />

      <div className="relative z-10 h-full overflow-y-auto">
        {/* nav */}
        <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xTERM" className="h-6 w-6" draggable={false} />
            <span className="font-bold tracking-widest">0XTERM</span>
          </div>
          <Link
            href="/app"
            className="border border-[#00ff66]/50 px-4 py-2 text-sm hover:bg-[#00ff66]/10 hover:border-[#00ff66] transition-colors"
          >
            Launch Terminal →
          </Link>
        </header>

        {/* hero */}
        <section className="px-6 max-w-6xl mx-auto w-full pt-16 pb-12">
          <p className="text-xs tracking-[0.3em] opacity-70 mb-4">
            WEB3 TERMINAL INTERFACE
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            <Scramble text="YOUR PORTFOLIO," />
            <br />
            <Scramble text="FROM THE COMMAND LINE." />
          </h1>
          <p className="max-w-xl opacity-80 leading-relaxed mb-8">
            0xterm is a Matrix-style Web3 terminal. Connect a wallet, then type
            your way across chains — portfolio, balances, swaps, and contract
            probes, all in a keyboard-first interface.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/app"
              className="bg-[#00ff66] text-black font-bold px-6 py-3 hover:bg-[#00ff66]/90 transition-colors"
            >
              [ Launch Terminal ]
            </Link>
            <a
              href="#commands"
              className="border border-[#00ff66]/50 px-6 py-3 hover:bg-[#00ff66]/10 transition-colors"
            >
              Commands
            </a>
          </div>
        </section>

        {/* features */}
        <section className="px-6 max-w-6xl mx-auto w-full py-12 border-t border-[#00ff66]/20">
          <h2 className="text-sm tracking-[0.3em] opacity-70 mb-8">FEATURES</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="border border-[#00ff66]/20 p-6">
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="opacity-70 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* chains */}
        <section className="px-6 max-w-6xl mx-auto w-full py-12 border-t border-[#00ff66]/20">
          <h2 className="text-sm tracking-[0.3em] opacity-70 mb-4">CHAINS</h2>
          <div className="flex flex-wrap gap-3">
            {CHAINS.map((c) => (
              <span
                key={c}
                className="border border-[#00ff66]/30 px-3 py-1 text-sm"
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* commands */}
        <section
          id="commands"
          className="px-6 max-w-6xl mx-auto w-full py-12 border-t border-[#00ff66]/20"
        >
          <h2 className="text-sm tracking-[0.3em] opacity-70 mb-8">TRY IT</h2>
          <div className="border border-[#00ff66]/30">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#00ff66]/30 text-xs opacity-60">
              <span className="w-2 h-2 rounded-full bg-[#00ff66]/40" />
              <span>0xterm — type a command</span>
            </div>
            <div className="p-4 space-y-2">
              {COMMANDS.map((c) => (
                <div key={c.cmd} className="flex items-baseline gap-4 text-sm">
                  <span className="text-black bg-[#00ff66] px-2 font-bold whitespace-nowrap">
                    {c.cmd}
                  </span>
                  <span className="opacity-70">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="px-6 max-w-6xl mx-auto w-full py-8 border-t border-[#00ff66]/20 text-xs opacity-50 flex flex-wrap justify-between gap-2">
          <span>© 2026 0XTERM</span>
          <span>TERMINAL AT /APP</span>
        </footer>
      </div>
    </div>
  );
}
