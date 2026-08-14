import type React from 'react'
import type { Address, Chain } from 'viem'

export type ThemeMode = 'matrix' | 'mac' | 'bloomberg' | 'whatsapp'

export type LogEntry = {
  id: string
  type: 'input' | 'text' | 'help' | 'dexes' | 'networks' | 'createpool' | 'initialize' | 'getpool' | 'addliq' | 'swap' | 'balance' | 'pool' | 'component'
  text?: string
  payload?: any
  component?: React.ReactNode
}

export type DexProtocol = {
  id: string
  name: string
  router: Address
  factory: Address
  positionManager?: Address
  type: 'V2' | 'V3'
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