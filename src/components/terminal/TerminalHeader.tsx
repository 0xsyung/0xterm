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
      className={`absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between border-b ${theme.border} ${theme.cardBg} backdrop-blur-md z-30`}
    >
      <div className="flex items-center space-x-3">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full bg-current animate-pulse ${theme.primary}`}
        ></span>
        <span className={`font-bold tracking-wider text-xs ${theme.primary}`}>
          0xTERM
        </span>
      </div>

      <div className={`text-xs ${theme.text}/50 font-mono tracking-wide`}>
        Type <span className={`font-bold ${theme.primary}`}>help</span> to view
        commands
      </div>
    </div>
  );
}
