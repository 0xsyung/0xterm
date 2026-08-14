"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/wagmi";
import type { ThemeMode } from "@/components/terminal/types";

// Dynamically import TerminalShell with ssr: false so it only loads in the browser
const TerminalShell = dynamic(
  () => import("@/components/terminal/TerminalShell"),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-black text-[#00ff66] font-mono flex items-center justify-center">
        INITIALIZING 0xTERM...
      </div>
    )
  }
);

const queryClient = new QueryClient();

export default function Page() {
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeMode>("matrix");
  const [isRainActive, setIsRainActive] = useState(false);

  const toggleRain = () => setIsRainActive(!isRainActive);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <main className="w-screen h-screen overflow-hidden relative">
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
