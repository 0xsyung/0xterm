/**
 * @file scan.ts
 * @description 3-venue arb scan: enumerate pools, quote full-precision, pick
 *              legs A/B (the two pools with the spread) + flash venue C (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain, PublicClient } from "viem";
import { parseAbi } from "viem";
import { DEX_REGISTRY, uniV2PairAbi, uniV3PoolAbi, uniV3FactoryAbi, uniV2FactoryAbi } from "../constants";
import type { DexProtocol } from "../types";

/** V3 fee tiers probed per DEX (a V3 factory holds one pool per pair+fee). */
export const V3_FEE_TIERS = [3000, 500, 100, 10000] as const;

export type ArbVenue = {
  dexId: string;
  name: string;
  isV3: boolean;
  pool: Address;
  factory: Address;
  router: Address;
  fee: number; // V3 tier, 0 for V2
  token0?: Address;
  token1?: Address;
  // The scan pair this venue was built for.
  tokenStartToken: Address;
  tokenOtherToken: Address;
  // V2 reserves (in tokenStart/tokenOther terms)
  reserveS?: bigint;
  reserveO?: bigint;
  // V3 state
  sqrtPriceX96?: bigint;
  liquidity?: bigint;
  /** Proxy for depth: V2 = min(reserveS, reserveO), V3 = liquidity. */
  depth: bigint;
};

export type ArbScanResult = {
  direction: "S2O" | "O2S";
  venueA: ArbVenue;
  venueB: ArbVenue;
  venueC: ArbVenue;
  aIsV3: boolean;
  bIsV3: boolean;
  cIsV3: boolean;
  feeA: number;
  feeB: number;
  feeC: number;
  size: bigint; // tokenStart amount
  gross: bigint; // profit before gas, tokenStart
  gas: bigint; // estimated gas cost in tokenStart
  net: bigint; // gross - gas
};

export type ArbScanDeps = {
  client: PublicClient;
  gasPrice?: bigint; // wei per gas unit
  /** tokenStart base units per 1 native wei (native->tokenStart conversion
   *  for gas). When omitted, gas stays 0 and net == gross. */
  tokenStartPerNative?: bigint;
  fetchImpl?: typeof fetch;
};

export const arbScanError = (
  message: string
): { ok: false; reason: string } => ({ ok: false, reason: message });

export type ArbScanOutcome =
  | { ok: true; result: ArbScanResult }
  | { ok: false; reason: string };

/**
 * Enumerate live pools for a pair across every registered venue on a chain,
 * then build the 3-venue arb shape. Direction is chosen by which round-trip
 * (S->O->S or O->S->O) has the larger gross. The flash venue C is the deepest
 * venue OTHER than the two legs (it must be distinct and unlocked during the
 * legs, so it can never be a leg venue itself).
 */
