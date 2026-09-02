/**
 * @file types.ts
 * @description Shared type definitions
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type React from 'react'
import type { Address, Chain } from 'viem'

export type HeaderStyle =
  | 'crt'
  | 'bloomberg'
  | 'macintosh'
  | 'ibm'
  | 'dos'
  | 'teletype'
  | 'void'

export type ThemeMode =
  | 'matrix'
  | 'amber'
  | 'ibm3270'
  | 'bloomberg'
  | 'macintosh'
  | 'dos'
  | 'teletype'
  | 'void'

export type LogEntry = {
  id: string
  type: 'input' | 'text' | 'help' | 'dexes' | 'networks' | 'createpool' | 'initialize' | 'getpool' | 'addliq' | 'swap' | 'balance' | 'pool' | 'portfolio' | 'chat' | 'billboard' | 'component'
  text?: string
  // Render plain text in the theme's warn color (failures, read errors).
  warn?: boolean
  payload?: any
  component?: React.ReactNode
  title?: string
  // structured render data for component-kind logs (price) so they re-render
  // against the live theme in both the console and the pinned panel.
  componentData?: any
}

export type DexProtocol = {
  id: string
  name: string
  router: Address
  factory: Address
  positionManager?: Address
  type: 'V2' | 'V3'
}

// User-registered token. Stored as a flat list per chain so multiple tokens can
// share a symbol (e.g. several custom ERC20 "USDC" on a testnet). `id` is the
// stable uniqueness key ("c_<lowercase address>"); address is unique per chain.
export type CustomTokenEntry = {
  id: string
  address: Address
  symbol: string
  name: string
  decimals?: number // ERC-20 only
  tokenType?: 'erc20' | 'erc721'
  isNative: boolean
}

export type CustomTokensMap = Record<number, CustomTokenEntry[]>

export type PinnedManifest = {
  id: string;
  kind: string; // log.type
  title: string;
  chainId?: number;
  contract?: string;
  token?: string;
  filterType?: string;
  peer?: string;
  count?: number;
  // price-pin params (re-run on refresh / rehydrate)
  source?: string; // "pool" | "api"
  dexId?: string;
  payload?: any;
  minimized?: boolean;
  // transient: the live React element for component-kind pins (price/swap/
  // pool/deploy/export). Not serialized — stripped before persist/export.
  component?: React.ReactNode;
  // transient: structured data to re-render a component-kind pin against the
  // current theme (so it follows theme switches). Not serialized.
  componentData?: any;
}

export type ThemeConfig = {
  name: string
  bg: string
  cardBg: string
  text: string
  primary: string
  border: string
  glow: string
  font: string
  rounded: string
  promptSymbol: string
  headerStyle: HeaderStyle
  hasScanlines: boolean
  hasGrid: boolean
  warn: string
  muted: string
  phosphor: string
  scanlineAlpha: string
  gridColor: string
}
