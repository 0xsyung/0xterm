# Deploy Chat (encrypted 1:1 messaging)

`Chat` stores encrypted messages on-chain (testnets only). The contract
never sees plaintext — it holds `iv + ciphertext` blobs. A tiny per-message
fee deters spam; fees accumulate in the contract and are swept to the owner.

**Per-thread storage.** History is keyed `inbox[recipient][sender]` — one
conversation per `(recipient, sender)` pair, so reading a thread is a single
`getThread` call (no scanning the whole inbox). `getSenders(recipient)` lists
the distinct senders so the UI can enumerate all conversations. Every message
also emits `MessageSent(from, to, id, ts, len)`.

**Upgradeable (UUPS proxy).** `Chat` runs behind an `ERC1967Proxy`. The proxy
owns the storage (all chat history); the logic lives in a separate
implementation contract. Upgrading later only swaps the implementation via
`UpgradeChat.s.sol` — the proxy address (and therefore every message) never
moves. The proxy address differs per chain, so wire the per-chain proxy
address into the frontend `CHAT_CONTRACT`.

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
and print `Chat proxy deployed at: <address>` (the proxy is what callers use;
the implementation address is printed alongside it).

> Same pattern works for other testnets — swap `SEPOLIA_RPC_URL` (e.g. Amoy
> `https://polygon-amoy-bor-rpc.publicnode.com`).

## 5. After a successful broadcast — wire the address into the frontend

Open `src/components/terminal/constants.ts` and fill the placeholder with the
**proxy** address (not the implementation):

```ts
export const CHAT_CONTRACT: Record<number, Address> = {
  // 11155111: '<Chat proxy address on Sepolia>',
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

## 7. Upgrade the logic (history is preserved)

Deploy a new implementation and point the proxy at it. Storage (all chat
history) lives in the proxy, so nothing is lost.

```bash
forge script script/UpgradeChat.s.sol:UpgradeChat \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <OWNER_ADDRESS> \
  --sig "run(address)" <PROXY_ADDRESS> \
  --broadcast --slow
```

Dry-run first (omit `--broadcast`) to see the new implementation address and
gas. Only the proxy owner (the `--sender` that deployed) may run this.

> **IMPORTANT — storage layout.** The new implementation must keep the same
> storage slots for all existing state (`fee`, `inbox`, `sendersOf`,
> `messageCount`): keep those fields first, in the same order, and only
> *append* new state at the end. Reordering or renaming existing fields
> silently corrupts history.

## 8. Operator actions

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