export async function arbScan(
  chain: Chain,
  tokenStart: Address,
  tokenOther: Address,
  deps: ArbScanDeps
): Promise<ArbScanOutcome> {
  const dexes = DEX_REGISTRY[chain.id];
  if (!dexes || dexes.length < 2)
    return arbScanError("fewer than 2 DEX venues on this chain");

  const { client } = deps;
  const venues: ArbVenue[] = [];
  const probe = async (dex: DexProtocol, fee?: number): Promise<ArbVenue | null> => {
    try {
      if (dex.type === "V2") {
        const pool = (await client.readContract({
          address: dex.factory,
          abi: uniV2FactoryAbi,
          functionName: "getPair",
          args: [tokenStart, tokenOther]
        })) as Address;
        if (!pool || pool === "0x0000000000000000000000000000000000000000") return null;
        const [t0, t1, reserves] = await Promise.all([
          client.readContract({ address: pool, abi: uniV2PairAbi, functionName: "token0" }),
          client.readContract({ address: pool, abi: uniV2PairAbi, functionName: "token1" }),
          client.readContract({ address: pool, abi: uniV2PairAbi, functionName: "getReserves" })
        ]);
        const [r0, r1] = reserves as readonly [bigint, bigint, number];
        const sIs0 = t0.toLowerCase() === tokenStart.toLowerCase();
        return {
          dexId: dex.id,
          name: dex.name,
          isV3: false,
          pool,
          factory: dex.factory,
          router: dex.router,
          fee: 0,
          token0: t0 as Address,
          token1: t1 as Address,
          tokenStartToken: tokenStart,
          tokenOtherToken: tokenOther,
          reserveS: sIs0 ? r0 : r1,
          reserveO: sIs0 ? r1 : r0,
          depth: (sIs0 ? (r0 < r1 ? r0 : r1) : (r1 < r0 ? r1 : r0))
        };
      }
      if (fee === undefined) return null;
      const pool = (await client.readContract({
        address: dex.factory,
        abi: uniV3FactoryAbi,
        functionName: "getPool",
        args: [tokenStart, tokenOther, fee]
      })) as Address;
      if (!pool || pool === "0x0000000000000000000000000000000000000000") return null;
      const [slot0, liq, t0] = await Promise.all([
        client.readContract({ address: pool, abi: uniV3PoolAbi, functionName: "slot0" }),
        client.readContract({ address: pool, abi: parseAbi(["function liquidity() view returns (uint128)"]), functionName: "liquidity" }),
        client.readContract({ address: pool, abi: parseAbi(["function token0() view returns (address)"]), functionName: "token0" })
      ]);
      return {
        dexId: dex.id,
        name: dex.name,
        isV3: true,
        pool,
        factory: dex.factory,
        router: dex.router,
        fee,
        token0: t0 as Address,
        token1: (t0.toLowerCase() === tokenStart.toLowerCase() ? tokenOther : tokenStart) as Address,
        tokenStartToken: tokenStart,
        tokenOtherToken: tokenOther,
        sqrtPriceX96: slot0[0] as bigint,
        liquidity: liq as bigint,
        depth: liq as bigint
      };
    } catch {
      return null;
    }
  };

  for (const dex of dexes) {
    if (dex.type === "V2") {
      const v = await probe(dex);
      if (v) venues.push(v);
    } else {
      for (const fee of V3_FEE_TIERS) {
        const v = await probe(dex, fee);
        if (v) venues.push(v);
      }
    }
  }

  if (venues.length < 2) return arbScanError("fewer than 2 live pools on this chain");

  const testSize = 1000000n; // 1e6 base units

  // The contract is hardcoded S2O: leg A always tokenStart->tokenOther, leg B
  // always tokenOther->tokenStart, flash in tokenStart. The user picks the
  // direction by argument order (arb scan USDC WETH vs WETH USDC).
  const direction = "S2O" as const;
  const outS = venues.map((v) => quote(v, tokenStart, tokenOther, testSize));
  const outO = venues.map((v) => quote(v, tokenOther, tokenStart, testSize));

  // Leg A = venue that pays most tokenOther per tokenStart; leg B = venue that
  // pays most tokenStart per tokenOther.
  const bestS = argmaxBy(outS, venues);
  const bestO = argmaxBy(outO, venues);
  if (!bestS || !bestO) return arbScanError("could not quote venues");

  let venueA = bestS.venue;
  const venueB = bestO.venue;
  if (venueA.pool === venueB.pool) {
    // Same pool can't be both legs. Re-pick the second-best on the weaker side.
    const secondS = argmaxBy(
      outS.filter((_, i) => venues[i].pool !== venueB.pool),
      venues
    );
    if (secondS) venueA = secondS.venue;
  }

  // Flash venue C: the deepest venue that is neither leg A nor leg B.
  const cCandidates = venues.filter(
    (v) => v.pool !== venueA.pool && v.pool !== venueB.pool
  );
  if (cCandidates.length === 0) return arbScanError("no distinct flash venue (need ≥3 pools)");
  const venueC = maxBy(cCandidates, (v) => v.depth);
  if (!venueC) return arbScanError("no flash venue");

  // Size: 1% of the thinner leg's depth.
  const depthA = venueA.depth;
  const depthB = venueB.depth;
  const minDepth = depthA < depthB ? depthA : depthB;
  const size = minDepth / 100n;
  if (size <= 0n) return arbScanError("pools too thin to scan");

  const gross = roundTripGross(venueA, venueB, venueC, tokenStart, tokenOther, size);

  // Gas: ~320k gas for a flash swap + 2 legs, converted to tokenStart when the
  // caller supplies a native price. Without it, gas = 0 and net == gross.
  const gasUnits = 320000n;
  const gasPrice = deps.gasPrice ?? 1000000000n; // 1 gwei default
  const gasCostWei = gasUnits * gasPrice;
  const gas = deps.tokenStartPerNative
    ? (gasCostWei * deps.tokenStartPerNative) / 1n
    : 0n;

  return {
    ok: true,
    result: {
      direction,
      venueA,
      venueB,
      venueC,
      aIsV3: venueA.isV3,
      bIsV3: venueB.isV3,
      cIsV3: venueC.isV3,
      feeA: venueA.fee,
      feeB: venueB.fee,
      feeC: venueC.fee,
      size,
      gross,
      gas,
      net: gross - gas
    }
  };
}

