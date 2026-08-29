/**
 * @file page.tsx
 * @description Home page entry
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/wagmi";
import type { ThemeMode } from "@/components/terminal/types";

function Splash() {
  return (
    <div className="w-screen h-screen bg-black text-[#00ff66] font-mono flex flex-col items-center justify-center gap-4">
      <img
        src="/logo.svg"
        alt="0xTERM"
        className="h-14 w-14"
        draggable={false}
      />
      <div>INITIALIZING 0xTERM</div>
    </div>
  );
}

const TerminalShell = dynamic(
  () => import("@/components/terminal/TerminalShell"),
  { ssr: false }
);

const queryClient = new QueryClient();

export default function Page() {
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeMode>("matrix");
  const [isRainActive, setIsRainActive] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [minHoldDone, setMinHoldDone] = useState(false);

  useEffect(() => {
    const hold = window.setTimeout(() => setMinHoldDone(true), 1000);
    import("@/components/terminal/TerminalShell").then(() => {
      setShellReady(true);
    });
    return () => window.clearTimeout(hold);
  }, []);

  const toggleRain = () => setIsRainActive(!isRainActive);
  const showSplash = !(shellReady && minHoldDone);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <main className="w-screen h-screen overflow-hidden relative">
          {showSplash && (
            <div className="absolute inset-0 z-50">
              <Splash />
            </div>
          )}
          <TerminalShell
            onToggleRain={toggleRain}
            currentThemeKey={currentThemeKey}
            onThemeChange={setCurrentThemeKey}
          />
        </main>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
