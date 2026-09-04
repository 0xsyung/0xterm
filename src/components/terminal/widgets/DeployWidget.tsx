import React, { useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { encodeFunctionData, parseAbi, isAddress, type Address, type Chain } from "viem";
import { IMPLEMENTATION_BYTECODE } from "../implementationBytecode";

interface DeployWidgetProps {
  theme: any;
  type: "erc20" | "erc721";
  name: string;
  symbol: string;
  decimals: number;
  implementation?: Address;
  targetChain: Chain;
  userAddress: Address;
}

const CACHE_PREFIX = "0xterm-impl-v1";

type ImplStatus = "resolve" | "deploying_impl" | "deploying_proxy" | "initializing" | "success";

function loadCachedImpl(chainId: number, type: "erc20" | "erc721"): Address | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${chainId}:${type}`);
    return raw && isAddress(raw) ? (raw as Address) : null;
  } catch {
    return null;
  }
}

function cacheImpl(chainId: number, type: "erc20" | "erc721", addr: Address) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${chainId}:${type}`, addr);
  } catch {
    // localStorage unavailable (privacy mode) — non-fatal; just won't persist across reloads
  }
}

export default function DeployWidget({
  theme,
  type,
  name,
  symbol,
  decimals,
  implementation: initialImpl,
  targetChain,
  userAddress
}: DeployWidgetProps) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<ImplStatus>("resolve");
  const [implAddress, setImplAddress] = useState<Address | null>(
    initialImpl && isAddress(initialImpl) ? initialImpl : null
  );
  const [proxyAddress, setProxyAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Best available implementation: explicit registry → cached per chain/type.
  const resolvedImpl: Address | null =
    implAddress && isAddress(implAddress) ? implAddress : loadCachedImpl(targetChain.id, type);

  const handleExecute = async () => {
    if (!walletClient || !publicClient) return;
    setError(null);

    try {
      // 1. Ensure an implementation exists for this chain. If none is known (missing,
      //    zero address, or only a cached one that may be stale), deploy one from the
      //    bundled creation bytecode and remember it for later use.
      let implementation = resolvedImpl;
      if (!implementation || implementation === "0x0000000000000000000000000000000000000000") {
        setStatus("deploying_impl");
        const bytecode = IMPLEMENTATION_BYTECODE[type];

        const implHash = await walletClient.sendTransaction({
          account: userAddress,
          chain: targetChain,
          data: bytecode
        });
        const implReceipt = await publicClient.waitForTransactionReceipt({
          hash: implHash
        });
        if (implReceipt.status === "reverted") {
          throw new Error("Implementation deployment transaction reverted on-chain.");
        }
        if (!implReceipt.contractAddress) {
          throw new Error("Implementation deployment failed, no contract address returned.");
        }

        implementation = implReceipt.contractAddress;
        setImplAddress(implementation);
        cacheImpl(targetChain.id, type, implementation);
      }

      // 2. Construct EIP-1167 Minimal Proxy Bytecode (canonical OZ clone initcode —
      //    copies the runtime and returns; no self-delegation at CREATE time, so it
      //    works even when the implementation has no permissive fallback, e.g. OZ
      //    upgradeable contracts).
      const hexImp = implementation.replace("0x", "").toLowerCase();
      const proxyBytecode =
        `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${hexImp}5af43d82803e903d91602b57fd5bf3` as `0x${string}`;

      // 3. Deploy Proxy Bytecode (omitting 'to' creates a contract)
      setStatus("deploying_proxy");
      const deployHash = await walletClient.sendTransaction({
        account: userAddress,
        chain: targetChain,
        data: proxyBytecode
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash
      });

      if (receipt.status === "reverted") {
        throw new Error("Proxy deployment transaction reverted on-chain.");
      }

      if (!receipt.contractAddress) {
        throw new Error("Deployment failed, no contract address returned.");
      }

      const newProxy = receipt.contractAddress;
      setProxyAddress(newProxy);
      setStatus("initializing");

      // 4. Initialize the newly deployed proxy contract
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

      const initReceipt = await publicClient.waitForTransactionReceipt({
        hash: initHash
      });
      if (initReceipt.status === "reverted") {
        throw new Error("Token initialization reverted on-chain.");
      }
      setStatus("success");
    } catch (err: any) {
      setError(
        err.shortMessage ||
          err.message ||
          "An error occurred during deployment."
      );
      // Return to idle. If the implementation deploy succeeded, resolvedImpl is now
      // set, so re-running skips the implementation step.
      setStatus("resolve");
    }
  };

  const implLabel = implAddress
    ? `IMPLEMENTATION (${implAddress === initialImpl ? "REGISTRY" : "THIS CHAIN — AUTO-DEPLOYED"})`
    : "IMPLEMENTATION";

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
          <div className={`text-[10px] ${theme.text}/50`}>{implLabel}</div>
          <div className="font-mono text-[10px] break-all opacity-70">
            {resolvedImpl ?? "None — will auto-deploy before proxying"}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 p-2 border border-red-900/50 bg-red-950/30 rounded mt-2">
          {error}
        </div>
      )}

      {status === "success" && proxyAddress ? (
        <div className={`p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} mt-2 space-y-1`}>
          <div className={`font-bold ${theme.primary}`}>DEPLOYMENT SUCCESSFUL!</div>
          <div className={`text-[10px] font-mono break-all ${theme.primary}`}>
            Address: {proxyAddress}
          </div>
          {implAddress && (
            <div className={`text-[10px] font-mono break-all ${theme.muted}`}>
              Implementation: {implAddress}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleExecute}
          disabled={status !== "resolve"}
          className={`w-full py-2 min-h-[44px] mt-2 font-bold transition-all border ${
            status === "deploying_impl" ||
            status === "deploying_proxy" ||
            status === "initializing"
              ? "opacity-50 cursor-not-allowed bg-current/5 border-transparent"
              : `hover:bg-current/10 ${theme.border} ${theme.primary}`
          } rounded`}
        >
          {status === "resolve" &&
            (resolvedImpl
              ? "EXECUTE DEPLOYMENT"
              : "DEPLOY IMPLEMENTATION + PROXY")}
          {status === "deploying_impl" && "DEPLOYING IMPLEMENTATION..."}
          {status === "deploying_proxy" && "DEPLOYING PROXY BYTECODE..."}
          {status === "initializing" && "INITIALIZING METADATA..."}
        </button>
      )}
    </div>
  );
}