function argmaxBy(values: bigint[], venues: ArbVenue[]): { venue: ArbVenue; out: bigint } | null {
  let best: { venue: ArbVenue; out: bigint } | null = null;
  for (let i = 0; i < venues.length; i++) {
    const out = values[i];
    if (out === undefined) continue;
    if (!best || out > best.out) best = { venue: venues[i]!, out };
  }
  return best;
}

function maxBy<T>(arr: T[], fn: (t: T) => bigint): T | null {
  let best: T | null = null;
  let bestVal = -1n;
  for (const x of arr) {
    const v = fn(x);
    if (v > bestVal) {
      bestVal = v;
      best = x;
    }
  }
  return best;
}

/** Pure V2 exact-output quote (0.3% fee), mirrors the pair's getAmountOut. */
export function v2AmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  return (amountIn * 997n * reserveOut) / (reserveIn * 1000n + amountIn * 997n);
}

const Q96 = 1n << 96n;

function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b) / denom;
}

/** sqrtRatioA->sqrtRatioB amount1 delta (liquidity * (b-a) / Q96), round down. */
function getAmount1Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (hi - lo <= 0n) return 0n;
  return mulDiv(liquidity, hi - lo, Q96);
}

/** sqrtRatioA->sqrtRatioB amount0 delta (L<<96 * (b-a) / b / a), round down. */
function getAmount0Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (hi - lo <= 0n) return 0n;
  return mulDiv(liquidity << 96n, hi - lo, hi) / lo;
}

/**
 * Full-precision exact-input quote within the current tick (single price
 * range). Mirrors the real pool's SwapMath.computeSwapStep for an exact-in
 * swap that does not cross ticks — valid for a scan at small size.
 * @param zeroForOne token0 in (price decreases) → output token1
 */
export function v3AmountOut(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
  feePips: number
): bigint {
  if (amountIn <= 0n || liquidity <= 0n || sqrtPriceX96 <= 0n) return 0n;
  const amountInLessFee = (amountIn * BigInt(1e6 - feePips)) / 1_000_000n;
  if (amountInLessFee <= 0n) return 0n;

  if (zeroForOne) {
    // token0 in: price decreases. newSqrt < current.
    // getNextSqrtPriceFromAmount0RoundingUp(sqrt, L, amount, add=true)
    const numerator1 = liquidity << 96n;
    let next: bigint;
    const product = amountInLessFee * sqrtPriceX96;
    if (product / amountInLessFee === sqrtPriceX96) {
      const denominator = numerator1 + product;
      next = mulDiv(numerator1, sqrtPriceX96, denominator);
    } else {
      next = numerator1 / (numerator1 / sqrtPriceX96 + amountInLessFee);
    }
    if (next > sqrtPriceX96) next = sqrtPriceX96;
    return getAmount1Delta(sqrtPriceX96, next, liquidity);
  }

  // token1 in: price increases. newSqrt > current.
  const quotient =
    amountInLessFee <= (1n << 160n) - 1n
      ? (amountInLessFee << 96n) / liquidity
      : mulDiv(amountInLessFee, Q96, liquidity);
  const next = sqrtPriceX96 + quotient;
  return getAmount0Delta(sqrtPriceX96, next, liquidity);
}

/** Quote tokenIn->tokenOut at full precision against a venue. */
export function quote(
  v: ArbVenue,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): bigint {
  if (amountIn <= 0n) return 0n;
  if (!v.isV3) {
    // V2: the venue stores reserves keyed to the scan pair (tokenStart/tokenOther).
    const reserveIn = tokenIn === v.tokenStartToken ? v.reserveS! : v.reserveO!;
    const reserveOut = tokenOut === v.tokenStartToken ? v.reserveS! : v.reserveO!;
    return v2AmountOut(amountIn, reserveIn, reserveOut);
  }
  // V3: zeroForOne = input token == token0.
  const zeroForOne = tokenIn === v.token0;
  return v3AmountOut(v.sqrtPriceX96!, v.liquidity!, amountIn, zeroForOne, v.fee);
}

/** Round-trip gross for legs (A: S->O, B: O->S) minus the flash fee on C. */
export function roundTripGross(
  venueA: ArbVenue,
  venueB: ArbVenue,
  venueC: ArbVenue,
  tokenStart: Address,
  tokenOther: Address,
  amountIn: bigint
): bigint {
  const out1 = quote(venueA, tokenStart, tokenOther, amountIn);
  const out2 = quote(venueB, tokenOther, tokenStart, out1);
  const flashFee = venueC.isV3
    ? (amountIn * BigInt(venueC.fee)) / 1_000_000n
    : (amountIn * 3n) / 997n;
  return out2 - amountIn - flashFee;
}
