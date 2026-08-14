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

type LogItem = {
  id: string;
  type: "input" | "text" | "component";
  content: React.ReactNode;
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
// WIDGET: Create Pool
// ---------------------------------------------------------
function CreatePoolWidget({
  targetChain,
  activeDex,
  tokenA,
  tokenB,
  addrA,
  addrB,
  fee
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
    <div className="my-2 p-4 border border-[#00ff66]/50 bg-[#001105]/90 rounded max-w-lg matrix-glow text-xs space-y-3">
      <div className="flex justify-between items-center border-b border-[#00ff66]/20 pb-2">
        <span className="font-bold text-[#00ff66]">
          DEPLOY POOL CONTRACT [FACTORY]
        </span>
        <span className="text-[#00ff66]/70">
          {activeDex.name} ({activeDex.type})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[#00ff66]/90 font-mono">
        <div>
          <div className="text-[10px] text-[#00ff66]/50">TOKEN A</div>
          <div className="text-base font-bold text-[#00ff66]">
            {tokenA.symbol}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#00ff66]/50">TOKEN B</div>
          <div className="text-base font-bold text-[#00ff66]">
            {tokenB.symbol}
          </div>
        </div>
      </div>

      {activeDex.type === "V3" && (
        <div className="text-[10px] text-[#00ff66]/70 pt-1">
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
              className="text-[10px] underline hover:text-emerald-300 block pt-0.5"
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
            className="px-4 py-1.5 border border-[#00ff66] bg-[#00ff66]/30 hover:bg-[#00ff66]/50 text-[#00ff66] font-bold rounded cursor-pointer matrix-glow transition-all"
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
  fee
}: any) {
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<
    | "check_approval"
    | "approving_a"
    | "approving_b"
    | "initializing"
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
        setStep("initializing");
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

        const sqrtPriceX96 = slot0[0];
        if (sqrtPriceX96 === 0n) {
          const initialSqrtPrice = 79228162514264337593543950336n;
          const initHash = await writeContractAsync({
            address: poolAddress,
            abi: uniV3PoolAbi,
            functionName: "initialize",
            args: [initialSqrtPrice]
          });
          await client.waitForTransactionReceipt({ hash: initHash });
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
    <div className="my-2 p-4 border border-[#00ff66]/50 bg-[#001105]/90 rounded max-w-lg matrix-glow text-xs space-y-3">
      <div className="flex justify-between items-center border-b border-[#00ff66]/20 pb-2">
        <span className="font-bold text-[#00ff66]">
          PROVIDE LIQUIDITY WIDGET
        </span>
        <span className="text-[#00ff66]/70">{activeDex.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[#00ff66]/90 font-mono">
        <div>
          <div className="text-[10px] text-[#00ff66]/50">TOKEN A</div>
          <div className="text-base font-bold text-[#00ff66]">
            {formatUnits(amountAWei, tokenA.decimals)} {tokenA.symbol}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#00ff66]/50">TOKEN B</div>
          <div className="text-base font-bold text-[#00ff66]">
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
              className="text-[10px] underline hover:text-emerald-300 block pt-0.5"
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
            className="px-4 py-2 border border-[#00ff66] bg-[#00ff66]/30 hover:bg-[#00ff66]/50 text-[#00ff66] font-bold rounded cursor-pointer matrix-glow transition-all text-center"
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
        {step === "initializing" && (
          <div className="text-yellow-400 font-bold animate-pulse">
            INITIALIZING V3 PRICE CURVE...
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
  onToggleRain
}: {
  onToggleRain: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeChainId, setActiveChainId] = useState<number | null>(null);
  const [activeDexId, setActiveDexId] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: "1",
      type: "text",
      content: "0xTERM v1.4.0 [FULL ON-CHAIN DEFI SUITE]"
    },
    {
      id: "2",
      type: "text",
      content: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n'
    }
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
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow text-xs">
          <div className="flex justify-between items-center text-[#00ff66]/70 mb-2 border-b border-[#00ff66]/20 pb-1">
            <span className="font-bold">ON-CHAIN POOL LOCATED</span>
            <span>
              {activeDex.name} ({activeDex.type})
            </span>
          </div>
          <div className="text-lg font-bold text-[#00ff66] mb-1">
            {tokenA.symbol} / {tokenB.symbol}
          </div>
          <div className="text-[#00ff66]/90 font-mono select-all p-1 bg-[#00ff66]/10 rounded border border-[#00ff66]/20 text-center my-2">
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
          Error: Provide a valid pool contract address.
        </div>
      );
    }

    try {
      const client = createPublicClient({
        chain: targetChain,
        transport: http()
      });
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
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md matrix-glow text-xs">
          <div className="font-bold text-[#00ff66] mb-1">POOL RESERVES</div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              {sym0}: {formatUnits(reserves[0], dec0)}
            </div>
            <div>
              {sym1}: {formatUnits(reserves[1], dec1)}
            </div>
          </div>
        </div>
      );
    } catch {
      return (
        <div className="text-red-400">
          Failed to read reserves. Ensure it's a V2 pair contract.
        </div>
      );
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
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md text-xs font-bold">
          {formatEther(bal)} {targetChain.nativeCurrency.symbol}
        </div>
      );
    }
    const token = await resolveTokenDetails(queryToken, targetChain);
    if (token.isNative) {
      const bal = await client.getBalance({ address: userAddress });
      return (
        <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md text-xs font-bold">
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
      <div className="my-2 p-3 border border-[#00ff66]/40 bg-[#001105]/80 rounded max-w-md text-xs font-bold">
        {formatUnits(bal as bigint, token.decimals)} {token.symbol}
      </div>
    );
  };

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userLog: LogItem = {
      id: Date.now().toString(),
      type: "input",
      content: `$ ${trimmed}`
    };
    const args = trimmed.split(" ");
    const command = args[0].toLowerCase();

    let outputContent: React.ReactNode;

    switch (command) {
      case "clear":
        setLogs([]);
        return;

      case "help":
        outputContent = (
          <div className="text-xs space-y-2 my-2 text-[#00ff66]/90 max-w-2xl">
            <div className="border-b border-[#00ff66]/20 pb-1 font-bold text-[#00ff66] tracking-wider">
              SYSTEM COMMAND MANUAL
            </div>
            <div className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 pt-1">
              <div className="font-bold text-[#00ff66]">
                network &lt;name|id&gt;
              </div>
              <div>Switch active network</div>
              <div className="font-bold text-[#00ff66]">dexes</div>
              <div>List available DEXes</div>
              <div className="font-bold text-[#00ff66]">dex &lt;id&gt;</div>
              <div>Set active DEX protocol</div>
              <div className="font-bold text-[#00ff66]">
                createpool &lt;tA&gt; &lt;tB&gt; [fee]
              </div>
              <div>Deploy pool contract</div>
              <div className="font-bold text-[#00ff66]">
                getpool &lt;tA&gt; &lt;tB&gt; [fee]
              </div>
              <div>Query pool address</div>
              <div className="font-bold text-[#00ff66]">
                addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
              </div>
              <div>Add liquidity & initialize V3 curve</div>
              <div className="font-bold text-[#00ff66]">
                swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
              </div>
              <div>Execute token swap</div>
              <div className="font-bold text-[#00ff66]">
                pool &lt;address&gt;
              </div>
              <div>Check V2 reserves</div>
              <div className="font-bold text-[#00ff66]">
                balance &lt;token&gt;
              </div>
              <div>Check token balance</div>
            </div>
          </div>
        );
        break;

      case "network":
      case "net":
        if (!args[1]) {
          const currentChainObj = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          );
          outputContent = (
            <div className="text-xs text-[#00ff66]">
              Active Network: {currentChainObj?.name || "None"}
            </div>
          );
        } else if (args[1] === "0") {
          setActiveChainId(null);
          setActiveDexId(null);
          outputContent = (
            <div className="text-yellow-400">Network cleared.</div>
          );
        } else {
          const targetChain = resolveChain(args[1]);
          if (!targetChain)
            outputContent = (
              <div className="text-red-400">Network not recognized.</div>
            );
          else {
            handleChainSwitch(targetChain.id);
            if (isConnected)
              await switchChainAsync({ chainId: targetChain.id }).catch(
                () => {}
              );
            outputContent = (
              <div className="text-emerald-400 font-bold">
                [✓] Network set to {targetChain.name}
              </div>
            );
          }
        }
        break;

      case "dexes":
        if (!activeChainId)
          outputContent = (
            <div className="text-yellow-400">Select network first.</div>
          );
        else {
          const dexList = DEX_REGISTRY[activeChainId] || [];
          outputContent = (
            <div className="text-xs space-y-1 my-2">
              {dexList.map((d) => (
                <div key={d.id}>
                  • {d.name} ({d.type}) - ID:{" "}
                  <span className="font-bold">{d.id}</span>
                </div>
              ))}
            </div>
          );
        }
        break;

      case "dex":
        if (!activeChainId)
          outputContent = (
            <div className="text-yellow-400">Select network first.</div>
          );
        else if (!args[1]) {
          const activeDexObj = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === activeDexId
          );
          outputContent = (
            <div className="text-xs">
              Active DEX: {activeDexObj?.name || "None"}
            </div>
          );
        } else {
          const targetDex = DEX_REGISTRY[activeChainId]?.find(
            (d) => d.id === args[1].toLowerCase()
          );
          if (!targetDex)
            outputContent = <div className="text-red-400">DEX not found.</div>;
          else {
            setActiveDexId(targetDex.id);
            outputContent = (
              <div className="text-emerald-400 font-bold">
                [✓] DEX set to {targetDex.name}
              </div>
            );
          }
        }
        break;

      case "createpool":
        if (!isConnected || !address)
          outputContent = (
            <div className="text-yellow-400">Wallet not connected.</div>
          );
        else if (!activeChainId || !activeDexId)
          outputContent = (
            <div className="text-yellow-400">Select network and DEX first.</div>
          );
        else if (!args[1] || !args[2])
          outputContent = "Usage: createpool <tokenA> <tokenB> [fee]";
        else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Preparing factory payload..."
            }
          ]);
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

            const createWidget = (
              <CreatePoolWidget
                targetChain={targetChain}
                activeDex={activeDex}
                tokenA={tokenA}
                tokenB={tokenB}
                addrA={addrA}
                addrB={addrB}
                fee={fee}
              />
            );
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: createWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            outputContent = `ERROR: ${err.message}`;
          }
        }
        break;

      case "getpool":
      case "findpool":
        if (!activeChainId || !activeDexId)
          outputContent = (
            <div className="text-yellow-400">Select network and DEX first.</div>
          );
        else if (!args[1] || !args[2])
          outputContent = "Usage: getpool <tokenA> <tokenB> [fee]";
        else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Querying factory..."
            }
          ]);
          try {
            const poolWidget = await fetchPoolAddress(
              args[1],
              args[2],
              targetChain,
              activeDex,
              args[3]
            );
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: poolWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            outputContent = `ERROR: ${err.message}`;
          }
        }
        break;

      case "addliq":
      case "provideliq":
        if (!isConnected || !address)
          outputContent = (
            <div className="text-yellow-400">Wallet not connected.</div>
          );
        else if (!activeChainId || !activeDexId)
          outputContent = (
            <div className="text-yellow-400">Select network and DEX first.</div>
          );
        else if (!args[1] || !args[2] || !args[3] || !args[4])
          outputContent = "Usage: addliq <tokenA> <tokenB> <amtA> <amtB> [fee]";
        else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Preparing liquidity widget..."
            }
          ]);
          try {
            const [tokenA, tokenB] = await Promise.all([
              resolveTokenDetails(args[1], targetChain),
              resolveTokenDetails(args[2], targetChain)
            ]);
            const amountAWei = parseUnits(args[3], tokenA.decimals);
            const amountBWei = parseUnits(args[4], tokenB.decimals);
            const fee = args[5] ? parseInt(args[5]) : 3000;

            const addLiqWidget = (
              <AddLiquidityWidget
                userAddress={address}
                targetChain={targetChain}
                activeDex={activeDex}
                tokenA={tokenA}
                tokenB={tokenB}
                amountAWei={amountAWei}
                amountBWei={amountBWei}
                fee={fee}
              />
            );
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: addLiqWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            outputContent = `ERROR: ${err.message}`;
          }
        }
        break;

      case "swap":
        if (!isConnected || !address)
          outputContent = (
            <div className="text-yellow-400">Wallet not connected.</div>
          );
        else if (!activeChainId || !activeDexId)
          outputContent = (
            <div className="text-yellow-400">Select network and DEX first.</div>
          );
        else if (!args[1] || !args[2] || !args[3])
          outputContent = "Usage: swap <amount> <fromToken> <toToken>";
        else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          const activeDex = DEX_REGISTRY[activeChainId].find(
            (d) => d.id === activeDexId
          )!;
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Encoding swap..."
            }
          ]);
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
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: swapWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            outputContent = `ERROR: ${err.message}`;
          }
        }
        break;

      case "balance":
      case "bal":
        if (!isConnected || !address)
          outputContent = (
            <div className="text-yellow-400">Wallet not connected.</div>
          );
        else {
          const targetChain =
            SUPPORTED_CHAINS.find((c) => c.id === activeChainId) ||
            SUPPORTED_CHAINS[5];
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Querying balance..."
            }
          ]);
          try {
            const balWidget = await fetchTokenBalance(
              address,
              targetChain,
              args[1]
            );
            setLogs((prev) => [
              ...prev.slice(0, -1),
              {
                id: Date.now().toString(),
                type: "component",
                content: balWidget
              }
            ]);
            setHistory((prev) => [...prev, trimmed]);
            setHistoryIdx(-1);
            return;
          } catch (err: any) {
            outputContent = `ERROR: ${err.message}`;
          }
        }
        break;

      case "pool":
      case "liquidity":
        if (!activeChainId)
          outputContent = (
            <div className="text-yellow-400">Select network first.</div>
          );
        else if (!args[1]) outputContent = "Usage: pool <poolAddress>";
        else {
          const targetChain = SUPPORTED_CHAINS.find(
            (c) => c.id === activeChainId
          )!;
          setLogs((prev) => [
            ...prev,
            userLog,
            {
              id: (Date.now() + 1).toString(),
              type: "text",
              content: "Reading pool..."
            }
          ]);
          const poolWidget = await fetchOnChainLiquidity(args[1], targetChain);
          setLogs((prev) => [
            ...prev.slice(0, -1),
            {
              id: Date.now().toString(),
              type: "component",
              content: poolWidget
            }
          ]);
          setHistory((prev) => [...prev, trimmed]);
          setHistoryIdx(-1);
          return;
        }
        break;

      case "connect":
        if (isConnected) connect({ connector: connectors[0] });
        else outputContent = "Initiating handshake...";
        break;

      case "disconnect":
        disconnect();
        outputContent = "Disconnected.";
        break;

      case "rain":
        onToggleRain();
        outputContent = "Rain toggled.";
        break;

      default:
        outputContent = `Command not recognized: "${command}". Type "help".`;
    }

    setLogs((prev) => [
      ...prev,
      userLog,
      { id: (Date.now() + 1).toString(), type: "text", content: outputContent }
    ]);
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
      className="relative z-10 w-full h-full p-6 pt-10 flex flex-col cursor-text overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pt-2 pr-2"
      >
        {logs.map((log) => (
          <div
            key={log.id}
            className={
              log.type === "input"
                ? "text-[#00ff66] font-bold matrix-glow"
                : "text-[#00ff66]/90"
            }
          >
            {log.content}
          </div>
        ))}
      </div>

      <div className="flex items-center mt-4 text-[#00ff66] border-t border-[#00ff66]/20 pt-3 shrink-0">
        <span className="mr-2 font-bold matrix-glow shrink-0 whitespace-nowrap">
          {mounted && isConnected
            ? `[${activeChainObj ? activeChainObj.name.toUpperCase() : "NO NET"} | ${activeDexObj ? activeDexObj.id.toUpperCase() : "NO DEX"} | ${address?.slice(0, 6)}...] >`
            : `>`}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-[#00ff66] caret-[#00ff66] matrix-glow"
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
