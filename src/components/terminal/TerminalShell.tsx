"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract
} from "wagmi";
import {
  formatEther,
  formatUnits,
  parseUnits,
  isAddress,
  parseAbi,
  createPublicClient,
  http,
  encodeFunctionData,
  toHex,
  type Address,
  type Chain
} from "viem";
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia
} from "viem/chains";
import SwapWidget from "./SwapWidget";

type ThemeMode = "matrix" | "mac" | "bloomberg" | "whatsapp";

type LogEntry = {
  id: string;
  type:
    | "input"
    | "text"
    | "help"
    | "dexes"
    | "createpool"
    | "initialize"
    | "getpool"
    | "addliq"
    | "swap"
    | "balance"
    | "pool";
  text?: string;
  payload?: any;
  component?: React.ReactNode;
};

type DexProtocol = {
  id: string;
  name: string;
  router: Address;
  factory: Address;
  positionManager?: Address;
  type: "V2" | "V3";
};

// ---------------------------------------------------------
// THEME CONFIGURATIONS
// ---------------------------------------------------------
const THEMES: Record<
  ThemeMode,
  {
    name: string;
    bg: string;
    cardBg: string;
    text: string;
    primary: string;
    border: string;
    glow: string;
    font: string;
    rounded: string;
    promptSymbol: string;
    headerStyle: "matrix" | "mac" | "bloomberg" | "whatsapp";
    hasScanlines: boolean;
    hasGrid: boolean;
  }
> = {
  matrix: {
    name: "Matrix Style",
    bg: "bg-black",
    cardBg: "bg-[#001105]/90",
    text: "text-[#00ff66]",
    primary: "text-[#00ff66]",
    border: "border-[#00ff66]/50",
    glow: "matrix-glow",
    font: "font-mono",
    rounded: "rounded-none",
    promptSymbol: ">",
    headerStyle: "matrix",
    hasScanlines: true,
    hasGrid: false
  },
  mac: {
    name: "Mac Terminal",
    bg: "bg-[#1e1e1e]",
    cardBg: "bg-[#2d2d2d]/95",
    text: "text-[#f1f1f1]",
    primary: "text-[#38bdf8]",
    border: "border-neutral-700",
    glow: "shadow-2xl shadow-black/80 backdrop-blur-xl",
    font: "font-mono",
    rounded: "rounded-xl",
    promptSymbol: "❯",
    headerStyle: "mac",
    hasScanlines: false,
    hasGrid: false
  },
  bloomberg: {
    name: "Bloomberg Terminal",
    bg: "bg-[#0c0c0c]",
    cardBg: "bg-[#141414]",
    text: "text-[#ffb000]",
    primary: "text-[#ffb000]",
    border: "border-[#ffb000]/60",
    glow: "shadow-md shadow-[#ffb000]/20",
    font: "font-mono tracking-wider uppercase",
    rounded: "rounded-none",
    promptSymbol: "BBG>",
    headerStyle: "bloomberg",
    hasScanlines: false,
    hasGrid: true
  },
  whatsapp: {
    name: "WhatsApp Style",
    bg: "bg-[#0b141a]",
    cardBg: "bg-[#111b21]",
    text: "text-[#e9edef]",
    primary: "text-[#00a884]",
    border: "border-[#00a884]/30",
    glow: "shadow-lg shadow-black/60",
    font: "font-sans",
    rounded: "rounded-2xl",
    promptSymbol: "WA >",
    headerStyle: "whatsapp",
    hasScanlines: false,
    hasGrid: false
  }
};

// ---------------------------------------------------------
// ON-CHAIN DEFI REGISTRIES
// ---------------------------------------------------------
const SUPPORTED_CHAINS: Chain[] = [
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia
];
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

const WRAPPED_NATIVE: Record<number, Address> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  8453: "0x4200000000000000000000000000000000000006",
  11155111: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
};

const DEX_REGISTRY: Record<number, DexProtocol[]> = {
  1: [
    {
      id: "univ3",
      name: "Uniswap V3",
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      type: "V3"
    },
    {
      id: "univ2",
      name: "Uniswap V2",
      router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      type: "V2"
    }
  ],
  11155111: [
    {
      id: "univ3",
      name: "Uniswap V3",
      router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
      factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
      positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
      type: "V3"
    },
    {
      id: "univ2-test",
      name: "Uniswap V2 Clone",
      router: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
      factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6",
      type: "V2"
    }
  ]
};

