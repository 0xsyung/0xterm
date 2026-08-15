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
import { parseAbi, type Address, type Chain } from 'viem'
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
    font: 'font-mono tracking-wider uppercase',
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
  80002: '0x0000000000000000000000000000000000000000',
  10: '0x4200000000000000000000000000000000000006',
  11155420: '0x4200000000000000000000000000000000000006'
}

export const DEX_REGISTRY: Record<number, DexProtocol[]> = {
  1: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
    { id: 'univ2', name: 'Uniswap V2', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', type: 'V2' },
  ],
  11155111: [
    { id: 'univ3', name: 'Uniswap V3', router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52', type: 'V3' },
    { id: 'univ2-custom', name: 'Uniswap V2 (Custom)', router: '0xb67a8a0E69919cfE4486B777EFcE1d461783cFB9', factory: '0xb59cf62962B5740694166DCa3a178e3e5383ce40', type: 'V2' },
  ],
  42161: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  421614: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', factory: '0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e', positionManager: '0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65', type: 'V3' },
  ],
  8453: [
    { id: 'univ3', name: 'Uniswap V3', router: '0x262664982669b3F4E6441a1F6f4E6c7C0113f993', factory: '0x33128a8f17eb86e9a38f321d5dadf5f14c000109', positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', type: 'V3' },
  ],
  84532: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', positionManager: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2', type: 'V3' },
  ],
  137: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  80002: [
    { id: 'univ3', name: 'Uniswap V3 (Amoy)', router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', type: 'V3' },
  ],
  10: [
    { id: 'univ3', name: 'Uniswap V3', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', type: 'V3' },
  ],
  11155420: [
    { id: 'univ3', name: 'Uniswap V3 (Sepolia)', router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', type: 'V3' },
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
  11155111: { ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Sepolia Ethereum' } },
  421614: { ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Arbitrum Sepolia Ether' } },
  84532: { ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Base Sepolia Ether' } },
  80002: { POL: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'POL', name: 'Polygon Amoy POL' } },
  11155420: { ETH: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH', name: 'Optimism Sepolia Ether' } }
}

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
    erc20: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle USDC (Testnet)
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