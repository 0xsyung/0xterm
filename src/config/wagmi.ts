import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, base, polygon, optimism, sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, optimismSepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = '5b2bbdbe0deaa155601b8aaa96f96aaf'

export const config = createConfig({
  chains: [
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
  ],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      metadata: {
        name: '0xTERM',
        description: 'Full On-Chain DeFi Terminal Suite',
        url: 'https://0xsyung.github.io/0xterm/',
        icons: ['https://avatars.githubusercontent.com/u/37784886'] // Optional app icon fallback
      }
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
    [optimism.id]: http(),
    [optimismSepolia.id]: http(),
  },
})