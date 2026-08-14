/**
 * @file SwapWidget.tsx
 * @description Swap widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState, useEffect } from "react";
import { useSendTransaction, useWriteContract, usePublicClient } from "wagmi";
import { parseAbi, type Address, type Chain } from "viem";

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
  transactionRequest: {
    to: Address;
    data: `0x${string}`;
    value: `0x${string}`;
    gasLimit?: `0x${string}`;
  };
  approvalAddress?: Address;
  estimatedGasUsd?: string;
};

export default function SwapWidget({
  userAddress,
  targetChain,
  fromToken,
  toToken,
  fromAmountFormatted,
  toAmountFormatted,
  amountInWei,
  transactionRequest,
  approvalAddress,
  estimatedGasUsd
}: SwapWidgetProps) {
  const [status, setStatus] = useState<
    | "idle"
    | "checking_approval"
    | "needs_approval"
    | "approving"
    | "ready"
    | "swapping"
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
        address: fromToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [approvalAddress, amountInWei]
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
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
        to: transactionRequest.to,
        data: transactionRequest.data,
        value: BigInt(transactionRequest.value || "0x0")
      });

      setTxHash(hash);
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
    <div className="my-2 p-4 border border-[#00ff66]/50 bg-[#001105]/90 rounded max-w-lg matrix-glow text-xs space-y-3">
      <div className="flex justify-between items-center border-b border-[#00ff66]/20 pb-2">
        <span className="font-bold text-[#00ff66]">
          DEX SWAP ROUTE [AGGREGATED]
        </span>
        <span className="text-[#00ff66]/70">
          {targetChain.name.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[#00ff66]/90 font-mono">
        <div>
          <div className="text-[10px] text-[#00ff66]/50">YOU PAY</div>
          <div className="text-base font-bold text-[#00ff66]">
            {fromAmountFormatted} {fromToken.symbol}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#00ff66]/50">EXPECTED OUTPUT</div>
          <div className="text-base font-bold text-[#00ff66]">
            ≈ {toAmountFormatted} {toToken.symbol}
          </div>
        </div>
      </div>

      {estimatedGasUsd && (
        <div className="text-[11px] text-[#00ff66]/60 border-t border-[#00ff66]/10 pt-2 flex justify-between">
          <span>ESTIMATED NETWORK FEE:</span>
          <span className="text-[#00ff66] font-bold">${estimatedGasUsd}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {status === "success" && txHash && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 rounded space-y-1">
          <div className="font-bold">
            [✓] SWAP TRANSACTION SUBMITTED SUCCESSFULLY!
          </div>
          <div className="text-[10px] truncate">TX HASH: {txHash}</div>
          {blockExplorer && (
            <a
              href={`${blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] underline hover:text-emerald-300 block pt-0.5"
            >
              View on {targetChain.name} Explorer ↗
            </a>
          )}
        </div>
      )}

      <div className="pt-2 flex gap-2">
        {status === "checking_approval" && (
          <div className="text-[#00ff66]/60 animate-pulse">
            VERIFYING TOKEN ALLOWANCE...
          </div>
        )}

        {status === "needs_approval" && (
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 border border-[#00ff66] bg-[#00ff66]/20 hover:bg-[#00ff66]/30 text-[#00ff66] font-bold rounded cursor-pointer transition-all"
          >
            [ STEP 1/2: APPROVE {fromToken.symbol} ]
          </button>
        )}

        {status === "approving" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            APPROVING {fromToken.symbol} IN WALLET...
          </div>
        )}

        {status === "ready" && (
          <button
            onClick={handleExecuteSwap}
            className="px-4 py-1.5 border border-[#00ff66] bg-[#00ff66]/30 hover:bg-[#00ff66]/50 text-[#00ff66] font-bold rounded cursor-pointer matrix-glow transition-all"
          >
            [ EXECUTE SWAP ]
          </button>
        )}

        {status === "swapping" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            SIGN SWAP TRANSACTION IN WALLET...
          </div>
        )}
      </div>
    </div>
  );
}
