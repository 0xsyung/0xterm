/**
 * @file gas.ts
 * @description Dig gas number formatting (#40)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/** Format gas as decimal string (tabular-nums friendly). */
export function formatGas(n: bigint | number): string {
  const v = typeof n === "bigint" ? n : BigInt(Math.trunc(n));
  return v.toString();
}

/** One-liner: `[✓] ESTIMATE <fn>  n` */
export function formatGasEstimateLine(fn: string, gas: bigint | number): string {
  return `[✓] ESTIMATE ${fn}  ${formatGas(gas)}`;
}

/** Optional muted wei / native suffix when price known. */
export function formatGasWeiSuffix(
  gas: bigint,
  gasPriceWei?: bigint | null
): string | null {
  if (gasPriceWei == null) return null;
  const wei = gas * gasPriceWei;
  return `· ${wei.toString()} wei`;
}
