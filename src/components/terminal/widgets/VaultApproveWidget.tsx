/**
 * @file VaultApproveWidget.tsx
 * @description ERC-4626 vault exact-allowance approve/revoke widget (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState } from "react";
import { useSendTransaction, usePublicClient } from "wagmi";
import { encodeFunctionData, formatUnits, parseAbi, type Address, type Chain } from "viem";
import type { ThemeConfig } from "../types";

const erc20ApproveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)"
]);

type VaultAsset = { address: Address; symbol: string; name: string; decimals: number };

type VaultApproveWidgetProps = {
  theme: ThemeConfig;
  targetChain: Chain;
  vault: Address;
  vaultName: string;
  asset: VaultAsset;
  amountWei: bigint;
  isRevoke: boolean;
};

export default function VaultApproveWidget({
  theme,
  targetChain,
  vault,
  vaultName,
  asset,
  amountWei,
  isRevoke
}: VaultApproveWidgetProps) {
  const [status, setStatus] = useState<"idle" | "approving" | "waiting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId: targetChain.id });
  const { sendTransactionAsync } = useSendTransaction();

  const handleApprove = async () => {
    setStatus("approving");
    setErrorMsg(null);
    try {
      const data = encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [vault, amountWei]
      });
      const hash = await sendTransactionAsync({
        chainId: targetChain.id,
        to: asset.address,
        data,
        value: BigInt(0)
      });
      setTxHash(hash);
      setStatus("waiting");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setStatus("error");
          setErrorMsg("Approval transaction reverted on-chain.");
          return;
        }
      }
      setStatus("success");
    } catch (err: unknown) {
      setStatus("idle");
      setErrorMsg(err instanceof Error ? err.message : "Approval rejected or failed.");
    }
  };

  const blockExplorer = targetChain.blockExplorers?.default.url;

  return (
    <div className={`my-2 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} w-full text-xs space-y-3`}>
      <div className={`flex justify-between items-center border-b ${theme.border} pb-2`}>
        <span className={`font-bold ${theme.primary}`}>
          VAULT {isRevoke ? "REVOKE" : "APPROVE"} — {vaultName.toUpperCase()}
        </span>
        <span className={theme.muted}>{targetChain.name.toUpperCase()}</span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text} font-mono`}>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>TOKEN</div>
          <div className={`text-base font-bold ${theme.primary} tabular-nums`}>
            {asset.symbol}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>{isRevoke ? "AMOUNT" : "ALLOWANCE TO VAULT"}</div>
          <div className={`text-base font-bold ${theme.primary} tabular-nums`}>
            {isRevoke ? "0 (revoke)" : `${formatUnits(amountWei, asset.decimals)} ${asset.symbol}`}
          </div>
        </div>
      </div>

      <div className={`text-[11px] ${theme.muted} border-t ${theme.border} pt-2`}>
        {isRevoke
          ? `Revoking allowance of ${asset.symbol} to ${vault.slice(0, 6)}…${vault.slice(-4)}. Never infinite approve.`
          : `Exact allowance of ${asset.symbol} to vault ${vault.slice(0, 6)}…${vault.slice(-4)}. Revoke anytime with 'vault approve ${vault.slice(0, 6)}…${vault.slice(-4)} 0'.`}
      </div>

      {errorMsg && (
        <div className={`p-2 border rounded ${theme.warn}`}>ERROR: {errorMsg}</div>
      )}

      {status === "success" && txHash && (
        <div className={`p-2 border ${theme.border} ${theme.cardBg} ${theme.primary} ${theme.rounded} space-y-1`}>
          <div className="font-bold">[✓] {isRevoke ? "REVOKE" : "APPROVAL"} CONFIRMED ON-CHAIN!</div>
          <div className="text-[10px] truncate">TX HASH: {txHash}</div>
          {blockExplorer && (
            <a
              href={`${blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className={`text-[10px] underline hover:opacity-80 block pt-0.5 ${theme.primary}`}
            >
              View on {targetChain.name} Explorer ↗
            </a>
          )}
        </div>
      )}

      <div className="pt-2 flex gap-2">
        {status === "approving" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>SIGN {isRevoke ? "REVOKE" : "APPROVAL"} IN WALLET...</div>
        )}
        {status === "waiting" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>WAITING FOR CONFIRMATION...</div>
        )}
        {status !== "approving" && status !== "waiting" && status !== "success" && (
          <button
            onClick={handleApprove}
            className={`px-4 py-1.5 border ${theme.border} bg-current/30 hover:bg-current/50 ${theme.primary} font-bold ${theme.rounded} cursor-pointer ${theme.glow} transition-all`}
          >
            [ {isRevoke ? "REVOKE" : `APPROVE ${asset.symbol}`} ]
          </button>
        )}
      </div>
    </div>
  );
}
