/**
 * @file TerminalHeader.tsx
 * @description Terminal header component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
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
  return (
    <div
      className={`absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between border-b uppercase ${theme.border} ${theme.cardBg} backdrop-blur-md z-30`}
    >
      <div className="flex items-center">
        <img
          src="/logo.svg"
          alt="0xTERM"
          className="h-9 w-9"
          draggable={false}
        />
      </div>
    </div>
  );
}
