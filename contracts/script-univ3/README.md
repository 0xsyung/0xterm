# Deploy 0xterm's Uniswap V3 fork on Polygon Amoy (chainId 80002)

Amoy has **no official Uniswap V3** (verified on-chain; it predates the
Universal Router deploy-addresses repo). So 0xterm deploys its own minimal V3
fork and points the frontend registry at it.

## What the script deploys (in order)

1. `WETH9` — wrapped native (fills the fork's WETH9 slot)
2. `UniswapV3Factory` — pool factory (owner = deployer; enables fees 500 / 3000 / 10000)
3. `NoopTokenDescriptor` — LP-NFT metadata stub (empty `tokenURI`; keeps the NPM
   functional while avoiding the heavy NFTDescriptor/NFTSVG libs that fail the
   solc 0.7.6 "stack too deep" compile)
4. `SwapRouter` — (factory, WETH9)
5. `NonfungiblePositionManager` — (factory, WETH9, descriptor)

The script emits `Deployed(weth9, factory, descriptor, router, positionManager)`
with all five addresses.

## 1. Prerequisites

- Foundry installed (`foundryup`).
- An Amoy RPC URL. A public one:
  `https://polygon-amoy-bor-rpc.publicnode.com`
- A funded Amoy account. Get free test POL from a faucet, e.g.
  https://faucet.polygon.technology (Amoy tab).

## 2. Store your deployer key safely with a Foundry keystore

Never pass `--private-key` on the CLI (it lands in shell history). Use a
keystore instead — the key is encrypted at rest with a password you type
interactively.

Create the keystore (imports an existing private key):

```bash
cast wallet import <account-name> --private-key <YOUR_PRIVATE_KEY> --unsafe-password ''
# you will be prompted for a password to encrypt the keystore; remember it
```

You can generate a fresh keystore (new random key) instead:

```bash
cast wallet new # prints a fresh address + private key; fund the address, then import as above
```

Verify:

```bash
cast wallet list
cast wallet address <account-name>
```

## 3. Dry-run first (no broadcast, no gas)

```bash
cd contracts
export AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com

FOUNDRY_PROFILE=univ3 forge script \
  script-univ3/DeployUniswapV3Fork.s.sol:DeployUniswapV3Fork \
  --rpc-url $AMOY_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --slow
```

This simulates the full sequence on Amoy and prints the predicted deployer
address + gas. `--slow` reports gas per call.

## 4. Broadcast for real

```bash
FOUNDRY_PROFILE=univ3 forge script \
  script-univ3/DeployUniswapV3Fork.s.sol:DeployUniswapV3Fork \
  --rpc-url $AMOY_RPC_URL \
  --account <account-name> \
  --sender <YOUR_ADDRESS> \
  --broadcast --slow
```

The terminal will prompt for the keystore password, then submit the five
transactions and print the `Deployed(...)` event with the final addresses.

> If a step fails (e.g. out of gas), copy the failing `creation` bytecode from
> `broadcast/DeployUniswapV3Fork.s.sol/80002/run-latest.json` and re-send it:
> `cast send --rpc-url $AMOY_RPC_URL --account <account-name> --create <bytecode>`.
> The script is idempotent per contract only up to the failure point — re-run
> from scratch and reuse the already-deployed addresses if you prefer.

## 5. After a successful broadcast — wire the addresses into the frontend

Open `src/components/terminal/constants.ts` and fill the two commented
placeholders with the real addresses from the `Deployed(...)` event:

- `WRAPPED_NATIVE[80002]` = the `weth9` address
- `DEX_REGISTRY[80002]` = the fork entry:

```ts
80002: [
  {
    id: 'univ3',
    name: 'Uniswap V3 (Amoy fork)',
    router: '<router address>',
    factory: '<factory address>',
    positionManager: '<positionManager address>',
    type: 'V3',
  },
],
```

Until this is done, Amoy has no DEX: `swap` / `createpool` / `price pool`
return a clear "No DEX available on this chain" message instead of hitting
wrong-chain addresses.

## 6. Sanity-check on Amoy

```bash
# Factory owner + fees enabled
cast call --rpc-url $AMOY_RPC_URL <factory> "owner()(address)"
cast call --rpc-url $AMOY_RPC_URL <factory> "feeAmountTickSpacing(uint24)(int24)" 3000

# WETH9
cast call --rpc-url $AMOY_RPC_URL <weth9> "symbol()(string)"
```
