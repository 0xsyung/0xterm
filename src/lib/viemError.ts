/**
 * @file viemError.ts
 * @description Collapse Viem RPC errors into one-line terminal output
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

// Formats ugly Viem RPC errors into clean terminal output
export const formatViemError = (err: any): string => {
  const msg = err?.shortMessage || err?.message || String(err);
  if (msg.includes("User rejected")) return "Transaction rejected by user.";
  if (msg.includes("insufficient funds"))
    return "Insufficient native balance for transaction.";
  if (msg.includes("INSUFFICIENT_OUTPUT_AMOUNT"))
    return "Slippage tolerance exceeded.";
  if (msg.includes("allowance"))
    return "Insufficient ERC20 allowance. Approve tokens first.";
  if (msg.includes("Failed to fetch"))
    return "Network Error: Failed to fetch. If using on-chain data, your RPC node may be down. If using API, check your ad-blocker.";
  return `ERROR: ${msg.split("\n")[0]}`;
};
