# Deploy 0xterm ENS (name ↔ address registry, testnets)

`EnsRegistry` is 0xterm's own ENS for testnets: a minimal name ↔ address
registry + resolver. ENS names resolve on the **active chain** the terminal is
switched to — mainnet uses the canonical ENS (via viem's v1 universal
resolver); testnets use this contract, so a name like `alice.eth` can be
registered here and used in `chat alice.eth "hi"` / reverse-labelled in
`inbox`.

**Forward + reverse.** A record maps `namehash(name) → address` (`addr(node)`)
and `address → name` (`nameOfAddr(who)`). `setRecord(node, who, name)` sets
both directions atomically; `clearRecord(node, who)` removes both.

**Open registration, one name per address.** Anyone may register any name via
`setRecord(node, who, name)`, but each address holds **at most one name** —
setting a new name frees the previous one, and names are reassignable. From the
terminal this is `ens set <name>` / `ens clear`.

**Upgradeable (UUPS proxy).** `EnsRegistry` runs behind an `ERC1967Proxy`. The
proxy owns the storage (all records); the logic lives in a separate
implementation contract. Upgrading later only swaps the implementation via
`UpgradeENS.s.sol` — the proxy address (and therefore every record) never
moves. The proxy address differs per chain, so wire the per-chain proxy
address into the frontend `ENS_CONTRACT`.

## 1. Prerequisites

- Foundry installed (`foundryup`).
- A testnet RPC URL (e.g. Sepolia).
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

forge script script/DeployENS.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --slow
```

This simulates the deployment and prints the predicted contract address + gas.
`--slow` reports gas per call.

## 4. Broadcast for real

```bash
forge script script/DeployENS.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --broadcast --slow
```

The terminal will prompt for the keystore password, then submit the deployment
and print `ENS proxy deployed at: <address>` (the proxy is what callers use;
the implementation address is printed alongside it).

> Same pattern works for other testnets — swap `SEPOLIA_RPC_URL`.

## 5. After a successful broadcast — wire the address into the frontend

Open `src/components/terminal/constants.ts` and fill the placeholder with the
**proxy** address (not the implementation):

```ts
export const ENS_CONTRACT: Record<number, Address> = {
  // 11155111: '<ENS proxy address on Sepolia>',
}
```

The frontend reads the per-chain address from here. Until this is done, the
`chat <name.eth>` / `inbox` commands surface a clear "no ENS on this chain"
message instead of hitting a wrong-chain address.

## 6. Register names (open to anyone)

Registration is OPEN — any user may call `setRecord` for any name, but each
address can hold **at most one name** (setting a new name frees the previous
one), and names are reassignable. The primary path is the terminal command:

```text
ens set alice.eth      # register alice.eth → your connected wallet
ens alice.eth          # resolve it
ens clear              # remove your own current name (no params)
```

Directly via cast (any account — no owner needed):

```bash
# namehash is a keccak-based label hash chain; for a single label + .eth TLD:
NODE=$(cast namehash alice.eth)
cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
  <PROXY_ADDRESS> "setRecord(bytes32,address,string)" $NODE <ALICE_ADDRESS> alice.eth
```

Sanity-check (reads, no gas):

```bash
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> \
  "addr(bytes32)(address)" $(cast namehash alice.eth)
cast call --rpc-url $SEPOLIA_RPC_URL <PROXY_ADDRESS> \
  "nameOfAddr(address)(string)" <ALICE_ADDRESS>
```

Remove a record:

```bash
cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
  <PROXY_ADDRESS> "clearRecord(bytes32,address)" $(cast namehash alice.eth) <ALICE_ADDRESS>
```

> NOTE: `cast namehash` computes the standard ENS namehash for a full name
> (including `.eth`). The contract keys records by exactly that value, so pass
> the output of `cast namehash <full-name>` verbatim. Multi-label names
> (`bob.alice.eth`) hash differently than single labels — use the full name.

## 7. Upgrade the logic (records are preserved)

Deploy a new implementation and point the proxy at it. Storage (all records)
lives in the proxy, so nothing is lost.

```bash
forge script script/UpgradeENS.s.sol:UpgradeENS \
  --rpc-url $SEPOLIA_RPC_URL \
  --account <account-name> \
  --sender <OWNER_ADDRESS> \
  --sig "run(address)" <PROXY_ADDRESS> \
  --broadcast --slow
```

Dry-run first (omit `--broadcast`) to see the new implementation address and
gas. Only the proxy owner (the `--sender` that deployed) may run this.

> **IMPORTANT — storage layout.** The new implementation must keep the same
> storage slots for all existing state (`addrOf`, `nameOf`): keep those fields
> first, in the same order, and only *append* new state at the end. Reordering
> or renaming existing fields silently corrupts records.

## 8. Operator actions

- **Transfer ownership** (e.g. to a multi-sig), owner only:
  ```bash
  cast send --rpc-url $SEPOLIA_RPC_URL --account <account-name> \
    <PROXY_ADDRESS> "transferOwnership(address)" <new-owner>
  ```
