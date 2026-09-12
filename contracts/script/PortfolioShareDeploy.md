# Deploy PortfolioShare (public portfolio / PnL index)

`PortfolioShare` stores **opt-in public share cards** on-chain (testnets only).
Each owner has one combined card (portfolio + PnL sections as published). A
tiny per-share fee deters spam; fees accumulate in the contract and are swept
to the owner. Cards are **intentionally public** — not encrypted.

**One card per owner.** `share(bytes)` replaces the previous payload for
`msg.sender`. `unshare()` marks the card revoked (`get` returns `active=false`
but keeps the last bytes so `look` can show REVOKED). `latest(count, offset)`
lists owners newest-first (includes revoked). Every share emits
`Shared(owner, ts, contentHash)`; revoke emits `Unshared(owner)`.

**Open publishing.** Anyone may call `share(card)` (paying >= `fee`). There is
no owner gate on writing — only `setFee` / `withdraw` / upgrade are owner-only.
The owner of a card is always `msg.sender` — you cannot share as another
address.

**Upgradeable (UUPS proxy).** `PortfolioShare` runs behind an `ERC1967Proxy`.
The proxy owns the storage; the logic lives in a separate implementation.
Upgrading later only swaps the implementation — the proxy address (and
therefore every card) never moves. Wire the per-chain **proxy** address into
the frontend `SHARE_CONTRACT`. Until a chain is wired, `share` / `look` /
`feed` fail closed with a deploy tip (same posture as `CHAT_FACTORY` before #68).

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

forge script script/DeployPortfolioShare.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --slow
```

This simulates the deployment and prints the predicted contract address + gas.
`--slow` reports gas per call.

## 4. Broadcast for real

```bash
forge script script/DeployPortfolioShare.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --broadcast --slow
```

The terminal will prompt for the keystore password, then submit the deployment
and print `PortfolioShare proxy deployed at: <address>` (the proxy is what
callers use; the implementation address is printed alongside it).

> Same pattern works for other testnets — swap `SEPOLIA_RPC_URL` (e.g. Amoy
> `https://polygon-amoy-bor-rpc.publicnode.com`).

## 5. After a successful broadcast — wire the address into the frontend

Open `src/components/terminal/constants.ts` and fill the placeholder with the
**proxy** address (not the implementation):

```ts
export const SHARE_CONTRACT: Record<number, Address> = {
  // 11155111: '<PortfolioShare proxy address on Sepolia>',
}
```

The frontend reads the per-chain address from here. Until this is done, the
`share` / `look` / `feed` commands surface a clear "no share contract on this
chain" message instead of hitting a wrong-chain address.

## 6. Share + sanity-check

```bash
# share (anyone, pays the fee)
cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
  <PROXY_ADDRESS> "share(bytes)" 0x01 --value 100000000000000

# reads (no gas)
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> \
  "get(address)(bytes,bool,uint256)" <YOUR_ADDRESS>
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> \
  "latest(uint256,uint256)(address[])" 10 0
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> "fee()(uint256)"
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> "owner()(address)"
```

## 7. Operator actions

- **Set the fee** (spam threshold), owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <PROXY_ADDRESS> "setFee(uint256)" <new-fee-wei>
  ```
- **Sweep accumulated fees** to any address, owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <PROXY_ADDRESS> "withdraw(address)" <recipient-address>
  ```
- **Transfer ownership** (e.g. to a multi-sig), owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <PROXY_ADDRESS> "transferOwnership(address)" <new-owner>
  ```
