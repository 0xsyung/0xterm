/**
 * @file pnlMath.ts
 * @description Shared mark-to-quote P/L math for PortfolioWidget + PnlWidget (#23)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type PnlHoldingLike = {
  chainId: number;
  symbol: string;
  type: "native" | "erc20";
  address?: string;
  balance: string;
  priceUsd: number | null;
  valueUsd: number | null;
  isTestnet: boolean;
};

export type SnapshotHoldingLike = {
  price: number | null;
  balance: string;
};

export type ComputePnlResult = {
  netUsd: number | null;
  pnlPrice: number | null;
  pnlBalance: number | null;
  snapNav: number | null;
};

/** Stable snapshot key — matches portfolio / snapshot writer. */
export const snapKeyForHolding = (h: {
  chainId: number;
  symbol: string;
  type: "native" | "erc20";
  address?: string;
}): string => {
  if (h.type === "erc20" && h.address) {
    return `${h.chainId}:${h.address.toLowerCase()}`;
  }
  return `${h.chainId}:${h.symbol}`;
};

/**
 * Mainnet-only totals matching PortfolioWidget formulas:
 * - P/L (PRICE) = Σ (now.valueUsd − snap.price × currentBalance)
 * - BAL Δ = Σ (now.valueUsd − snap.price × snap.balance)
 * - snapNav = Σ (snap.price × snap.balance) over mainnet keys we can mark
 * Missing snap.price → row skipped (not NaN). Zero Δ is finite.
 */
export const computePnl = (
  holdings: PnlHoldingLike[],
  snapshot?: Record<string, SnapshotHoldingLike> | null
): ComputePnlResult => {
  const hasSnapshot = !!snapshot && Object.keys(snapshot).length > 0;
  let netUsd = 0;
  let anyNet = false;
  let pnlPrice = 0;
  let anyPrice = false;
  let pnlBalance = 0;
  let anyBal = false;
  let snapNav = 0;
  let anySnap = false;

  for (const h of holdings) {
    if (h.isTestnet) continue;

    if (h.valueUsd !== null && Number.isFinite(h.valueUsd)) {
      netUsd += h.valueUsd;
      anyNet = true;
    }

    if (!hasSnapshot || !snapshot) continue;
    const snap = snapshot[snapKeyForHolding(h)];
    if (!snap || snap.price === null || !Number.isFinite(snap.price)) continue;

    const curBal = parseFloat(h.balance);
    const snapBal = parseFloat(snap.balance);
    if (!Number.isFinite(curBal)) continue;

    if (h.valueUsd !== null && Number.isFinite(h.valueUsd)) {
      pnlPrice += h.valueUsd - snap.price * curBal;
      anyPrice = true;
    }

    if (
      h.valueUsd !== null &&
      Number.isFinite(h.valueUsd) &&
      Number.isFinite(snapBal)
    ) {
      pnlBalance += h.valueUsd - snap.price * snapBal;
      anyBal = true;
    }

    if (Number.isFinite(snapBal)) {
      snapNav += snap.price * snapBal;
      anySnap = true;
    }
  }

  return {
    netUsd: anyNet ? netUsd : null,
    pnlPrice: anyPrice ? pnlPrice : null,
    pnlBalance: anyBal ? pnlBalance : null,
    snapNav: anySnap ? snapNav : null
  };
};

/** % on PRICE P/L when snapNav > 0, else null (UI shows muted —). */
export const pnlPricePct = (
  pnlPrice: number | null,
  snapNav: number | null
): number | null => {
  if (pnlPrice === null || snapNav === null || !(snapNav > 0)) return null;
  if (!Number.isFinite(pnlPrice)) return null;
  return (pnlPrice / snapNav) * 100;
};
