/**
 * @file InitializePoolWidget.tsx
 * @description Initialize pool widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { uniV3PoolAbi } from "../constants";
import PinButton from "./PinButton";

export default function InitializePoolWidget({
  targetChain,
  poolAddress,
  tokenA,
  tokenB,
  theme,
  onPin,
  pinned
}: any) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: targetChain.id });
  const [status, setStatus] = useState<
    "ready" | "signing" | "waiting_confirmation" | "success" | "error"
  >("ready");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInitialize = async () => {
    setStatus("signing");
    setErrorMsg(null);
    try {
      const initialSqrtPrice = 79228162514264337593543950336n;
      const hash = await writeContractAsync({
        chainId: targetChain.id,
        address: poolAddress,
        abi: uniV3PoolAbi,
        functionName: "initialize",
        args: [initialSqrtPrice]
      });
      setTxHash(hash);
      setStatus("waiting_confirmation");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          setStatus("error");
          setErrorMsg("Pool initialization reverted on-chain.");
          return;
        }
      }
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(
        err.shortMessage || err.message || "Initialization failed or rejected."
      );
    }
  };

  const blockExplorer = targetChain.blockExplorers?.default.url;

  return (
    <div
      className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} ${theme.font} text-xs space-y-3`}
    >
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
      <div
        className={`flex justify-between items-center border-b ${theme.border} pb-2`}
      >
        <span className={`font-bold ${theme.primary}`}>
          INITIALIZE V3 PRICE CURVE
        </span>
        <span className={`${theme.text}/70`}>
          {tokenA.symbol} / {tokenB.symbol}
        </span>
      </div>

      <div
        className={`text-[11px] ${theme.text}/80 select-all p-2 bg-current/10 rounded border ${theme.border}`}
      >
        POOL: {poolAddress}
      </div>

      {status === "error" && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {status === "success" && txHash && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 rounded space-y-1">
          <div className="font-bold">[✓] POOL INITIALIZED — CONFIRMED ON-CHAIN!</div>
          <div className="text-[10px] truncate">TX HASH: {txHash}</div>
          {blockExplorer && (
            <a
              href={`${blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] underline hover:opacity-80 block pt-0.5"
            >
              View on Explorer ↗
            </a>
          )}
        </div>
      )}

      <div className="pt-2 flex gap-2">
        {(status === "ready" || status === "error") && (
          <button
            onClick={handleInitialize}
            className={`px-4 py-1.5 border ${theme.border} bg-current/10 hover:bg-current/20 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all`}
          >
            [ EXECUTE INITIALIZE ]
          </button>
        )}
        {status === "signing" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            SIGN INITIALIZATION IN WALLET...
          </div>
        )}
        {status === "waiting_confirmation" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            WAITING FOR ON-CHAIN CONFIRMATION...
          </div>
        )}
      </div>
    </div>
  );
}
