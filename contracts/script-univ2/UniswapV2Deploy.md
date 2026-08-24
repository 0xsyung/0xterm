# Deploy 0xterm's Uniswap V2 fork (factory + SimpleRouter)

Sepolia has **no canonical Uniswap V2** (only V3 on mainnet/Sepolia). 0xterm
deploys its own V2 fork and points the frontend registry at it — the same idea
as the `script-univ3/` Amoy fork.

The full `UniswapV2Router02` exceeds the EIP-170 contract size limit
(26887 > 24576 bytes), so the router deployed here is the repo's compact
**SimpleRouter** (`contracts/src/SimpleRouter.sol`, ~7KB). It provides
`swapExactTokensForTokens` + `addLiquidity` — exactly what the frontend's V2
path uses. Native→token swaps (`swapExactETHForTokens`) are **not** supported.

## What the scripts deploy (two isolated steps)

1. `DeployUniswapV2Factory.s.sol` (solc 0.5.16) — `UniswapV2Factory`; deployer
   (`msg.sender`) becomes `feeToSetter`.
2. `DeployUniswapV2Router.s.sol` (solc 0.6.6) — `SimpleRouter(factory, WETH9)`,
   where `WETH9` is Sepolia's canonical WETH.

Each step pins a different solc (v2-core `=0.5.16`, v2-periphery `=0.6.6`), so
the scripts are isolated in `[profile.univ2]` and share no build.

## 1. Prerequisites

- Foundry installed (`foundryup`).
- A Sepolia RPC URL. A public one:
  `https://ethereum-sepolia-rpc.publicnode.com` (or an Alchemy/Infura key you have).
  (`https://rpc.sepolia.org` is frequently down.)
- A funded Sepolia account. Free test ETH: https://faucet.quicknode.com/ethereum/sepolia
  or https://www.alchemy.com/faucets/ethereum-sepolia.

## 2. Store your deployer key with a Foundry keystore

Never pass `--private-key` on the CLI (it lands in shell history). Use a
keystore instead — the key is encrypted at rest with a password you type
interactively.

Import an existing private key:

```bash
cast wallet import <account-name> --private-key <YOUR_PRIVATE_KEY> --unsafe-password ''
# you will be prompted for a password to encrypt the keystore; remember it
```

Verify:

```bash
cast wallet list
cast wallet address <account-name>
```

## 3. Deploy the factory

```bash
cd contracts
export RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export ACCOUNT=<account-name>        # your keystore account name
export SENDER=<YOUR_ADDRESS>         # cast wallet address $ACCOUNT

# dry-run first (no broadcast, no gas)
FOUNDRY_PROFILE=univ2 forge script \
  script-univ2/DeployUniswapV2Factory.s.sol:DeployUniswapV2Factory \
  --rpc-url $RPC_URL --account $ACCOUNT --sender $SENDER

# broadcast for real (prompts for keystore password)
FOUNDRY_PROFILE=univ2 forge script \
  script-univ2/DeployUniswapV2Factory.s.sol:DeployUniswapV2Factory \
  --rpc-url $RPC_URL --account $ACCOUNT --sender $SENDER --broadcast
```

The factory address is in
`broadcast/DeployUniswapV2Factory.s.sol/11155111/run-latest.json`
(`contractAddress` for `UniswapV2Factory`). Save it:

```bash
export FACTORY=0x...
```

## 4. Deploy the router (pointed at that factory)

```bash
# dry-run
FOUNDRY_PROFILE=univ2 forge script \
  script-univ2/DeployUniswapV2Router.s.sol:DeployUniswapV2Router \
  --rpc-url $RPC_URL --account $ACCOUNT --sender $SENDER \
  --sig "run(address)" $FACTORY

# broadcast for real
FOUNDRY_PROFILE=univ2 forge script \
  script-univ2/DeployUniswapV2Router.s.sol:DeployUniswapV2Router \
  --rpc-url $RPC_URL --account $ACCOUNT --sender $SENDER \
  --sig "run(address)" $FACTORY --broadcast
```

The router address is in
`broadcast/DeployUniswapV2Router.s.sol/11155111/run-latest.json`
(`contractAddress` for `SimpleRouter`). Save it:

```bash
export ROUTER=0x...
```

> The `WETH9` constant in the router script is hardcoded to Sepolia's WETH
> (`0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`). On a different chain you
> must change it before deploying.

## 5. Wire the addresses into the frontend

Open `src/components/terminal/constants.ts` and update the `univ2-custom`
entry in `DEX_REGISTRY[11155111]`:

```ts
{
  id: 'univ2-custom',
  name: 'Uniswap V2 (Custom)',
  router: '<ROUTER address>',
  factory: '<FACTORY address>',
  type: 'V2',
},
```

## 6. Sanity-check on Sepolia

```bash
# Factory: feeToSetter should be your deployer address
cast call --rpc-url $RPC_URL $FACTORY "feeToSetter()(address)"

# Router wiring: factory() and WETH() must match the deployed values
cast call --rpc-url $RPC_URL $ROUTER "factory()(address)"
cast call --rpc-url $RPC_URL $ROUTER "WETH()(address)"
```
