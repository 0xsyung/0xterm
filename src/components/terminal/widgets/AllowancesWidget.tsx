/**
 * @file AllowancesWidget.tsx
 * @description allowances audit table — pinnable (#109)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";
import type { AllowanceAuditResult } from "../allowances";

export default function AllowancesWidget({
  audit,
  theme,
  onPin,
  pinned
}: {
  audit: AllowanceAuditResult;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
}) {
  if (audit.kind === "no_spenders") {
    return (
      <div className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs w-full`}>
        <div className={`${theme.text}/80`}>
          No known spenders on {audit.chainName}.
        </div>
      </div>
    );
  }

  const filterNote = audit.filter ? ` (filter: ${audit.filter})` : "";

  return (
    <div className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs w-full overflow-x-auto`}>
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
      <div className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}>
        <span className="font-bold">ALLOWANCES</span>
        <span className="uppercase">
          {audit.chainName}
          {filterNote}
        </span>
      </div>
      {audit.kind === "none" ? (
        <div className={`pt-2 ${theme.muted}`}>
          No positive allowances on {audit.chainName}
          {filterNote}.
        </div>
      ) : (
        <>
          <table className={`w-full text-left ${theme.text} mt-2`}>
            <thead>
              <tr className={`text-[10px] ${theme.text}/50 border-b ${theme.border}`}>
                <th className="py-1 pr-2">TOKEN</th>
                <th className="py-1 pr-2">SPENDER</th>
                <th className="py-1 pr-2">PROTOCOL</th>
                <th className="py-1 pr-2 text-right">ALLOWANCE</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((r, i) => (
                <tr key={`${r.tokenAddress}-${r.spenderAddress}-${i}`}>
                  <td className={`py-1 pr-2 ${theme.primary}`}>{r.tokenSymbol}</td>
                  <td className="py-1 pr-2 break-words">
                    {r.spenderLabel}{" "}
                    <span className={`${theme.text}/40 font-mono`}>
                      {r.spenderAddress.slice(0, 6)}…{r.spenderAddress.slice(-4)}
                    </span>
                  </td>
                  <td className={`py-1 pr-2 ${theme.text}/60`}>{r.protocol}</td>
                  <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">
                    {r.formatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={`pt-2 ${theme.muted}`}>
            {audit.rows.length} positive approval
            {audit.rows.length === 1 ? "" : "s"}. Run{" "}
            <span className={theme.primary}>allowances revoke</span> to revoke
            all.
          </div>
        </>
      )}
      {audit.failed > 0 && (
        <div className={`${theme.warn} pt-1`}>
          {audit.failed} read(s) failed and were skipped.
        </div>
      )}
    </div>
  );
}
