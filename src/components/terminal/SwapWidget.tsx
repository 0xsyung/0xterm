/**
 * @file SwapWidget.tsx
 * @description Swap widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState, useEffect } from "react";
import { useSendTransaction, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseAbi, type Address, type Chain } from "viem";
import type { ThemeConfig } from "./types";

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
]);

type SwapWidgetProps = {
  userAddress: Address;
  targetChain: Chain;
  fromToken: {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
    isNative: boolean;
  };
  toToken: { address: Address; symbol: string; name: string; decimals: number };
  fromAmountFormatted: string;
  toAmountFormatted: string;
  amountInWei: bigint;
  amountOutMin?: bigint;
  slippagePct?: number;
  transactionRequest: {
    to: Address;
    data: `0x${string}`;
    value: `0x${string}`;
    gasLimit?: `0x${string}`;
  };
  approvalAddress?: Address;
  estimatedGasUsd?: string;
  theme: ThemeConfig;
};

export default function SwapWidget({
  userAddress,
  targetChain,
  fromToken,
  toToken,
  fromAmountFormatted,
  toAmountFormatted,
  amountInWei,
  amountOutMin = 0n,
  slippagePct = 0.5,
  transactionRequest,
  approvalAddress,
  estimatedGasUsd,
  theme
}: SwapWidgetProps) {
  const [status, setStatus] = useState<
    | "idle"
    | "checking_approval"
    | "needs_approval"
    | "approving"
    | "waiting_approval_confirmation"
    | "ready"
    | "swapping"
    | "waiting_swap_confirmation"
    | "success"
    | "error"
  >("checking_approval");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId: targetChain.id });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // Check token allowance if input is an ERC-20 token
  useEffect(() => {
    async function checkAllowance() {
      if (fromToken.isNative || !approvalAddress || !publicClient) {
        setStatus("ready");
        return;
      }

      try {
        const allowance = await publicClient.readContract({
          address: fromToken.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress, approvalAddress]
        });

        if ((allowance as bigint) >= amountInWei) {
          setStatus("ready");
        } else {
          setStatus("needs_approval");
        }
      } catch {
        // Fallback to ready if read fails
        setStatus("ready");
      }
    }

    checkAllowance();
  }, [fromToken, approvalAddress, userAddress, amountInWei, publicClient]);

  const handleApprove = async () => {
    if (!approvalAddress) return;
    setStatus("approving");
    setErrorMsg(null);

    try {
      const hash = await writeContractAsync({
        chainId: targetChain.id,
        address: fromToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [approvalAddress, amountInWei]
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
      setErrorMsg(getErrorMessage(err, "Approval rejected or failed."));
    }
  };

  const handleExecuteSwap = async () => {
    setStatus("swapping");
    setErrorMsg(null);

    try {
      const hash = await sendTransactionAsync({
        chainId: targetChain.id,
        to: transactionRequest.to,
        data: transactionRequest.data,
        value: BigInt(transactionRequest.value || "0x0")
      });

      setTxHash(hash);
      setStatus("waiting_swap_confirmation");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setStatus("error");
          setErrorMsg(
            "Swap transaction reverted on-chain. Check slippage or pool liquidity."
          );
          return;
        }
      }
      setStatus("success");
    } catch (err: unknown) {
      setStatus("ready");
      setErrorMsg(getErrorMessage(err, "Swap transaction rejected or failed."));
    }
  };

  const blockExplorer = targetChain.blockExplorers?.default.url;

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) {
      return err.message;
    }

    if (
      typeof err === "object" &&
      err !== null &&
      "shortMessage" in err &&
      typeof (err as { shortMessage?: unknown }).shortMessage === "string"
    ) {
      return (err as { shortMessage: string }).shortMessage;
    }

    return fallback;
  };

  return (
    <div className={`my-2 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} max-w-lg text-xs space-y-3`}>
      <div className={`flex justify-between items-center border-b ${theme.border} pb-2`}>
        <span className={`font-bold ${theme.primary}`}>
          DEX SWAP ROUTE [AGGREGATED]
        </span>
        <span className={theme.muted}>
          {targetChain.name.toUpperCase()}
        </span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text} font-mono`}>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>YOU PAY</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {fromAmountFormatted} {fromToken.symbol}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.muted}`}>EXPECTED OUTPUT</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            ≈ {toAmountFormatted} {toToken.symbol}
          </div>
        </div>
      </div>

      {estimatedGasUsd && (
        <div className={`text-[11px] ${theme.muted} border-t ${theme.border} pt-2 flex justify-between`}>
          <span>ESTIMATED NETWORK FEE:</span>
          <span className={`font-bold ${theme.primary}`}>${estimatedGasUsd}</span>
        </div>
      )}

      <div className={`text-[11px] ${theme.muted} border-t ${theme.border} pt-2 flex justify-between`}>
        <span>SLIPPAGE TOLERANCE:</span>
        <span className={`font-bold ${theme.primary}`}>
          {slippagePct}%
          {amountOutMin > 0n && (
            <span className="ml-2 opacity-70">
              (MIN OUT: {formatUnits(amountOutMin, toToken.decimals)} {toToken.symbol})
            </span>
          )}
        </span>
      </div>

      {errorMsg && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {status === "success" && txHash && (
        <div className={`p-2 border ${theme.border} ${theme.cardBg} ${theme.primary} ${theme.rounded} space-y-1`}>
          <div className="font-bold">
            [✓] SWAP CONFIRMED ON-CHAIN SUCCESSFULLY!
          </div>
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
          <div className={`${theme.warn} animate-pulse`}>
            VERIFYING TOKEN ALLOWANCE...
          </div>
        )}

        {status === "needs_approval" && (
          <button
            onClick={handleApprove}
            className={`px-3 py-1.5 border ${theme.border} bg-current/20 hover:bg-current/30 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all`}
          >
            [ STEP 1/2: APPROVE {fromToken.symbol} ]
          </button>
        )}

        {status === "approving" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>
            APPROVING {fromToken.symbol} IN WALLET...
          </div>
        )}

        {status === "waiting_approval_confirmation" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>
            WAITING FOR APPROVAL CONFIRMATION ON-CHAIN...
          </div>
        )}

        {status === "ready" && (
          <button
            onClick={handleExecuteSwap}
            className={`px-4 py-1.5 border ${theme.border} bg-current/30 hover:bg-current/50 ${theme.primary} font-bold ${theme.rounded} cursor-pointer ${theme.glow} transition-all`}
          >
            [ EXECUTE SWAP ]
          </button>
        )}

        {status === "swapping" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>
            SIGN SWAP TRANSACTION IN WALLET...
          </div>
        )}

        {status === "waiting_swap_confirmation" && (
          <div className={`${theme.warn} font-bold animate-pulse`}>
            WAITING FOR SWAP CONFIRMATION ON-CHAIN...
          </div>
        )}
      </div>
    </div>
  );
}
