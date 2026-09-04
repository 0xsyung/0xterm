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
import { isCoarsePointer } from "@/components/terminal/viewport";
import type { ThemeMode } from "@/components/terminal/types";

function Splash() {
  return (
    <div className="w-full h-full bg-black text-[#00ff66] font-mono flex flex-col items-center justify-center gap-4">
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

// Software keyboard: when the visual viewport shrinks below the layout
// viewport, pin the shell's height to the visual viewport so the prompt
// rides above the keyboard instead of under it. Height only — a transform
// would create a containing block for the fixed rain overlay.
// Coarse-pointer gate: on desktop (devtools docked, browser chrome) the
// visual viewport can also be < innerHeight and would squash the shell for
// no benefit — only touch devices have a software keyboard.
function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (!isCoarsePointer()) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setHeight(vv.height < window.innerHeight ? vv.height : null);
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
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
  const vvHeight = useVisualViewportHeight();

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
        <main
          className="w-full h-dvh min-h-0 overflow-hidden relative"
          style={vvHeight ? { height: vvHeight } : undefined}
        >
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
