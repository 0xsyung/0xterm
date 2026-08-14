import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, base, polygon, optimism, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, arbitrum, base, polygon, optimism, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [sepolia.id]: http(),
  },
})