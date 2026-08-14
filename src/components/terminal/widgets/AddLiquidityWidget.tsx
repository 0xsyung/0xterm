/**
 * @file AddLiquidityWidget.tsx
 * @description Add liquidity widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { formatUnits, createPublicClient, http, type Address } from "viem";
import {
  erc20Abi,
  uniV2RouterAbi,
  uniV3FactoryAbi,
  uniV3PoolAbi,
  nonfungiblePositionManagerAbi,
  NATIVE_TOKEN_ADDRESS
} from "../constants";

export default function AddLiquidityWidget({
  userAddress,
  targetChain,
  activeDex,
  tokenA,
  tokenB,
  amountAWei,
  amountBWei,
  fee,
  theme
}: any) {
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<
    | "check_approval"
    | "approving_a"
    | "approving_b"
    | "minting"
    | "success"
    | "error"
  >("check_approval");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const spender =
    activeDex.type === "V3" ? activeDex.positionManager : activeDex.router;

  const handleExecuteLiquidity = async () => {
    setErrorMsg(null);
    try {
      const client = createPublicClient({
        chain: targetChain,
        transport: http()
      });

      if (!tokenA.isNative) {
        setStep("approving_a");
        const allowanceA = (await client.readContract({
          address: tokenA.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress, spender]
        })) as bigint;

        if (allowanceA < amountAWei) {
          const hashA = await writeContractAsync({
            address: tokenA.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, amountAWei * 10n]
          });
          await client.waitForTransactionReceipt({ hash: hashA });
        }
      }

      if (!tokenB.isNative) {
        setStep("approving_b");
        const allowanceB = (await client.readContract({
          address: tokenB.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress, spender]
        })) as bigint;

        if (allowanceB < amountBWei) {
          const hashB = await writeContractAsync({
            address: tokenB.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, amountBWei * 10n]
          });
          await client.waitForTransactionReceipt({ hash: hashB });
        }
      }

      if (activeDex.type === "V3" && activeDex.positionManager) {
        const [token0, token1] =
          tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
            ? [tokenA, tokenB]
            : [tokenB, tokenA];

        let poolAddress: Address | undefined;
        try {
          poolAddress = (await client.readContract({
            address: activeDex.factory,
            abi: uniV3FactoryAbi,
            functionName: "getPool",
            args: [token0.address, token1.address, fee]
          })) as Address;
        } catch {
          poolAddress = undefined;
        }

        if (!poolAddress || poolAddress === NATIVE_TOKEN_ADDRESS) {
          throw new Error(
            `Pool does not exist. Run 'createpool ${tokenA.symbol} ${tokenB.symbol} ${fee}' first.`
          );
        }

        const slot0 = (await client.readContract({
          address: poolAddress,
          abi: uniV3PoolAbi,
          functionName: "slot0"
        })) as [bigint, number, number, number, number, number, boolean];

        if (slot0[0] === 0n) {
          throw new Error(
            `Pool is not initialized. Run 'initialize ${tokenA.symbol} ${tokenB.symbol} ${fee}' first.`
          );
        }

        setStep("minting");
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
        const tickSpacing =
          fee === 100 ? 2 : fee === 500 ? 10 : fee === 3000 ? 60 : 200;
        const minTick = Math.ceil(-887272 / tickSpacing) * tickSpacing;
        const maxTick = Math.floor(887272 / tickSpacing) * tickSpacing;

        const amount0Desired =
          tokenA.address.toLowerCase() === token0.address.toLowerCase()
            ? amountAWei
            : amountBWei;
        const amount1Desired =
          tokenA.address.toLowerCase() === token0.address.toLowerCase()
            ? amountBWei
            : amountAWei;

        const mintHash = await writeContractAsync({
          address: activeDex.positionManager,
          abi: nonfungiblePositionManagerAbi,
          functionName: "mint",
          args: [
            {
              token0: token0.address,
              token1: token1.address,
              fee: fee,
              tickLower: minTick,
              tickUpper: maxTick,
              amount0Desired,
              amount1Desired,
              amount0Min: 0n,
              amount1Min: 0n,
              recipient: userAddress,
              deadline
            }
          ],
          value: tokenA.isNative
            ? amountAWei
            : tokenB.isNative
              ? amountBWei
              : 0n
        });
        setTxHash(mintHash);
      } else {
        setStep("minting");
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
        const hash = await writeContractAsync({
          address: activeDex.router,
          abi: uniV2RouterAbi,
          functionName: "addLiquidity",
          args: [
            tokenA.address,
            tokenB.address,
            amountAWei,
            amountBWei,
            0n,
            0n,
            userAddress,
            deadline
          ]
        });
        setTxHash(hash);
      }

      setStep("success");
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.shortMessage || err.message || "Transaction rejected.");
    }
  };

  const blockExplorer = targetChain.blockExplorers?.default.url;

  return (
    <div
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} ${theme.font} text-xs space-y-3`}
    >
      <div
        className={`flex justify-between items-center border-b ${theme.border} pb-2`}
      >
        <span className={`font-bold ${theme.primary}`}>
          PROVIDE LIQUIDITY WIDGET
        </span>
        <span className={`${theme.text}/70`}>{activeDex.name}</span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN A</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {formatUnits(amountAWei, tokenA.decimals)} {tokenA.symbol}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN B</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {formatUnits(amountBWei, tokenB.decimals)} {tokenB.symbol}
          </div>
        </div>
      </div>

      {step === "error" && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {step === "success" && txHash && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 rounded space-y-1">
          <div className="font-bold">[✓] LIQUIDITY ADDED SUCCESSFULLY!</div>
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

      <div className="pt-2 flex flex-col gap-2">
        {step === "check_approval" && (
          <button
            onClick={handleExecuteLiquidity}
            className={`px-4 py-2 border ${theme.border} bg-current/10 hover:bg-current/20 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all text-center`}
          >
            [ EXECUTE APPROVALS & ADD LIQUIDITY ]
          </button>
        )}
        {step === "approving_a" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            APPROVING TOKEN A...
          </div>
        )}
        {step === "approving_b" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            APPROVING TOKEN B...
          </div>
        )}
        {step === "minting" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            MINTING LIQUIDITY POSITION...
          </div>
        )}
      </div>
    </div>
  );
}