// ---------------------------------------------------------
// ABIs
// ---------------------------------------------------------
const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
]);

const uniV2RouterAbi = parseAbi([
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)"
]);

const uniV3RouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)"
]);

const uniV3PoolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool unlocked)",
  "function initialize(uint160 sqrtPriceX96) external"
]);

const nonfungiblePositionManagerAbi = parseAbi([
  "struct MintParams { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }",
  "function mint(MintParams params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
]);

const uniV2FactoryAbi = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function createPair(address tokenA, address tokenB) returns (address pair)"
]);

const uniV3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
  "function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)"
]);

const uniV2PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
]);

const COMMON_TOKENS: Record<
  number,
  Record<
    string,
    { address: Address; decimals: number; symbol: string; name: string }
  >
> = {
  11155111: {
    ETH: {
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      symbol: "ETH",
      name: "Sepolia Ethereum"
    }
  }
};

const resolveChain = (query?: string): Chain | undefined => {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  return SUPPORTED_CHAINS.find(
    (c) =>
      c.id.toString() === q ||
      c.name.toLowerCase() === q ||
      (q === "mainnet" && c.id === 1)
  );
};

// ---------------------------------------------------------
// COMPONENT: Help Manual
// ---------------------------------------------------------
function HelpManual({ theme }: { theme: any }) {
  return (
    <div
      className={`text-xs space-y-2 my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.text} max-w-2xl`}
    >
      <div
        className={`border-b ${theme.border} pb-1 font-bold ${theme.primary} tracking-wider`}
      >
        SYSTEM COMMAND MANUAL
      </div>
      <div className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 pt-1">
        <div className={`font-bold ${theme.primary}`}>
          network &lt;name|id&gt;
        </div>
        <div>Switch active network</div>
        <div className={`font-bold ${theme.primary}`}>dexes</div>
        <div>List available DEXes</div>
        <div className={`font-bold ${theme.primary}`}>dex &lt;id&gt;</div>
        <div>Set active DEX protocol</div>
        <div className={`font-bold ${theme.primary}`}>
          createpool &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Deploy pool contract</div>
        <div className={`font-bold ${theme.primary}`}>
          getpool &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Query pool address</div>
        <div className={`font-bold ${theme.primary}`}>
          initialize &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Initialize V3 pool price curve</div>
        <div className={`font-bold ${theme.primary}`}>
          addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
        </div>
        <div>Add liquidity position</div>
        <div className={`font-bold ${theme.primary}`}>
          swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
        </div>
        <div>Execute token swap</div>
        <div className={`font-bold ${theme.primary}`}>pool &lt;address&gt;</div>
        <div>Check V2/V3 pool metrics</div>
        <div className={`font-bold ${theme.primary}`}>
          balance &lt;token&gt;
        </div>
        <div>Check token balance</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// WIDGET: Create Pool
// ---------------------------------------------------------
function CreatePoolWidget({
  targetChain,
  activeDex,
  tokenA,
  tokenB,
  addrA,
  addrB,
  fee,
  theme
}: any) {
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<
    "ready" | "signing" | "success" | "error"
  >("ready");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async () => {
    setStatus("signing");
    setErrorMsg(null);
    try {
      const hash = await writeContractAsync({
        address: activeDex.factory,
        abi: activeDex.type === "V2" ? uniV2FactoryAbi : uniV3FactoryAbi,
        functionName: activeDex.type === "V2" ? "createPair" : "createPool",
        args: activeDex.type === "V2" ? [addrA, addrB] : [addrA, addrB, fee]
      });
      setTxHash(hash);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(
        err.shortMessage || err.message || "Transaction failed or rejected."
      );
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
          DEPLOY POOL CONTRACT [FACTORY]
        </span>
        <span className={`${theme.text}/70`}>
          {activeDex.name} ({activeDex.type})
        </span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN A</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {tokenA.symbol}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN B</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {tokenB.symbol}
          </div>
        </div>
      </div>

      {activeDex.type === "V3" && (
        <div className={`text-[10px] ${theme.text}/70 pt-1`}>
          FEE TIER:{" "}
          <span className="font-bold">
            {fee / 10000}% ({fee})
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {status === "success" && txHash && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 rounded space-y-1">
          <div className="font-bold">[✓] FACTORY TRANSACTION SUBMITTED!</div>
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
            onClick={handleCreate}
            className={`px-4 py-1.5 border ${theme.border} bg-current/10 hover:bg-current/20 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all`}
          >
            [ CALL CREATE POOL ]
          </button>
        )}
        {status === "signing" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            SIGN FACTORY DEPLOYMENT IN WALLET...
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// WIDGET: Initialize Pool (V3)
// ---------------------------------------------------------
function InitializePoolWidget({
  targetChain,
  poolAddress,
  tokenA,
  tokenB,
  theme
}: any) {
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<
    "ready" | "signing" | "success" | "error"
  >("ready");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInitialize = async () => {
    setStatus("signing");
    setErrorMsg(null);
    try {
      const initialSqrtPrice = 79228162514264337593543950336n;
      const hash = await writeContractAsync({
        address: poolAddress,
        abi: uniV3PoolAbi,
        functionName: "initialize",
        args: [initialSqrtPrice]
      });
      setTxHash(hash);
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
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} ${theme.font} text-xs space-y-3`}
    >
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
          <div className="font-bold">[✓] POOL INITIALIZED SUCCESSFULLY!</div>
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// WIDGET: Add Liquidity
// ---------------------------------------------------------
function AddLiquidityWidget({
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

// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------
export default function TerminalShell({
  onToggleRain,
  currentThemeKey,
  onThemeChange
}: {
  onToggleRain: () => void;
  currentThemeKey: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const [activeDexId, setActiveDexId] = useState<string | null>(null);

  // Theme state
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const theme = THEMES[currentThemeKey];

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", type: "text", text: "0xTERM v1.4.8 [FULL ON-CHAIN DEFI SUITE]" },
    { id: "2", type: "text", text: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n' }
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleChainSwitch = (chainId: number) => {
    setActiveChainId(chainId);
    const dexes = DEX_REGISTRY[chainId] || [];
    if (dexes.length > 0) setActiveDexId(dexes[0].id);
    else setActiveDexId(null);
  };

  const resolveTokenDetails = async (queryToken: string, chain: Chain) => {
    const sym = queryToken.toUpperCase();
    const isNative =
      sym === chain.nativeCurrency.symbol ||
      sym === "ETH" ||
      queryToken === NATIVE_TOKEN_ADDRESS;
    if (isNative)
      return {
        address: NATIVE_TOKEN_ADDRESS as Address,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: 18,
        isNative: true
      };

    const preset = COMMON_TOKENS[chain.id]?.[sym];
    if (preset) return { ...preset, isNative: false };

    const client = createPublicClient({ chain, transport: http() });
    if (isAddress(queryToken)) {
      const addr = queryToken as Address;
      const [decimals, tokenSymbol, name] = await Promise.all([
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "decimals"
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "symbol"
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "name"
        })
      ]);
      return {
        address: addr,
        symbol: String(tokenSymbol),
        name: String(name),
        decimals: Number(decimals),
        isNative: false
      };
    }

    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${queryToken}`
    );
    const data = await res.json();
    const pair = data.pairs?.find(
      (p: { chainId: string }) =>
        p.chainId.toLowerCase() === chain.name.toLowerCase() ||
        p.chainId === "ethereum"
    );

    if (pair?.baseToken?.address && isAddress(pair.baseToken.address)) {
      const addr = pair.baseToken.address as Address;
      const decimals = await client.readContract({
        address: addr,
        abi: erc20Abi,
        functionName: "decimals"
      });
      return {
        address: addr,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        decimals: Number(decimals),
        isNative: false
      };
    }
    throw new Error(
      `Unable to resolve token "${queryToken}" on ${chain.name}.`
    );
  };

  const fetchPoolAddress = async (
    queryA: string,
    queryB: string,
    targetChain: Chain,
    activeDex: DexProtocol,
    feeTierArg?: string
  ) => {
    const [tokenA, tokenB] = await Promise.all([
      resolveTokenDetails(queryA, targetChain),
      resolveTokenDetails(queryB, targetChain)
    ]);

    const addrA = tokenA.isNative
      ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
      : tokenA.address;
    const addrB = tokenB.isNative
      ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
      : tokenB.address;
    if (addrA.toLowerCase() === addrB.toLowerCase())
      throw new Error("Tokens must be different.");

    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });
    let pairAddress: Address | undefined;

    try {
      if (activeDex.type === "V2") {
        pairAddress = await client.readContract({
          address: activeDex.factory,
          abi: uniV2FactoryAbi,
          functionName: "getPair",
          args: [addrA, addrB]
        });
      } else if (activeDex.type === "V3") {
        const feeTier = feeTierArg ? parseInt(feeTierArg) : 3000;
        pairAddress = await client.readContract({
          address: activeDex.factory,
          abi: uniV3FactoryAbi,
          functionName: "getPool",
          args: [addrA, addrB, feeTier]
        });
      }

      if (!pairAddress || pairAddress === NATIVE_TOKEN_ADDRESS) {
        return (
          <div className="text-yellow-400 my-2 p-3 border border-yellow-900/50 bg-yellow-950/30 rounded max-w-md text-xs">
            <div className="font-bold mb-1">NO POOL FOUND</div>
            <div>
              No {activeDex.type} pool exists for {tokenA.symbol}/
              {tokenB.symbol} on {activeDex.name}.
            </div>
          </div>
        );
      }

      return (
        <div
          className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs`}
        >
          <div
            className={`flex justify-between items-center ${theme.text}/70 mb-2 border-b ${theme.border} pb-1`}
          >
            <span className="font-bold">ON-CHAIN POOL LOCATED</span>
            <span>
              {activeDex.name} ({activeDex.type})
            </span>
          </div>
          <div className={`text-lg font-bold ${theme.primary} mb-1`}>
            {tokenA.symbol} / {tokenB.symbol}
          </div>
          <div
            className={`${theme.text} select-all p-2 bg-current/10 rounded border ${theme.border} text-center my-2 font-mono`}
          >
            {pairAddress}
          </div>
        </div>
      );
    } catch (err: any) {
      return (
        <div className="text-red-400 my-2 p-3 border border-red-900/50 bg-red-950/30 rounded max-w-md text-xs space-y-1">
          <div className="font-bold">DEBUG ERROR DETAILS:</div>
          <div className="font-mono text-[10px] break-all">
            {err.message || String(err)}
          </div>
        </div>
      );
    }
  };

  const fetchOnChainLiquidity = async (
    poolAddress: string,
    targetChain: Chain
  ) => {
    if (!isAddress(poolAddress)) {
      return (
        <div className="text-red-400">
          Error: Provide a valid pool contract address (0x...).
        </div>
      );
    }

    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });

    try {
      const [token0, token1, fee, liquidity, slot0] = await Promise.all([
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function token0() view returns (address)"]),
          functionName: "token0"
        }),
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function token1() view returns (address)"]),
          functionName: "token1"
        }),
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function fee() view returns (uint24)"]),
          functionName: "fee"
        }),
        client.readContract({
          address: poolAddress as Address,
          abi: parseAbi(["function liquidity() view returns (uint128)"]),
          functionName: "liquidity"
        }),
        client.readContract({
          address: poolAddress as Address,
          abi: uniV3PoolAbi,
          functionName: "slot0"
        })
      ]);

      const [dec0, sym0] = await Promise.all([
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "decimals"
        }),
        client.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: "symbol"
        })
      ]);

      const [dec1, sym1] = await Promise.all([
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "decimals"
        }),
        client.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: "symbol"
        })
      ]);

      return (
        <div
          className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
        >
          <div
            className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
          >
            <span className="font-bold">UNISWAP V3 POOL METRICS</span>
            <span>{targetChain.name.toUpperCase()}</span>
          </div>
          <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
              <div className={`font-bold ${theme.primary}`}>
                {sym0} / {sym1}
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>FEE TIER</div>
              <div className={`font-bold ${theme.primary}`}>
                {Number(fee) / 10000}%
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>
                ACTIVE LIQUIDITY
              </div>
              <div className={`font-bold ${theme.primary}`}>
                {liquidity.toString()}
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${theme.text}/50`}>CURRENT TICK</div>
              <div className={`font-bold ${theme.primary}`}>{slot0[1]}</div>
            </div>
          </div>
          <div
            className={`text-[9px] ${theme.text}/40 truncate pt-1 border-t ${theme.border}`}
          >
            SQRT PRICE X96: {slot0[0].toString()}
          </div>
        </div>
      );
    } catch {
      try {
        const [token0, token1, reserves] = await Promise.all([
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "token0"
          }),
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "token1"
          }),
          client.readContract({
            address: poolAddress as Address,
            abi: uniV2PairAbi,
            functionName: "getReserves"
          })
        ]);

        const [dec0, sym0] = await Promise.all([
          client.readContract({
            address: token0,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          client.readContract({
            address: token0,
            abi: erc20Abi,
            functionName: "symbol"
          })
        ]);

        const [dec1, sym1] = await Promise.all([
          client.readContract({
            address: token1,
            abi: erc20Abi,
            functionName: "decimals"
          }),
          client.readContract({
            address: token1,
            abi: erc20Abi,
            functionName: "symbol"
          })
        ]);

        return (
          <div
            className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
          >
            <div
              className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
            >
              <span className="font-bold">UNISWAP V2 POOL RESERVES</span>
              <span>{targetChain.name.toUpperCase()}</span>
            </div>
            <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  {sym0} RESERVE
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {parseFloat(formatUnits(reserves[0], dec0)).toLocaleString()}
                </div>
              </div>
              <div>
                <div className={`text-[10px] ${theme.text}/50`}>
                  {sym1} RESERVE
                </div>
                <div className={`text-base font-bold ${theme.primary}`}>
                  {parseFloat(formatUnits(reserves[1], dec1)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      } catch {
        return (
          <div className="text-red-400 my-1 p-2 border border-red-900/50 bg-red-950/30 rounded max-w-md text-xs">
            <div className="font-bold">Failed to read pool contract.</div>
            <div>
              Ensure {poolAddress} is a valid V2 pair or V3 pool address.
            </div>
          </div>
        );
      }
    }
  };

  const fetchTokenBalance = async (
    userAddress: Address,
    targetChain: Chain,
    queryToken?: string
  ) => {
    const client = createPublicClient({
      chain: targetChain,
      transport: http()
    });
    if (!queryToken) {
      const bal = await client.getBalance({ address: userAddress });
      return (
        <div
          className={`my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md text-xs font-bold ${theme.primary}`}
        >
          {formatEther(bal)} {targetChain.nativeCurrency.symbol}
        </div>
      );
    }
    const token = await resolveTokenDetails(queryToken, targetChain);
    if (token.isNative) {
      const bal = await client.getBalance({ address: userAddress });
      return (
        <div
          className={`my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md text-xs font-bold ${theme.primary}`}
        >
          {formatEther(bal)} {token.symbol}
        </div>
      );
    }
    const bal = await client.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    });
    return (
      <div
        className={`my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md text-xs font-bold ${theme.primary}`}
      >
        {formatUnits(bal as bigint, token.decimals)} {token.symbol}
      </div>
    );
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userLog: LogEntry = {
      id: Date.now().toString(),
      type: "input",
      text: `$ ${trimmed}`
    };
    const args = trimmed.split(" ");
    const command = args[0].toLowerCase();

    let newEntry: LogEntry = userLog;

    switch (command) {
      case "clear":
        setLogs([]);
        return;

      case "help":
        setLogs((prev) => [
          ...prev,
          userLog,
          { id: (Date.now() + 1).toString(), type: "help" }
        ]);
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIdx(-1);
        return;

      case "network":
      case "net":
        let netText = "";
        if (!args[1]) {
          const currentChainObj = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          );
          netText = `Active Network: ${currentChainObj?.name || "None"}`;
        } else if (args[1] === "0") {
          setActiveChainId(null);
          setActiveDexId(null);
          netText = "Network cleared.";
        } else {
          const targetChain = resolveChain(args[1]);
          if (!targetChain) netText = "Network not recognized.";
          else {
            handleChainSwitch(targetChain.id);
            if (isConnected)
              await switchChainAsync({ chainId: targetChain.id }).catch(
                () => {}
              );
            netText = `[✓] Network set to ${targetChain.name}`;
          }
        }
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: netText
        };
        break;

      case "dexes":
        if (!activeChainId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network first."
          };
        } else {
          setLogs((prev) => [
            ...prev,
            userLog,
            { id: (Date.now() + 1).toString(), type: "dexes" }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "dex":
        let dexText = "";
        if (!activeChainId) dexText = "Select network first.";
        else if (!args[1]) {
          const activeDexObj = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === activeDexId
          );
          dexText = `Active DEX: ${activeDexObj?.name || "None"}`;
        } else {
          const targetDex = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === args[1].toLowerCase()
          );
          if (!targetDex) dexText = "DEX not found.";
          else {
            setActiveDexId(targetDex.id);
            dexText = `[✓] DEX set to ${targetDex.name}`;
          }
        }
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: dexText
        };
        break;

      case "createpool":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: createpool <tokenA> <tokenB> [fee]"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
            const [tokenA, tokenB] = await Promise.all([
              resolveTokenDetails(args[1], targetChain),
              resolveTokenDetails(args[2], targetChain)
            ]);
            const addrA = tokenA.isNative
              ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
              : tokenA.address;
            const addrB = tokenB.isNative
              ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
              : tokenB.address;
            const fee = args[3] ? parseInt(args[3]) : 3000;

            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "createpool",
                payload: {
                  targetChain,
                  activeDex,
                  tokenA,
                  tokenB,
                  addrA,
                  addrB,
                  fee
                }
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "initialize":
      case "initpool":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: initialize <tokenA> <tokenB> [fee]"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          if (activeDex.type !== "V3") {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: "Initialization is only applicable to Uniswap V3 pools."
            };
            break;
          }
          try {
            const [tokenA, tokenB] = await Promise.all([
              resolveTokenDetails(args[1], targetChain),
              resolveTokenDetails(args[2], targetChain)
            ]);
            const addrA = tokenA.isNative
              ? WRAPPED_NATIVE[targetChain.id] || tokenA.address
              : tokenA.address;
            const addrB = tokenB.isNative
              ? WRAPPED_NATIVE[targetChain.id] || tokenB.address
              : tokenB.address;
            const fee = args[3] ? parseInt(args[3]) : 3000;

            const [token0, token1] =
              addrA.toLowerCase() < addrB.toLowerCase()
                ? [addrA, addrB]
                : [addrB, addrA];
            const client = createPublicClient({
              chain: targetChain,
              transport: http()
            });
            const poolAddress = (await client.readContract({
              address: activeDex.factory,
              abi: uniV3FactoryAbi,
              functionName: "getPool",
              args: [token0, token1, fee]
            })) as Address;

            if (!poolAddress || poolAddress === NATIVE_TOKEN_ADDRESS) {
              throw new Error(
                `Pool does not exist. Run 'createpool ${tokenA.symbol} ${tokenB.symbol} ${fee}' first.`
              );
            }

            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "initialize",
                payload: { targetChain, poolAddress, tokenA, tokenB }
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "getpool":
      case "findpool":
        if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: getpool <tokenA> <tokenB> [fee]"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
            const poolWidget = await fetchPoolAddress(
              args[1],
              args[2],
              targetChain,
              activeDex,
              args[3]
            );
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "component",
                component: poolWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "addliq":
      case "provideliq":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2] || !args[3] || !args[4]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: addliq <tokenA> <tokenB> <amtA> <amtB> [fee]"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
            const [tokenA, tokenB] = await Promise.all([
              resolveTokenDetails(args[1], targetChain),
              resolveTokenDetails(args[2], targetChain)
            ]);
            const amountAWei = parseUnits(args[3], tokenA.decimals);
            const amountBWei = parseUnits(args[4], tokenB.decimals);
            const fee = args[5] ? parseInt(args[5]) : 3000;

            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "addliq",
                payload: {
                  userAddress: address,
                  targetChain,
                  activeDex,
                  tokenA,
                  tokenB,
                  amountAWei,
                  amountBWei,
                  fee
                }
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "swap":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else if (!activeChainId || !activeDexId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network and DEX first."
          };
        } else if (!args[1] || !args[2] || !args[3]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: swap <amount> <fromToken> <toToken>"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          try {
            const [fromToken, toToken] = await Promise.all([
              resolveTokenDetails(args[2], targetChain),
              resolveTokenDetails(args[3], targetChain)
            ]);
            const amountInWei = parseUnits(args[1], fromToken.decimals);
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
            const addrIn = fromToken.isNative
              ? WRAPPED_NATIVE[targetChain.id] || fromToken.address
              : fromToken.address;
            const addrOut = toToken.isNative
              ? WRAPPED_NATIVE[targetChain.id] || toToken.address
              : toToken.address;

            let txData: `0x${string}`,
              txValue = "0x0" as `0x${string}`,
              approvalAddress: Address | undefined;
            if (activeDex.type === "V2") {
              if (fromToken.isNative) {
                txData = encodeFunctionData({
                  abi: parseAbi([
                    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable"
                  ]),
                  functionName: "swapExactETHForTokens",
                  args: [0n, [addrIn, addrOut], address, deadline]
                });
                txValue = toHex(amountInWei);
              } else {
                txData = encodeFunctionData({
                  abi: parseAbi([
                    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)"
                  ]),
                  functionName: "swapExactTokensForTokens",
                  args: [amountInWei, 0n, [addrIn, addrOut], address, deadline]
                });
                approvalAddress = activeDex.router;
              }
            } else {
              txData = encodeFunctionData({
                abi: uniV3RouterAbi,
                functionName: "exactInputSingle",
                args: [
                  {
                    tokenIn: addrIn,
                    tokenOut: addrOut,
                    fee: 3000,
                    recipient: address,
                    deadline,
                    amountIn: amountInWei,
                    amountOutMinimum: 0n,
                    sqrtPriceLimitX96: 0n
                  }
                ]
              });
              if (fromToken.isNative) txValue = toHex(amountInWei);
              else approvalAddress = activeDex.router;
            }

            const swapWidget = (
              <SwapWidget
                userAddress={address}
                targetChain={targetChain}
                fromToken={fromToken}
                toToken={toToken}
                fromAmountFormatted={args[1]}
                toAmountFormatted="ROUTED"
                amountInWei={amountInWei}
                transactionRequest={{
                  to: activeDex.router,
                  data: txData,
                  value: txValue
                }}
                approvalAddress={approvalAddress}
              />
            );
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "component",
                component: swapWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "balance":
      case "bal":
        if (!isConnected || !address) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Wallet not connected."
          };
        } else {
          const targetChain =
            SUPPORTED_CHAINS.find((c) => c.id === activeChainId) ||
            SUPPORTED_CHAINS[5];
          try {
            const balWidget = await fetchTokenBalance(
              address,
              targetChain,
              args[1]
            );
            setLogs((prev) => [
              ...prev,
              userLog,
              {
                id: (Date.now() + 1).toString(),
                type: "component",
                component: balWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            newEntry = {
              id: (Date.now() + 1).toString(),
              type: "text",
              text: `ERROR: ${err.message}`
            };
          }
        }
        break;

      case "pool":
      case "liquidity":
        if (!activeChainId) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Select network first."
          };
        } else if (!args[1]) {
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Usage: pool <poolAddress>"
          };
        } else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const poolWidget = await fetchOnChainLiquidity(args[1], targetChain);
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "component",
              component: poolWidget
            }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "connect":
        if (isConnected) connect({ connector: connectors[0] });
        else
          newEntry = {
            id: (Date.now() + 1).toString(),
            type: "text",
            text: "Initiating handshake..."
          };
        break;

      case "disconnect":
        disconnect();
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: "Disconnected."
        };
        break;

      case "rain":
        onToggleRain();
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: "Rain toggled."
        };
        break;

      default:
        newEntry = {
          id: (Date.now() + 1).toString(),
          type: "text",
          text: `Command not recognized: "${command}". Type "help".`
        };
    }

    setLogs((prev) => [...prev, userLog, newEntry]);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0 && historyIdx + 1 < history.length) {
        setHistoryIdx(historyIdx + 1);
        setInput(history[history.length - 1 - (historyIdx + 1)]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        setHistoryIdx(historyIdx - 1);
        setInput(history[history.length - 1 - (historyIdx - 1)]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    }
  };

  const activeChainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
  const activeDexObj = activeChainId
    ? DEX_REGISTRY[activeChainId]?.find((d) => d.id === activeDexId)
    : null;

  return (
    <div
      className={`relative z-10 w-full h-full flex flex-col cursor-text overflow-hidden transition-all duration-300 ${theme.bg} ${theme.text} ${theme.font}`}
    >
      {/* EXCLUSIVE SCANLINE OVERLAY: Strictly restricted to Matrix theme */}
      {currentThemeKey === "matrix" && (
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-70 z-20"></div>
      )}
      {currentThemeKey === "bloomberg" && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffb000_1px,transparent_1px)] [background-size:16px_16px] opacity-10 z-20"></div>
      )}

      {/* TOP HEADER BAR */}
      <div
        className={`absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between border-b ${theme.border} ${theme.cardBg} backdrop-blur-md z-30`}
      >
        <div className="flex items-center space-x-3">
          {theme.headerStyle === "mac" && (
            <div className="flex items-center space-x-1.5 mr-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-inner"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-inner"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-inner"></div>
            </div>
          )}
          {theme.headerStyle === "bloomberg" && (
            <div className="px-2 py-0.5 bg-[#ffb000] text-black font-bold text-[10px] rounded-none">
              BBG
            </div>
          )}
          {theme.headerStyle === "whatsapp" && (
            <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] font-bold text-xs">
              WA
            </div>
          )}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full bg-current animate-pulse ${theme.primary}`}
          ></span>
          <span className={`font-bold tracking-wider text-xs ${theme.primary}`}>
            0xTERM TERMINAL
          </span>
        </div>

        <div className="flex items-center space-x-3 relative">
          {/* THEME SWITCHER DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className={`px-3 py-1.5 text-xs font-bold border ${theme.border} bg-current/5 hover:bg-current/15 ${theme.rounded} transition-all flex items-center space-x-1.5 ${theme.primary}`}
            >
              <span>🎨 THEME: {theme.name.toUpperCase()}</span>
              <span className="text-[10px]">▼</span>
            </button>

            {themeMenuOpen && (
              <div
                className={`absolute right-0 mt-2 w-48 border ${theme.border} ${theme.cardBg} ${theme.rounded} shadow-2xl py-1 z-50 text-xs`}
              >
                {(Object.keys(THEMES) as ThemeMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onThemeChange(mode);
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-current/10 flex items-center justify-between transition-colors ${currentThemeKey === mode ? `${theme.primary} font-bold` : `${theme.text}/80`}`}
                  >
                    <span>{THEMES[mode].name}</span>
                    {currentThemeKey === mode && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TERMINAL CONTENT CONTAINER */}
      <div
        className="flex-1 flex flex-col p-6 pt-20 overflow-hidden relative z-10"
        onClick={() => inputRef.current?.focus()}
      >
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto space-y-2.5 pt-2 pr-2"
        >
          {logs.map((log) => {
            if (log.type === "input") {
              return (
                <div
                  key={log.id}
                  className={`${theme.primary} font-bold ${theme.glow}`}
                >
                  {log.text}
                </div>
              );
            }
            if (log.type === "help") {
              return <HelpManual key={log.id} theme={theme} />;
            }
            if (log.type === "dexes") {
              const dexList = DEX_REGISTRY[activeChainId!] || [];
              return (
                <div
                  key={log.id}
                  className={`text-xs space-y-1 my-2 ${theme.text}`}
                >
                  {dexList.map((d) => (
                    <div key={d.id}>
                      • {d.name} ({d.type}) - ID:{" "}
                      <span className={`font-bold ${theme.primary}`}>
                        {d.id}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            if (log.type === "createpool") {
              return (
                <CreatePoolWidget key={log.id} {...log.payload} theme={theme} />
              );
            }
            if (log.type === "initialize") {
              return (
                <InitializePoolWidget
                  key={log.id}
                  {...log.payload}
                  theme={theme}
                />
              );
            }
            if (log.type === "addliq") {
              return (
                <AddLiquidityWidget
                  key={log.id}
                  {...log.payload}
                  theme={theme}
                />
              );
            }
            return (
              <div key={log.id} className={`${theme.text}/90`}>
                {log.text}
                {log.component}
              </div>
            );
          })}
        </div>

        <div
          className={`flex items-center mt-4 border-t ${theme.border} pt-3 shrink-0`}
        >
          <span
            className={`mr-2 font-bold ${theme.glow} shrink-0 whitespace-nowrap ${theme.primary}`}
          >
            {mounted && isConnected
              ? `[${activeChainObj ? activeChainObj.name.toUpperCase() : "NO NET"} | ${activeDexObj ? activeDexObj.id.toUpperCase() : "NO DEX"} | ${address?.slice(0, 6)}...] ${theme.promptSymbol}`
              : `${theme.promptSymbol}`}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full bg-transparent outline-none ${theme.text} caret-current ${theme.glow}`}
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
