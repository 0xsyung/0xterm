import { parseAbi, type Address, type Chain } from 'viem'
import { mainnet, arbitrum, base, polygon, optimism, sepolia } from 'viem/chains'
import type { DexProtocol, ThemeConfig, ThemeMode } from './types'

export const THEMES: Record<ThemeMode, ThemeConfig> = {
  matrix: {
    name: 'Matrix Style',
    bg: 'bg-black',
    cardBg: 'bg-[#001105]/90',
    text: 'text-[#00ff66]',
    primary: 'text-[#00ff66]',
    border: 'border-[#00ff66]/50',
    glow: 'matrix-glow',
    font: 'font-mono',
    rounded: 'rounded-none',
    promptSymbol: '>',
    headerStyle: 'matrix',
    hasScanlines: true,
    hasGrid: false
  },
  mac: {
    name: 'Mac Terminal',
    bg: 'bg-[#1e1e1e]',
    cardBg: 'bg-[#2d2d2d]/95',
    text: 'text-[#f1f1f1]',
    primary: 'text-[#38bdf8]',
    border: 'border-neutral-700',
    glow: 'shadow-2xl shadow-black/80 backdrop-blur-xl',
    font: 'font-mono',
    rounded: 'rounded-xl',
    promptSymbol: '❯',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  bloomberg: {
    name: 'Bloomberg Terminal',
    bg: 'bg-[#0c0c0c]',
    cardBg: 'bg-[#141414]',
    text: 'text-[#ffb000]',
    primary: 'text-[#ffb000]',
    border: 'border-[#ffb000]/60',
    glow: 'shadow-md shadow-[#ffb000]/20',
    font: 'font-mono tracking-wider uppercase',
    rounded: 'rounded-none',
    promptSymbol: 'BBG>',
    headerStyle: 'bloomberg',
    hasScanlines: false,
    hasGrid: true
  },
  whatsapp: {
    name: 'WhatsApp Style',
    bg: 'bg-[#0b141a]',
    cardBg: 'bg-[#111b21]',
    text: 'text-[#e9edef]',
    primary: 'text-[#00a884]',
    border: 'border-[#00a884]/30',
    glow: 'shadow-lg shadow-black/60',
    font: 'font-sans',
    rounded: 'rounded-2xl',
    promptSymbol: 'WA >',
    headerStyle: 'whatsapp',
    hasScanlines: false,
    hasGrid: false
  }
}

export const SUPPORTED_CHAINS: Chain[] = [mainnet, arbitrum, base, polygon, optimism, sepolia]
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const WRAPPED_NATIVE: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  8453: '0x4200000000000000000000000000000000000006',
  11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
}

export const DEX_REGISTRY: Record<number, DexProtocol[]> = {
  1: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
    { id: 'univ2', name: 'Uniswap V2', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', type: 'V2' },
  ],
  11155111: [
    {
      id: 'univ3',
      name: 'Uniswap V3',
      router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
      factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
      positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52',
      type: 'V3'
    },
    {
      id: 'univ2-test',
      name: 'Uniswap V2 Clone',
      router: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
      factory: '0xF62c03E08ada871A0bEb309762E260a7a6a880E6',
      type: 'V2'
    }
  ]
}

// ABIs
export const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
])

export const uniV2RouterAbi = parseAbi([
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
])

export const uniV3RouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)'
])

export const uniV3PoolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool unlocked)',
  'function initialize(uint160 sqrtPriceX96) external'
])

export const nonfungiblePositionManagerAbi = parseAbi([
  'struct MintParams { address token0; address token1; uint24 fee; int24 tickLower; int24 tickUpper; uint256 amount0Desired; uint256 amount1Desired; uint256 amount0Min; uint256 amount1Min; address recipient; uint256 deadline; }',
  'function mint(MintParams params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
])

export const uniV2FactoryAbi = parseAbi([
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
  'function createPair(address tokenA, address tokenB) returns (address pair)'
])

export const uniV3FactoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
  'function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)'
])

export const uniV2PairAbi = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
])

export const COMMON_TOKENS: Record<number, Record<string, { address: Address; decimals: number; symbol: string; name: string }>> = {
  11155111: { ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Sepolia Ethereum' } }
}

export const resolveChain = (query?: string): Chain | undefined => {
  if (!query) return undefined
  const q = query.toLowerCase().trim()
  return SUPPORTED_CHAINS.find(c => c.id.toString() === q || c.name.toLowerCase() === q || (q === 'mainnet' && c.id === 1))
}