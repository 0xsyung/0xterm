# Deploy Billboard (public notice board)

`Billboard` stores **public plaintext posts** on-chain (testnets only). No
encryption, no target user — anyone can post, and anyone can list/view every
post. A tiny per-post fee deters spam; fees accumulate in the contract and are
swept to the owner.

**Append-only ledger.** Posts live in a single `posts[]` array, so ordering is
natural (newest = last element) and the whole board is enumerable via
`getLatest(count, offset)` — newest-first, paginated. `postCount` gives the
total. Every post emits `Posted(author, ts, len)`.

**Open posting.** Anyone may call `post(content)` (paying >= `fee`). There is no
owner gate on writing — only `setFee` / `withdraw` / upgrade are owner-only.

**Upgradeable (UUPS proxy).** `Billboard` runs behind an `ERC1967Proxy`. The
proxy owns the storage (all posts); the logic lives in a separate
implementation contract. Upgrading later only swaps the implementation via
`UpgradeBillboard.s.sol` — the proxy address (and therefore every post) never
moves. The proxy address differs per chain, so wire the per-chain proxy
address into the frontend `BILLBOARD_CONTRACT`.

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

forge script script/DeployBillboard.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --slow
```

This simulates the deployment and prints the predicted contract address + gas.
`--slow` reports gas per call.

## 4. Broadcast for real

```bash
forge script script/DeployBillboard.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --broadcast --slow
```

The terminal will prompt for the keystore password, then submit the deployment
and print `Billboard proxy deployed at: <address>` (the proxy is what callers
use; the implementation address is printed alongside it).

> Same pattern works for other testnets — swap `SEPOLIA_RPC_URL` (e.g. Amoy
> `https://polygon-amoy-bor-rpc.publicnode.com`).

## 5. After a successful broadcast — wire the address into the frontend

Open `src/components/terminal/constants.ts` and fill the placeholder with the
**proxy** address (not the implementation):

```ts
export const BILLBOARD_CONTRACT: Record<number, Address> = {
  // 11155111: '<Billboard proxy address on Sepolia>',
}
```

The frontend reads the per-chain address from here. Until this is done, the
`board` command surfaces a clear "no billboard on this chain" message instead
of hitting a wrong-chain address.

## 6. Post + sanity-check

```bash
# post (anyone, pays the fee)
cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
  <PROXY_ADDRESS> "post(string)" "gm world" --value 100000000000000

# reads (no gas)
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> "postCount()(uint256)"
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> \
  "getLatest(uint256,uint256)((address,uint256,string)[])" 5 0
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> "fee()(uint256)"
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> "owner()(address)"
```

## 7. Upgrade the logic (posts are preserved)

Deploy a new implementation and point the proxy at it. Storage (all posts)
lives in the proxy, so nothing is lost.

```bash
forge script script/UpgradeBillboard.s.sol:UpgradeBillboard \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <OWNER_ADDRESS> \
  --sig "run(address)" <PROXY_ADDRESS> \
  --broadcast --slow
```

Dry-run first (omit `--broadcast`) to see the new implementation address and
gas. Only the proxy owner (the `--sender` that deployed) may run this.

> **IMPORTANT — storage layout.** The new implementation must keep the same
> storage slots for all existing state (`fee`, `posts`, `postCount`): keep those
> fields first, in the same order, and only *append* new state at the end.
> Reordering or renaming existing fields silently corrupts the ledger.

## 8. Operator actions

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
