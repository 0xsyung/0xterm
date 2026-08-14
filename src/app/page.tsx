"use client";

import { useState } from "react";
import { Providers } from "./providers";
import MatrixRain from "@/components/terminal/MatrixRain";
import TerminalShell from "@/components/terminal/TerminalShell";

type ThemeMode = "matrix" | "mac" | "bloomberg" | "whatsapp";

export default function Home() {
  const [rainActive, setRainActive] = useState(true);
  const [currentThemeKey, setCurrentThemeKey] = useState<ThemeMode>("matrix");

  const handleToggleRain = () => {
    setRainActive((prev) => !prev);
  };

  // Determine main container background and scanline overlay based on theme
  const getThemeMainClasses = (theme: ThemeMode) => {
    switch (theme) {
      case "matrix":
        return "crt-overlay bg-black";
      case "mac":
        return "bg-[#1e1e1e]";
      case "bloomberg":
        return "bg-[#0c0c0c]";
      case "whatsapp":
        return "bg-[#0b141a]";
      default:
        return "bg-black";
    }
  };

  return (
    <Providers>
      <main
        className={`fixed inset-0 overflow-hidden flex flex-col transition-colors duration-300 ${getThemeMainClasses(currentThemeKey)}`}
      >
        {/* Matrix rain only renders on Matrix theme */}
        {currentThemeKey === "matrix" && <MatrixRain active={rainActive} />}

        <TerminalShell
          onToggleRain={handleToggleRain}
          currentThemeKey={currentThemeKey}
          onThemeChange={setCurrentThemeKey}
        />
      </main>
    </Providers>
  );
}
