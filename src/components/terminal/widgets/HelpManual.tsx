/**
 * @file HelpManual.tsx
 * @description Help manual widget — filtered by terminal mode (#54)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { ThemeConfig } from "../types";
import {
  DEFAULT_MODE,
  helpRowsForMode,
  MODE_LABEL,
  type TerminalMode
} from "../mode";

export default function HelpManual({
  theme,
  mode = DEFAULT_MODE
}: {
  theme: ThemeConfig;
  mode?: TerminalMode;
}) {
  const rows = helpRowsForMode(mode);

  return (
    <div
      className={`relative group text-xs space-y-2 my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.text} w-full`}
    >
      <div
        className={`border-b ${theme.border} pb-1 font-bold ${theme.primary} tracking-wider`}
      >
        SYSTEM COMMAND MANUAL — {MODE_LABEL[mode]}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,max-content)_1fr] gap-x-6 gap-y-2 pt-1">
        <div
          className={`font-bold ${theme.primary} md:whitespace-nowrap break-words tracking-wider`}
        >
          COMMAND
        </div>
        <div className={`font-bold ${theme.primary} tracking-wider`}>
          DESCRIPTION
        </div>
        {rows.map((row) => (
          <HelpRowView
            key={row.command}
            command={row.command}
            description={row.description}
            theme={theme}
          />
        ))}
      </div>
      <div
        className={`border-t ${theme.border} pt-2 mt-1 text-[10px] opacity-60`}
      >
        © 2026 0xTERM. All rights reserved. Proprietary and confidential.
        Unauthorized copying or distribution is strictly prohibited.
        Contact: 0xsam@0xterm.xyz
      </div>
    </div>
  );
}

function HelpRowView({
  command,
  description,
  theme
}: {
  command: string;
  description: string;
  theme: ThemeConfig;
}) {
  // Social tab row embeds bold command names in the description.
  if (command === "Social tab") {
    return (
      <>
        <div
          className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}
        >
          {command}
        </div>
        <div>
          Header TERMINAL | SOCIAL switch — Inbox + Board live here (not
          pinnable). Unread badges poll ~60s. Commands{" "}
          <span className="font-bold">inbox</span> /{" "}
          <span className="font-bold">chat</span> /{" "}
          <span className="font-bold">board</span> /{" "}
          <span className="font-bold">channel*</span> still work from the prompt
          on either tab.
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}
      >
        {command}
      </div>
      <div>{description}</div>
    </>
  );
}
