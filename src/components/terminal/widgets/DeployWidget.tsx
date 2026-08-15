import React, { useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { encodeFunctionData, parseAbi, type Address, type Chain } from "viem";

interface DeployWidgetProps {
  theme: any;
  type: "erc20" | "erc721";
  name: string;
  symbol: string;
  decimals: number;
  implementation: Address;
  targetChain: Chain;
  userAddress: Address;
}

export default function DeployWidget({
  theme,
  type,
  name,
  symbol,
  decimals,
  implementation,
  targetChain,
  userAddress
}: DeployWidgetProps) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<
    "idle" | "deploying" | "initializing" | "success"
  >("idle");
  const [proxyAddress, setProxyAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!walletClient || !publicClient) return;
    setStatus("deploying");
    setError(null);

    try {
      // 1. Construct EIP-1167 Minimal Proxy Bytecode
      const hexImp = implementation.replace("0x", "").toLowerCase();
      const proxyBytecode =
        `0x363d3d373d3d3d363d73${hexImp}5af43d82803e903d91602b57fd5bf3` as `0x${string}`;

      // 2. Deploy Bytecode (omitting 'to' creates a contract)
      const deployHash = await walletClient.sendTransaction({
        account: userAddress,
        chain: targetChain,
        data: proxyBytecode
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash
      });

      if (!receipt.contractAddress) {
        throw new Error("Deployment failed, no contract address returned.");
      }

      const newProxy = receipt.contractAddress;
      setProxyAddress(newProxy);
      setStatus("initializing");

      // 3. Initialize the newly deployed proxy contract
      let initData: `0x${string}`;
      if (type === "erc20") {
        initData = encodeFunctionData({
          abi: parseAbi([
            "function initialize(string name, string symbol, uint8 decimals)"
          ]),
          functionName: "initialize",
          args: [name, symbol, decimals]
        });
      } else {
        initData = encodeFunctionData({
          abi: parseAbi(["function initialize(string name, string symbol)"]),
          functionName: "initialize",
          args: [name, symbol]
        });
      }

      const initHash = await walletClient.sendTransaction({
        account: userAddress,
        chain: targetChain,
        to: newProxy,
        data: initData
      });

      await publicClient.waitForTransactionReceipt({ hash: initHash });
      setStatus("success");
    } catch (err: any) {
      setError(
        err.shortMessage ||
          err.message ||
          "An error occurred during deployment."
      );
      setStatus("idle");
    }
  };

  return (
    <div
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-3 max-w-xl`}
    >
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-2`}
      >
        <span className="font-bold">
          TOKEN DEPLOYMENT ({type.toUpperCase()})
        </span>
        <span className="uppercase">{targetChain.name}</span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>NAME / SYMBOL</div>
          <div className={`font-bold ${theme.primary}`}>
            {name} ({symbol.toUpperCase()})
          </div>
        </div>
        {type === "erc20" && (
          <div>
            <div className={`text-[10px] ${theme.text}/50`}>DECIMALS</div>
            <div className={`font-bold ${theme.primary}`}>{decimals}</div>
          </div>
        )}
        <div className="col-span-2">
          <div className={`text-[10px] ${theme.text}/50`}>
            BASE IMPLEMENTATION
          </div>
          <div className="font-mono text-[10px] break-all opacity-70">
            {implementation}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 p-2 border border-red-900/50 bg-red-950/30 rounded mt-2">
          {error}
        </div>
      )}

      {status === "success" && proxyAddress ? (
        <div className="p-3 bg-green-950/30 border border-green-900/50 rounded mt-2 space-y-1">
          <div className="text-green-400 font-bold">DEPLOYMENT SUCCESSFUL!</div>
          <div className="text-[10px] font-mono break-all text-green-300">
            Address: {proxyAddress}
          </div>
        </div>
      ) : (
        <button
          onClick={handleExecute}
          disabled={status !== "idle"}
          className={`w-full py-2 mt-2 font-bold transition-all border ${
            status !== "idle"
              ? "opacity-50 cursor-not-allowed bg-current/5 border-transparent"
              : `hover:bg-current/10 ${theme.border} ${theme.primary}`
          } rounded`}
        >
          {status === "idle" && "EXECUTE DEPLOYMENT"}
          {status === "deploying" && "DEPLOYING PROXY BYTECODE..."}
          {status === "initializing" && "INITIALIZING METADATA..."}
        </button>
      )}
    </div>
  );
}
