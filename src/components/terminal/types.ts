/**
 * @file types.ts
 * @description Shared type definitions
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type React from 'react'
import type { Address, Chain } from 'viem'

export type ThemeMode = 'matrix' | 'mac' | 'bloomberg' | 'whatsapp'

export type LogEntry = {
  id: string
  type: 'input' | 'text' | 'help' | 'dexes' | 'networks' | 'createpool' | 'initialize' | 'getpool' | 'addliq' | 'swap' | 'balance' | 'pool' | 'portfolio' | 'chat' | 'billboard' | 'component'
  text?: string
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
  headerStyle: 'matrix' | 'mac' | 'bloomberg' | 'whatsapp'
  hasScanlines: boolean
  hasGrid: boolean
}