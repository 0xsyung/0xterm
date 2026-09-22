/**
 * @file BindWidget.tsx
 * @description F1–F12 keymap list for the `bind` command — command strings
 * only, never JS (#28)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { FKEYS, resolveBinding, isDangerousBinding } from "../keybindings";
import type { BindingsState } from "../keybindings";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";

export default function BindWidget({
  data,
  theme,
  pinned,
  onPin
}: {
  data: BindingsState;
  theme: ThemeConfig;
  pinned?: boolean;
  onPin?: () => void;
}) {
  const rows = FKEYS.map((key) => {
    const r = resolveBinding(data, key);
    return { key, cmd: r.cmd, origin: r.origin };
  });

  return (
    <div className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-3 w-full`}>
      <div className="flex justify-between items-center border-b pb-1">
        <span className="font-bold">F-KEY BINDINGS</span>
        <span className={`uppercase shrink-0 ${theme.muted}`}>12 KEYS</span>
      </div>
      {!pinned && (
        <PinButton onPin={onPin} theme={theme} className="absolute top-2 right-2" />
      )}
      <div className="space-y-1">
        {rows.map(({ key, cmd, origin }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className={`font-bold shrink-0 ${theme.primary}`}>{key}</span>
            <span className={`truncate flex-1 text-right ${cmd ? (isDangerousBinding(cmd) ? theme.warn : theme.text) : theme.muted}`}>
              {cmd || "—"}
            </span>
            <span className={`uppercase text-[9px] shrink-0 ${theme.muted}`}>
              {origin}
            </span>
          </div>
        ))}
      </div>
      <div className={`text-[9px] ${theme.muted} leading-tight`}>
        Bind a key: <span className={theme.primary}>bind &lt;F1..F12&gt; &lt;command&gt;</span>. Commands are strings, never JS.
      </div>
    </div>
  );
}
