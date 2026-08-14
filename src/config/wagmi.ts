import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, base, polygon, optimism, sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, optimismSepolia } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

const projectId = '5b2bbdbe0deaa155601b8aaa96f96aaf'

// 1. Define supported networks with explicit AppKitNetwork tuple typing
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet as AppKitNetwork,
  sepolia as AppKitNetwork,
  arbitrum as AppKitNetwork,
  arbitrumSepolia as AppKitNetwork,
  base as AppKitNetwork,
  baseSepolia as AppKitNetwork,
  polygon as AppKitNetwork,
  polygonAmoy as AppKitNetwork,
  optimism as AppKitNetwork,
  optimismSepolia as AppKitNetwork
]

// 2. Set up Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
})

// 3. Initialize AppKit Modal
const metadata = {
  name: '0xTERM',
  description: 'Full On-Chain DeFi Terminal Suite',
  url: 'https://0xsyung.github.io/0xterm/',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  themeMode: 'dark',
  features: {
    analytics: false
  }
})

// Export the wagmi config for WagmiProvider
export const config = wagmiAdapter.wagmiConfig