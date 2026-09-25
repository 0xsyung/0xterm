/**
 * @file VaultDepositWidget.tsx
 * @description ERC-4626 vault deposit/withdraw/mint/redeem confirm widget (#21)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState, useEffect } from "react";
import { usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { encodeFunctionData, formatUnits, parseAbi, type Address, type Chain } from "viem";
import type { ThemeConfig } from "../types";

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
]);
const erc4626Abi = parseAbi([
  "function asset() view returns (address)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewMint(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function mint(uint256 shares, address receiver) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)"
]);

type VaultAsset = { address: Address; symbol: string; name: string; decimals: number };

type VaultDepositWidgetProps = {
  theme: ThemeConfig;
  targetChain: Chain;
  userAddress: Address;
  vault: Address;
  vaultName: string;
  verb: "deposit" | "mint" | "withdraw" | "redeem";
  asset: VaultAsset;
  amountWei: bigint;
  amountHuman: string;
  previewWei: bigint; // the verb-matching preview shown at build time
  known?: boolean; // false for raw addresses not in VAULT_REGISTRY (#21)
  maxDriftBps?: number; // abort if re-sim preview drifts past this (default 50)
};

const VERB_LABEL: Record<string, string> = {
  deposit: "DEPOSIT",
  mint: "MINT",
  withdraw: "WITHDRAW",
  redeem: "REDEEM"
};

export default function VaultDepositWidget({
  theme,
  targetChain,
  userAddress,
  vault,
  vaultName,
  verb,
  asset,
  amountWei,
  amountHuman,
  previewWei,
  known = true,
  maxDriftBps = 50
}: VaultDepositWidgetProps) {
  const [status, setStatus] = useState<
    "checking_approval" | "needs_approval" | "approving" | "waiting_approval_confirmation" | "ready" | "executing" | "waiting_execution_confirmation" | "success" | "error"
  >("checking_approval");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId: targetChain.id });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const spendsAsset = verb === "deposit" || verb === "mint";

  // Deposit/mint need approval of asset() to the vault. Withdraw/redeem burn
  // shares from msg.sender — no approval.
  useEffect(() => {
    async function checkAllowance() {
      if (!spendsAsset || !publicClient) {
        setStatus("ready");
        return;
      }
      try {
        const allowance = (await publicClient.readContract({
          address: asset.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress, vault]
        })) as bigint;
        setStatus(allowance >= amountWei ? "ready" : "needs_approval");
      } catch {
        setStatus("ready");
      }
    }
    checkAllowance();
  }, [spendsAsset, asset, vault, userAddress, amountWei, publicClient]);

  const handleApprove = async () => {
    setStatus("approving");
    setErrorMsg(null);
    try {
      const hash = await writeContractAsync({
        chainId: targetChain.id,
        address: asset.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [vault, amountWei]
      });
      setStatus("waiting_approval_confirmation");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setStatus("error");
          setErrorMsg("Approval transaction reverted on-chain.");
          return;
        }
      }
      setStatus("ready");
    } catch (err: unknown) {
      setStatus("needs_approval");
      setErrorMsg(err instanceof Error ? err.message : "Approval rejected or failed.");
    }
  };

  const handleExecute = async () => {
    setStatus("executing");
    setErrorMsg(null);
    const fnName =
      verb === "deposit" ? "deposit" : verb === "mint" ? "mint" : verb === "withdraw" ? "withdraw" : "redeem";
    const fnArgs =
      verb === "deposit"
        ? [amountWei, userAddress]
        : verb === "mint"
          ? [amountWei, userAddress]
          : verb === "withdraw"
            ? [amountWei, userAddress, userAddress]
            : [amountWei, userAddress, userAddress];

    // Re-sim immediately before send (issue #21): abort if the verb-matching
    // preview drifted more than maxDriftBps from what the widget showed.
    if (publicClient) {
      try {
        const fresh = (await publicClient.readContract({
          address: vault,
          abi: erc4626Abi,
          functionName: `preview${verb[0].toUpperCase()}${verb.slice(1)}` as
            | "previewDeposit"
            | "previewMint"
            | "previewWithdraw"
            | "previewRedeem",
          args: [amountWei]
        })) as bigint;
        const diff = fresh > previewWei ? fresh - previewWei : previewWei - fresh;
        const driftBps = diff > 0n ? Number((diff * 10000n) / (previewWei || 1n)) : 0;
        if (driftBps > maxDriftBps) {
          setStatus("ready");
          setErrorMsg(`Preview drifted ${driftBps} bps (>${maxDriftBps}). Aborted before send. Re-run 'vault show'.`);
          return;
        }
      } catch {
        // preview read failed — fail closed, do not send blind
        setStatus("ready");
        setErrorMsg("Could not re-sim preview before send. Aborted. Re-run 'vault show'.");
        return;
      }
    }

    try {
      const data = encodeFunctionData({
        abi: erc4626Abi,
        functionName: fnName as "deposit",
        args: fnArgs as [bigint, Address]
      });
      const hash = await sendTransactionAsync({
        chainId: targetChain.id,
        to: vault,
        data,
        value: BigInt(0)
      });
      setTxHash(hash);
      setStatus("waiting_execution_confirmation");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setStatus("error");
          setErrorMsg(`${VERB_LABEL[verb]} transaction reverted on-chain.`);
          return;
        }
      }
      setStatus("success");
    } catch (err: unknown) {
      setStatus("ready");
      setErrorMsg(err instanceof Error ? err.message : `${VERB_LABEL[verb]} transaction rejected or failed.`);
    }
  };

  const blockExplorer = targetChain.blockExplorers?.default.url;
  const youPayUnit = spendsAsset ? asset.symbol : "SHARES";
  const youGetUnit = spendsAsset ? "SHARES" : asset.symbol;

  return (
    <div className={`my-2 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} w-full text-xs space-y-3`}>
      <div className={`flex justify-between items-center border-b ${theme.border} pb-2`}>
        <span className={`font-bold ${theme.primary}`}>VAULT {VERB_LABEL[verb]} — {vaultName.toUpperCase()}</span>
        <span className={theme.muted}>{targetChain.name.toUpperCase()}</span>
      </div>

      {!known && (
        <div className={`p-2 border rounded ${theme.warn}`}>
          Not in VAULT_REGISTRY. Unaudited / malicious 4626 clones can steal
          deposits. Review the implementation before confirming.
        </div>
      )}

      <div className={`grid grid-cols-2 gap-2 ${theme.text} font-mono`}>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>{verb === "withdraw" || verb === "redeem" ? "YOU GET" : "YOU PAY"}</div>
          <div className={`text-base font-bold ${theme.primary} tabular-nums`}>
            {amountHuman} {youPayUnit}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>{verb === "withdraw" || verb === "redeem" ? "SHARES BURNED" : "EXPECTED OUTPUT"}</div>
          <div className={`text-base font-bold ${theme.primary} tabular-nums`}>
            ≈ {formatUnits(previewWei, verb === "withdraw" || verb === "redeem" ? asset.decimals : 18)} {youGetUnit}
          </div>
        </div>
      </div>

      <div className={`text-[11px] ${theme.muted} border-t ${theme.border} pt-2 flex justify-between`}>
        <span>PREVIEW = MIN-OUT</span>
        <span className={theme.primary}>NO SLIPPAGE PARAM (EIP-4626)</span>
      </div>

      {errorMsg && (
        <div className={`p-2 border rounded ${theme.warn}`}>ERROR: {errorMsg}</div>
      )}

      {status === "success" && txHash && (
        <div className={`p-2 border ${theme.border} ${theme.cardBg} ${theme.primary} ${theme.rounded} space-y-1`}>
          <div className="font-bold">[✓] {VERB_LABEL[verb]} CONFIRMED ON-CHAIN!</div>
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
        {status === "checking_approval" && (
          <div className={`${theme.warn} animate-pulse`}>VERIFYING ALLOWANCE...</div>
        )}
        {status === "needs_approval" && (
          <button
            onClick={handleApprove}
            className={`px-3 py-1.5 border ${theme.border} bg-current/20 hover:bg-current/30 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all`}
          >
            [ STEP 1/2: APPROVE {asset.symbol} ]
          </button>
        )}
        {status === "approving" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>APPROVING {asset.symbol} IN WALLET...</div>
        )}
        {status === "waiting_approval_confirmation" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>WAITING FOR APPROVAL CONFIRMATION...</div>
        )}
        {status === "ready" && (
          <button
            onClick={handleExecute}
            className={`px-4 py-1.5 border ${theme.border} bg-current/30 hover:bg-current/50 ${theme.primary} font-bold ${theme.rounded} cursor-pointer ${theme.glow} transition-all`}
          >
            [ {verb === "deposit" || verb === "mint" ? "DEPOSIT" : "REDEEM"}{verb === "mint" || verb === "redeem" ? " EXACT " : " "}CONFIRM ]
          </button>
        )}
        {status === "executing" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>SIGN {VERB_LABEL[verb]} IN WALLET...</div>
        )}
        {status === "waiting_execution_confirmation" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>WAITING FOR {VERB_LABEL[verb]} CONFIRMATION...</div>
        )}
      </div>
    </div>
  );
}
