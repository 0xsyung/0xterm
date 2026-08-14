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

      <div
        className={`text-xs ${theme.text}/60 font-mono flex items-center gap-2`}
      >
        <span>THEME:</span>
        <span className={`font-bold uppercase ${theme.primary}`}>
          {theme.name}
        </span>
        <span className="opacity-50 text-[10px] hidden sm:inline">
          (type `theme &lt;name&gt;`)
        </span>
      </div>
    </div>
  );
}
