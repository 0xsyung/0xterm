/**
 * @file VaultWidget.tsx
 * @description ERC-4626 vault show/list read surface — pinnable (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React from "react";
import { formatUnits, type Address, type Chain } from "viem";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";
import type { VaultShowData } from "../vault";

export type VaultListRow = {
  id: string;
  name: string;
  protocol: string;
  address: Address;
  assetSymbol: string;
};

type VaultWidgetProps = {
  mode: "show" | "list";
  chain: Chain;
  show?: VaultShowData;
  known?: boolean;
  entryName?: string;
  listRows?: VaultListRow[];
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
};

export default function VaultWidget({
  mode,
  chain,
  show,
  known,
  entryName,
  listRows,
  theme,
  onPin,
  pinned
}: VaultWidgetProps) {
  return (
    <div className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs w-full overflow-x-auto`}>
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}

      {mode === "list" && (
        <>
          <div className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}>
            <span className="font-bold">VAULT REGISTRY</span>
            <span className="uppercase">{chain.name}</span>
          </div>
          {(listRows || []).length === 0 ? (
            <div className={`pt-2 ${theme.muted}`}>
              No curated vaults on {chain.name}. Pass a 4626 address to &apos;vault show&apos;.
            </div>
          ) : (
            <table className={`w-full text-left ${theme.text} mt-2`}>
              <thead>
                <tr className={`text-[10px] ${theme.text}/50 border-b ${theme.border}`}>
                  <th className="py-1 pr-2">ID</th>
                  <th className="py-1 pr-2">NAME</th>
                  <th className="py-1 pr-2">PROTOCOL</th>
                  <th className="py-1 pr-2">ASSET</th>
                  <th className="py-1 pr-2 text-right">VAULT</th>
                </tr>
              </thead>
              <tbody>
                {(listRows || []).map((r) => (
                  <tr key={r.id}>
                    <td className={`py-1 pr-2 ${theme.primary}`}>{r.id}</td>
                    <td className="py-1 pr-2">{r.name}</td>
                    <td className={`py-1 pr-2 ${theme.text}/60`}>{r.protocol}</td>
                    <td className="py-1 pr-2">{r.assetSymbol}</td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {r.address.slice(0, 6)}…{r.address.slice(-4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={`pt-2 ${theme.muted}`}>
            Curated allow-list. Raw 4626 addresses work too (&apos;vault show &lt;addr&gt;&apos;).
          </div>
        </>
      )}

      {mode === "show" && show && (
        <>
          <div className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}>
            <span className={`font-bold ${theme.primary}`}>
              {show.vault.slice(0, 6)}…{show.vault.slice(-4)}
            </span>
            <span className="uppercase">{show.chainName}</span>
          </div>

          {show.asset === null && (
            <div className={`${theme.warn} pt-2`}>
              asset() reverted — not a usable ERC-4626 (VAULT_NOT_4626).
            </div>
          )}

          {show.asset && (
            <div className={`pt-2 ${theme.text} space-y-1`}>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>ASSET</span>
                <span className={`${theme.primary} tabular-nums`}>
                  {show.asset.symbol} ({show.asset.name})
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>TOTAL ASSETS</span>
                <span className={`tabular-nums`}>
                  {show.totalAssets !== null ? formatUnits(show.totalAssets, show.asset.decimals) : "—"} {show.asset.symbol}
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>TOTAL SUPPLY</span>
                <span className={`tabular-nums`}>
                  {show.totalSupply !== null ? formatUnits(show.totalSupply, 18) : "—"} shares
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>SHARE PRICE</span>
                <span className={`tabular-nums`}>
                  {show.sharePrice !== null ? formatUnits(show.sharePrice, show.asset.decimals) : "—"} {show.asset.symbol}
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>YOUR SHARES</span>
                <span className={`tabular-nums`}>
                  {show.balanceOf !== null ? formatUnits(show.balanceOf, 18) : "—"}
                  {show.balanceValue !== null
                    ? ` (≈${formatUnits(show.balanceValue, show.asset.decimals)} ${show.asset.symbol})`
                    : ""}
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>MAX DEPOSIT/MINT/WITHDRAW/REDEEM</span>
                <span className={`tabular-nums`}>
                  {show.maxDeposit !== null ? formatUnits(show.maxDeposit, show.asset.decimals) : "—"}/
                  {show.maxMint !== null ? formatUnits(show.maxMint, 18) : "—"}/
                  {show.maxWithdraw !== null ? formatUnits(show.maxWithdraw, show.asset.decimals) : "—"}/
                  {show.maxRedeem !== null ? formatUnits(show.maxRedeem, 18) : "—"}
                </span>
              </div>
              <div className={`flex justify-between`}>
                <span className={`${theme.text}/60`}>APY (ESTIMATE)</span>
                <span className={`tabular-nums`}>
                  {show.apyBps !== null ? `${(show.apyBps / 100).toFixed(2)}%` : "—"}
                </span>
              </div>
            </div>
          )}

          <div className={`pt-2 ${theme.muted} border-t ${theme.border} mt-2`}>
            {known
              ? `Known registry vault${entryName ? ` (${entryName})` : ""}. Preview = min-out; convertTo* ignores fees.`
              : "UNKNOWN ADDRESS — unaudited / malicious 4626 clones can steal deposits. Review the implementation before confirming."}
          </div>
          <div className={`${theme.muted} pt-1`}>
            Share-inflation: an empty/thinly-shared vault can round the next depositor to 0 shares. Run &apos;help vault&apos;.
          </div>
        </>
      )}
    </div>
  );
}
