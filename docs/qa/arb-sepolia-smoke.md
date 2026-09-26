# QA: `arb` Sepolia smoke (3-venue atomic arb)

In-repo runnable plan for [#108](https://github.com/0xsyung/0xterm-app/issues/108).
Execute against **`main`** (or a preview built from it). Do **not** treat this as a mainnet ship checklist — mainnet `arb run` stays gated until audit.

| Field | Value |
| --- | --- |
| Network | Sepolia (`11155111`) |
| Executor | `0xD18023E5B8Db53ab21D3D7ee93680bb3DAC3f4fb` |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Venues | `univ3` factory `0x0227628f3F023bb0B980b67D528571c95c6DaC1c` · `univ2-custom` factory `0x26F278090C6C954c302FEfA7e60d0DD2779C1f85` |

Related: allowances smoke is [#109](https://github.com/0xsyung/0xterm-app/issues/109) (Part 2 on the same tracking issue). Do **not** start [#112](https://github.com/0xsyung/0xterm-app/issues/112) deploy work from this plan.

---

## Setup

1. Switch the app network to **Sepolia**.
2. Connect a wallet with testnet ETH (gas), WETH, and USDC (addresses above).
3. Confirm the RPC answers `eth_call` (public or Alchemy).

---

## Test sequence

Record **actual** terminal output next to each expected result. Capture screenshots for the scan widget and the run confirm widget.

### 1. `arb venues`

**Expected:** both Sepolia venues, e.g.

- `V3 univ3 · Uniswap V3 · factory 0x0227…1c1c`
- `V2 univ2-custom · Uniswap V2 (Custom) · factory 0x26F2…1f85`

**Fail:** `[!] arb.no_venues` / `arb.unsupported` if fewer than 2 venues.

### 2. `arb scan WETH USDC`

**Expected:** ARB scan widget with:

- 3 distinct venues (leg A, leg B, flash C) — typically the V2 pair plus V3 pools on fee tiers 100 / 500 / 3000 / 10000
- `size` ~1% of the thinner leg’s depth (often ~0.0005 WETH / ~5e14 base units)
- `gross`, `gas`, and `net`

**Important:** on testnet, round-trip **net is usually negative**. That means “don’t run”, not a product bug. A positive `net` is a bonus (optional pool re-seed in contracts; not required to pass scan/sim).

**Fail:** `[!] arb.bad_rpc` (unreachable RPC or fewer than 2 live pools).

Try both argument orders: `arb scan WETH USDC` and `arb scan USDC WETH` pick different legs/flash (S2O direction).

### 3. `arb scan USDC WETH` (direction flip)

**Expected:** scan OK with `tokenStart = USDC`; `size` in USDC (6 decimals).

### 4. `arb sim` (after a scan on the same chain)

**Expected:** `ARB SIM OK — <gross> tokenStart gross. minProfit <x>. Ready to run.`

**Fail (no prior scan):** `[!] arb.gone — the arb quote is gone. Rescan before running.`

`minProfit` uses gas × `pricePerTokenStart` × 2 buffer; `pricePerTokenStart` comes from `getTokenPriceUsd` (no longer hard-coded 1:1).

### 5. `arb run` (after `arb sim`, wallet connected, Sepolia)

**Expected:**

- Confirm widget: pair, venues (`A → B · flash C`), `size`, `minProfit`, executor, flash source
- **CONFIRM** → wallet prompt → broadcast → `ARB RUN <symbol> — tx 0x… profit to wallet.` when net stays positive through confirm
- Profit (+ tokenOther dust) lands in the wallet after flash repay

**Cases:**

| Case | Expected |
| --- | --- |
| Wallet not connected | `Wallet not connected.` |
| Non-Sepolia (e.g. mainnet) | `[!] arb.mainnet_disabled — arb run is disabled on mainnet until the audit gate. Use a testnet (sepolia).` |
| Stale scan / chain switch | `[!] arb.gone` |
| On-chain revert (e.g. `NO_PROFIT` after spread vanishes) | Atomic unwind — no residual balances in executor or pools; wallet only loses gas |
| User cancels confirm | `ARB RUN cancelled.` |

Only attempt a live **CONFIRM** when scan `net` is positive (or after an intentional seed that creates one). Negative-net scans still pass steps 1–4 without broadcasting.

### 6. Error-path matrix

| Command | Expected |
| --- | --- |
| `arb` with no subcommand on a chain with &lt;2 venues | `arb.no_venues` / `arb.unsupported` |
| `arb scan` with 0–1 token args | `Usage: arb scan <tokenStart> <tokenOther>` |
| `arb scan WETH WETH` | `Tokens must be different.` |
| `arb sim` / `arb run` before any scan | `arb.gone` |
| Dead RPC + `arb scan` | `arb.bad_rpc` |

---

## Known caveats (not bugs)

- Negative `net` on Sepolia is the normal outcome; treat as “don’t run”.
- Gas estimate is a fixed ~320k gas for sizing `minProfit`.
- V3 quotes within the current tick; keep scan sizes small so large sizes don’t under-quote across ticks.
- At most one V2 venue per run (one V2 pool per pair per factory); the other two legs are V3 tiers.
- Mainnet has **no** `ARB_EXECUTOR` entry; `arb run` refuses with `arb.mainnet_disabled` (or related gate) until audit.

---

## Pass criteria

- [ ] `arb venues` lists both Sepolia venues
- [ ] `arb scan WETH USDC` and `arb scan USDC WETH` each produce a 3-venue widget with distinct A/B/C pools
- [ ] `arb sim` returns `ARB SIM OK`
- [ ] `arb run` confirm widget renders; when net is positive, tx lands and profit+dust arrive
- [ ] `NO_PROFIT`-style reverts unwind atomically
- [ ] §6 error paths match the `[!] arb.*` / usage strings above
- [ ] venues / scan / sim need no wallet; run needs wallet + Sepolia
- [ ] Mainnet `arb run` stays disabled

---

## Deliverables (QA)

Comment on [#108](https://github.com/0xsyung/0xterm-app/issues/108) with:

1. Per-step actual output (paste)
2. Screenshots: scan widget + run confirm
3. Pass/fail against the matrix
4. New bug issues for unexpected behavior (exact command + output)

Engineer unit coverage for scan/sim/errors/calldata already lives under `src/components/terminal/arb/*.test.ts`. This doc is the **manual** Sepolia E2E harness; it does not replace those tests.
