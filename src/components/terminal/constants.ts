/**
 * @file constants.ts
 * @description Shared constants and ABIs
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  sepolia,
  arbitrumSepolia,
  baseSepolia,
  polygonAmoy,
  optimismSepolia
} from 'viem/chains'
import { namehash, parseAbi, type Address, type Chain } from 'viem'
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
    promptSymbol: '>',
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
    font: 'font-mono tracking-wider',
    rounded: 'rounded-none',
    promptSymbol: '>',
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
    promptSymbol: '>',
    headerStyle: 'whatsapp',
    hasScanlines: false,
    hasGrid: false
  },
  oneDark: {
    name: 'One Dark Pro',
    bg: 'bg-[#282c34]',
    cardBg: 'bg-[#21252b]/95',
    text: 'text-[#abb2bf]',
    primary: 'text-[#61afef]',
    border: 'border-[#528bff]/40',
    glow: 'shadow-lg shadow-black/50',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  dracula: {
    name: 'Dracula',
    bg: 'bg-[#282a36]',
    cardBg: 'bg-[#21222c]/95',
    text: 'text-[#f8f8f2]',
    primary: 'text-[#bd93f9]',
    border: 'border-[#bd93f9]/40',
    glow: 'shadow-lg shadow-[#bd93f9]/10',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  monokai: {
    name: 'Monokai',
    bg: 'bg-[#272822]',
    cardBg: 'bg-[#1e1f1c]/95',
    text: 'text-[#f8f8f2]',
    primary: 'text-[#a6e22e]',
    border: 'border-[#a6e22e]/40',
    glow: 'shadow-lg shadow-black/50',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'matrix',
    hasScanlines: false,
    hasGrid: false
  },
  githubDark: {
    name: 'GitHub Dark',
    bg: 'bg-[#0d1117]',
    cardBg: 'bg-[#161b22]/95',
    text: 'text-[#e6edf3]',
    primary: 'text-[#58a6ff]',
    border: 'border-[#30363d]',
    glow: 'shadow-lg shadow-black/50',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  tokyoNight: {
    name: 'Tokyo Night',
    bg: 'bg-[#1a1b26]',
    cardBg: 'bg-[#16161e]/95',
    text: 'text-[#a9b1d6]',
    primary: 'text-[#7aa2f7]',
    border: 'border-[#7aa2f7]/40',
    glow: 'shadow-lg shadow-[#7aa2f7]/10',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    bg: 'bg-[#1e1e2e]',
    cardBg: 'bg-[#181825]/95',
    text: 'text-[#cdd6f4]',
    primary: 'text-[#89b4fa]',
    border: 'border-[#89b4fa]/40',
    glow: 'shadow-lg shadow-[#f5c2e7]/5',
    font: 'font-mono',
    rounded: 'rounded-xl',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  nord: {
    name: 'Nord',
    bg: 'bg-[#2e3440]',
    cardBg: 'bg-[#3b4252]/95',
    text: 'text-[#d8dee9]',
    primary: 'text-[#88c0d0]',
    border: 'border-[#4c566a]',
    glow: 'shadow-lg shadow-black/40',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'bloomberg',
    hasScanlines: false,
    hasGrid: false
  },
  gruvbox: {
    name: 'Gruvbox Dark',
    bg: 'bg-[#282828]',
    cardBg: 'bg-[#32302f]/95',
    text: 'text-[#ebdbb2]',
    primary: 'text-[#fabd2f]',
    border: 'border-[#fabd2f]/40',
    glow: 'shadow-lg shadow-black/50',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'bloomberg',
    hasScanlines: false,
    hasGrid: false
  },
  ristretto: {
    name: 'Ristretto (Omarchy default)',
    bg: 'bg-[#2c2525]',
    cardBg: 'bg-[#352d2d]/95',
    text: 'text-[#e6d9db]',
    primary: 'text-[#f38d70]',
    border: 'border-[#f38d70]/40',
    glow: 'shadow-lg shadow-[#f38d70]/10',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  rosePine: {
    name: 'Rose Pine (Omarchy)',
    bg: 'bg-[#191724]',
    cardBg: 'bg-[#1f1d2e]/95',
    text: 'text-[#e0def4]',
    primary: 'text-[#ebbcba]',
    border: 'border-[#ebbcba]/40',
    glow: 'shadow-lg shadow-[#eb6f92]/10',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  kanagawa: {
    name: 'Kanagawa (Omarchy)',
    bg: 'bg-[#1f1f28]',
    cardBg: 'bg-[#16161d]/95',
    text: 'text-[#dcd7ba]',
    primary: 'text-[#7e9cd8]',
    border: 'border-[#7e9cd8]/40',
    glow: 'shadow-lg shadow-[#938aa9]/10',
    font: 'font-mono',
    rounded: 'rounded-lg',
    promptSymbol: '>',
    headerStyle: 'mac',
    hasScanlines: false,
    hasGrid: false
  },
  vantablack: {
    name: 'Vantablack (Omarchy)',
    bg: 'bg-[#000000]',
    cardBg: 'bg-[#0a0a0a]/95',
    text: 'text-[#e5e5e5]',
    primary: 'text-[#6ba8ff]',
    border: 'border-[#2a2a2a]',
    glow: 'shadow-lg shadow-black',
    font: 'font-mono',
    rounded: 'rounded-md',
    promptSymbol: '>',
    headerStyle: 'matrix',
    hasScanlines: false,
    hasGrid: false
  }
}

export const SUPPORTED_CHAINS: Chain[] = [
  mainnet,
  sepolia,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  polygon,
  polygonAmoy,
  optimism,
  optimismSepolia
]

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const WRAPPED_NATIVE: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  421614: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
  8453: '0x4200000000000000000000000000000000000006',
  84532: '0x4200000000000000000000000000000000000006',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  // 80002 (Polygon Amoy): no official Uniswap V3 — 0xterm deploys its own fork
  // (see contracts/script-univ3/DeployUniswapV3Fork.s.sol). Fill this and
  // DEX_REGISTRY[80002] after the fork is broadcast.
  // 80002: '<WETH9 from fork deploy>',
  10: '0x4200000000000000000000000000000000000006',
  11155420: '0x4200000000000000000000000000000000000006'
}

// DexScreener `pairs[].chainId` values keyed by 0xterm chain id. viem's
// `chain.name` ("Arbitrum One", "Polygon") doesn't match DexScreener's slugs
// ("arbitrum", "polygon-pos"), so matching must go through this map.
export const DEXSCREENER_CHAIN: Record<number, string> = {
  1: "ethereum",
  11155111: "ethereum", // Sepolia — DexScreener folds testnets under their L1
  42161: "arbitrum",
  421614: "arbitrum",
  8453: "base",
  84532: "base",
  137: "polygon-pos",
  80002: "polygon-pos",
  10: "optimism",
  11155420: "optimism"
}

export const DEX_REGISTRY: Record<number, DexProtocol[]> = {
  1: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
    { id: 'univ2', name: 'Uniswap V2', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', type: 'V2' },
  ],
  11155111: [
    { id: 'univ3', name: 'Uniswap V3', router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52', type: 'V3' },
    { id: 'univ2-custom', name: 'Uniswap V2 (Custom)', router: '0x4C2c0AE850490522585a1d04Df7d00f7807750AA', factory: '0x26F278090C6C954c302FEfA7e60d0DD2779C1f85', type: 'V2' },
  ],
  42161: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  421614: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x101F443B4d1b059569D643917553c771E1b9663E', factory: '0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e', positionManager: '0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65', type: 'V3' },
  ],
  8453: [
    { id: 'univ3', name: 'Uniswap V3', router: '0x2626664c2603336E57B271c5C0b26F421741e481', factory: '0x33128a8f17eb86e9a38f321d5dadf5f14c000109', positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', type: 'V3' },
  ],
  84532: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', positionManager: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2', type: 'V3' },
  ],
  137: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  // 80002 (Polygon Amoy): no official Uniswap V3 — 0xterm deploys its own
  // fork via contracts/script-univ3/DeployUniswapV3Fork.s.sol. Until it is
  // broadcast, Amoy has NO DEX: `swap`/`createpool`/`price pool` surface a
  // clear "no DEX on this chain" error instead of stale wrong-chain addresses.
  // Fill this with the fork's router/factory after deploy:
  // 80002: [
  //   { id: 'univ3', name: 'Uniswap V3 (Amoy fork)', router: '<router>', factory: '<factory>', positionManager: '<npm>', type: 'V3' },
  // ],
  10: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  11155420: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', factory: '0x8CE191193D15ea94e11d327b4c7ad8bbE520f6aF', positionManager: '0xdA75cEf1C93078e8b736FCA5D5a30adb97C8957d', type: 'V3' },
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
  'function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) view returns (uint amountOut)',
])

// ERC-165 / ERC-721 interface detection (for the `is` command)
export const erc165Abi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
])

// Full ERC-20 standard interface (6 core functions)
export const erc20FullAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

// ERC-721 core interface (ownerOf is the key discriminator vs ERC-20)
export const erc721Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
])

// ERC-165 interface IDs
export const INTERFACE_ID_ERC165 = '0x01ffc9a7'
export const INTERFACE_ID_ERC20 = '0x36372b07' // XOR of the 6 ERC-20 core function selectors
export const INTERFACE_ID_ERC721 = '0x80ac58cd' // XOR of the 9 ERC-721 function selectors

export const COMMON_TOKENS: Record<number, Record<string, { address: Address; decimals: number; symbol: string; name: string }>> = {
  // Ethereum Mainnet
  1: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Ethereum' },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, symbol: 'DAI', name: 'Dai Stablecoin' },
    LINK: { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, symbol: 'LINK', name: 'Chainlink Token' },
    cbBTC: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, symbol: 'cbBTC', name: 'Coinbase Wrapped BTC' },
    cbETH: { address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18, symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH' }
  },

  // Base
  8453: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Base Ether' },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    cbBTC: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, symbol: 'cbBTC', name: 'Coinbase Wrapped BTC' },
    cbETH: { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18, symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH' },
    cbDOGE: { address: '0xcbD06E5A2B0C65597161de254AA074E489dEb510', decimals: 8, symbol: 'cbDOGE', name: 'Coinbase Wrapped DOGE' },
    cbXRP: { address: '0xcb585250f852C6c6bf90434AB21A00f02833a4af', decimals: 6, symbol: 'cbXRP', name: 'Coinbase Wrapped XRP' },
    cbLTC: { address: '0xcb17C9Db87B595717C857a08468793f5bAb6445F', decimals: 8, symbol: 'cbLTC', name: 'Coinbase Wrapped LTC' },
    cbADA: { address: '0xcbADA732173e39521CDBE8bf59a6Dc85A9fc7b8c', decimals: 6, symbol: 'cbADA', name: 'Coinbase Wrapped ADA' },
    cbMEGA: { address: '0xcb111E6A2a3bde90856D299d61341ac302167D23', decimals: 18, symbol: 'cbMEGA', name: 'Coinbase Wrapped MEGA' }
  },

  // Arbitrum One
  42161: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Arbitrum Ether' },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    'USDC.E': { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, symbol: 'USDC.E', name: 'Bridged USDC' },
    cbBTC: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, symbol: 'cbBTC', name: 'Coinbase Wrapped BTC' },
    cbETH: { address: '0x1DEBd73E752bEaf79865fd6446b0c970eAe7732f', decimals: 18, symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH' }
  },

  // Polygon PoS
  137: {
    POL: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'POL', name: 'Polygon POL' },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    'USDC.E': { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, symbol: 'USDC.E', name: 'Bridged USDC' },
    cbETH: { address: '0x4b4327db1600B8b1440163f667e199ceF35385F5', decimals: 18, symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH (FX)' }
  },

  // Optimism
  10: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Optimism Ether' },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    cbETH: { address: '0xaddE742901a50bB9506b4c2114eE90bFA78aF2A9', decimals: 18, symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH' }
  },

  // Ethereum Sepolia
  11155111: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Sepolia Ethereum' },
    WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    USDT: { address: '0x7169D38820dfd117C3fA1f22a697dBA58d90ba06', decimals: 6, symbol: 'USDT', name: 'Tether USD' },
    DAI: { address: '0x776b6fC2eD15D6Bb5Fc32e0c89DE68683118c62A', decimals: 18, symbol: 'DAI', name: 'Dai Stablecoin' },
    LINK: { address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', decimals: 18, symbol: 'LINK', name: 'Chainlink Token' }
  },

  // Arbitrum Sepolia
  421614: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Arbitrum Sepolia Ether' },
    USDC: { address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', decimals: 6, symbol: 'USDC', name: 'USD Coin' }
  },

  // Base Sepolia
  84532: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Base Sepolia Ether' },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH', name: 'Wrapped Ether' },
    USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
    USDT: { address: '0x4dbd49a3ae90aa5f13091ccd29a896cbb5b171eb', decimals: 18, symbol: 'USDT', name: 'Tether USD' }
  },

  // Polygon Amoy
  80002: { POL: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'POL', name: 'Polygon Amoy POL' } },

  // Optimism Sepolia
  11155420: {
    ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Optimism Sepolia Ether' },
    USDC: { address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', decimals: 6, symbol: 'USDC', name: 'USD Coin' }
  }
}

// Chat — encrypted 1:1 messaging (testnets only). The contract stores
// only `iv + ciphertext` blobs; messages are decrypted in the browser.
// Fill with the deployed address from contracts/script/ChatDeploy.md.
export const CHAT_CONTRACT: Record<number, Address> = {
  11155111: '0x694eA7938238037731bD0F3a3aE9F6FD2C2097ce',
}

// 0xterm's own ENS registry + resolver (testnets only) — name ↔ address on
// the ACTIVE chain. Mainnet keeps the canonical ENS (resolved via viem's v1
// universal resolver). Fill with the deployed proxy address from
// contracts/script/EnsDeploy.md.
export const ENS_CONTRACT: Record<number, Address> = {
  11155111: '0x1C9104434DecEDCCa8C02Ec2c324aaFdE5f5e06f',
}

export const ensRegistryAbi = parseAbi([
  'function setRecord(bytes32 node, address who, string name)',
  'function clearRecord(bytes32 node, address who)',
  'function addr(bytes32 node) view returns (address)',
  'function nameOfAddr(address who) view returns (string)',
])

// Public notice board (testnets only) — anyone posts plaintext, anyone reads
// all posts. Fill with the deployed proxy address from
// contracts/script/BillboardDeploy.md.
export const BILLBOARD_CONTRACT: Record<number, Address> = {
  11155111: '0xe5128c8E5FA33a5d1dd4E230EAF017a313c34701',
}

export const billboardAbi = parseAbi([
  'function post(string content) payable returns (uint256 id)',
  'function getLatest(uint256 count, uint256 offset) view returns ((address author, uint256 timestamp, string content)[] posts)',
  'function postCount() view returns (uint256)',
  'function fee() view returns (uint256)',
])

export const chatAbi = parseAbi([
  'function sendMessage(address to, bytes12 iv, bytes calldata senderKey, bytes calldata ciphertext) payable returns (bytes32 id)',
  'function getThread(address to, address from, uint256 start, uint256 count) view returns ((address from, uint256 timestamp, bytes12 iv, bytes senderKey, bytes ciphertext)[] msgs)',
  'function threadCount(address to, address from) view returns (uint256)',
  'function getSenders(address to) view returns (address[])',
  'function setPublicKey(bytes key)',
  'function getPublicKey(address who) view returns (bytes)',
  'function fee() view returns (uint256)',
  'function owner() view returns (address)',
  'function setFee(uint256 newFee)',
  'function withdraw(address to)',
  'function transferOwnership(address newOwner)',
])

export const resolveChain = (query?: string): Chain | undefined => {
  if (!query) return undefined
  const q = query.toLowerCase().trim()

  if (['op', 'op mainnet', 'optimism'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 10)
  }
  if (['op sep', 'op sepolia', 'optimism sepolia'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 11155420)
  }
  if (['arb', 'arbitrum', 'arbitrum one'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 42161)
  }
  if (['arb sep', 'arb sepolia', 'arbitrum sepolia'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 421614)
  }
  if (['matic', 'polygon', 'polygon mainnet'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 137)
  }
  if (['amoy', 'polygon amoy', 'polygon sep', 'polygon sepolia'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 80002)
  }
  if (['base', 'base mainnet'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 8453)
  }
  if (['base sep', 'base sepolia'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 84532)
  }
  if (['eth', 'mainnet', 'ethereum'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 1)
  }
  if (['sepolia', 'eth sep', 'ethereum sepolia'].includes(q)) {
    return SUPPORTED_CHAINS.find(c => c.id === 11155111)
  }

  return SUPPORTED_CHAINS.find(c => c.id.toString() === q || c.name.toLowerCase().includes(q))
}

export const IMPLEMENTATION_ADDRESSES: Record<number, { erc20: Address; erc721: Address }> = {
  // Ethereum Mainnet
  1: {
    erc20: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    erc721: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D" // Bored Ape Yacht Club
  },

  // Arbitrum One
  42161: {
    erc20: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC
    erc721: "0x6325439389E0797Ab35752B4F43a14C004f22A9c" // Smol Brains
  },


  // Sepolia Testnet
  11155111: {
    erc20: "0x7f837e0F0D3127AdfEEC592EB08578099A4e0501", // USDC
    erc721: "0x7a3159290ba6672c3cc5741f6bcdf5261266cd15" // Commonly used Sepolia Mock NFT (VFToken)
  },

  // Arbitrum Sepolia
  421614: {
    erc20: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC (Testnet)
    erc721: "0x0152305ef563f964029ef12f10944ed4bb41f68d" // Standard Sepolia NFT Proxy
  },

  // Base Sepolia
  84532: {
    erc20: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC (Testnet)
    erc721: "0x075eb9dc52177aa3492e1d26f0fde3d729625d2f" // Standard Base Sepolia Mock NFT
  }
};