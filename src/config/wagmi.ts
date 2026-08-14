import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, base, polygon, optimism, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = '5b2bbdbe0deaa155601b8aaa96f96aaf'

export const config = createConfig({
  chains: [mainnet, arbitrum, base, polygon, optimism, sepolia],
  connectors: [
    injected(), // Handles desktop extensions & mobile in-app browsers
    walletConnect({ projectId }), // Enables mobile wallet deep-linking & QR codes for Safari/Chrome
  ],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [sepolia.id]: http(),
  },
})