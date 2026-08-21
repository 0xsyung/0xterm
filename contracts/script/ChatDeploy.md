# Deploy Chat (encrypted 1:1 messaging)

`Chat` stores encrypted messages on-chain (testnets only). The contract
never sees plaintext — it holds `iv + ciphertext` blobs. A tiny per-message
fee deters spam; fees accumulate in the contract and are swept to the owner.

## 1. Prerequisites

- Foundry installed (`foundryup`).
- A testnet RPC URL (e.g. Sepolia, Polygon Amoy).
- A funded testnet account — Sepolia ETH from a faucet, e.g.
  https://sepoliafaucet.com or https://faucet.quicknode.com/ethereum/sepolia.

## 2. Store your deployer key with a Foundry keystore

Never pass `--private-key` on the CLI (it lands in shell history). Use a
keystore — the key is encrypted at rest with a password you type interactively.

```bash
cast wallet import <account-name> --private-key <YOUR_PRIVATE_KEY> --unsafe-password ''
# you will be prompted for a password to encrypt the keystore; remember it
```

Verify:

```bash
cast wallet list
cast wallet address <account-name>
```

## 3. Dry-run first (no broadcast, no gas)

```bash
cd contracts
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

forge script script/DeployChat.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --slow
```

This simulates the deployment and prints the predicted contract address + gas.
`--slow` reports gas per call.

## 4. Broadcast for real

```bash
forge script script/DeployChat.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --broadcast --slow
```

The terminal will prompt for the keystore password, then submit the deployment
and print `Chat deployed at: <address>`.

> Same pattern works for other testnets — swap `SEPOLIA_RPC_URL` (e.g. Amoy
> `https://polygon-amoy-bor-rpc.publicnode.com`).

## 5. After a successful broadcast — wire the address into the frontend

Open `src/components/terminal/constants.ts` and fill the placeholder:

```ts
export const CHAT_CONTRACT: Record<number, Address> = {
  // 11155111: '<Chat address on Sepolia>',
}
```

The frontend reads the per-chain address from here. Until this is done, the
`chat` / `inbox` commands surface a clear "no chat contract on this chain"
message instead of hitting a wrong-chain address.

## 6. Sanity-check

```bash
cast call --rpc-url $SEPOLIA_RPC_URL <contract> "fee()(uint256)"
cast call --rpc-url $SEPOLIA_RPC_URL <contract> "owner()(address)"
```

## 7. Operator actions

- **Set the fee** (spam threshold), owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <contract> "setFee(uint256)" <new-fee-wei>
  ```
- **Sweep accumulated fees** to any address, owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <contract> "withdraw(address)" <recipient-address>
  ```
- **Transfer ownership** (e.g. to a multi-sig), owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <contract> "transferOwnership(address)" <new-owner>
  ```
