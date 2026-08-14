"use client";

import { useState } from "react";
import { THEMES } from "./constants";
import type { ThemeConfig, ThemeMode } from "./types";

export default function TerminalHeader({
  theme,
  currentThemeKey,
  onThemeChange
}: {
  theme: ThemeConfig;
  currentThemeKey: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  return (
    <div
      className={`absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between border-b ${theme.border} ${theme.cardBg} backdrop-blur-md z-30`}
    >
      <div className="flex items-center space-x-3">
        {theme.headerStyle === "mac" && (
          <div className="flex items-center space-x-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-inner"></div>
          </div>
        )}
        {theme.headerStyle === "bloomberg" && (
          <div className="px-2 py-0.5 bg-[#ffb000] text-black font-bold text-[10px] rounded-none">
            BBG
          </div>
        )}
        {theme.headerStyle === "whatsapp" && (
          <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] font-bold text-xs">
            WA
          </div>
        )}
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full bg-current animate-pulse ${theme.primary}`}
        ></span>
        <span className={`font-bold tracking-wider text-xs ${theme.primary}`}>
          0xTERM TERMINAL
        </span>
      </div>

      <div className="flex items-center space-x-3 relative">
        <div className="relative">
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            className={`px-3 py-1.5 text-xs font-bold border ${theme.border} bg-current/5 hover:bg-current/15 ${theme.rounded} transition-all flex items-center space-x-1.5 ${theme.primary}`}
          >
            <span>🎨 THEME: {theme.name.toUpperCase()}</span>
            <span className="text-[10px]">▼</span>
          </button>

          {themeMenuOpen && (
            <div
              className={`absolute right-0 mt-2 w-48 border ${theme.border} ${theme.cardBg} ${theme.rounded} shadow-2xl py-1 z-50 text-xs`}
            >
              {(Object.keys(THEMES) as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onThemeChange(mode);
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-current/10 flex items-center justify-between transition-colors ${currentThemeKey === mode ? `${theme.primary} font-bold` : `${theme.text}/80`}`}
                >
                  <span>{THEMES[mode].name}</span>
                  {currentThemeKey === mode && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
