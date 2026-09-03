/**
 * @file autocomplete.ts
 * @description Autocomplete candidate building for terminal commands
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { CustomTokenEntry } from "./types";

const TOKEN_ARG_COMMANDS = [
  "addliq",
  "provideliq",
  "createpool",
  "initialize",
  "initpool",
  "getpool",
  "findpool",
  "price"
];

// Is the argument at this position a token argument for the command?
export const isTokenArgPosition = (
  command: string,
  currentArgIdx: number
): boolean => {
  if (
    command === "swap" &&
    (currentArgIdx === 2 || currentArgIdx === 3)
  )
    return true;
  if (
    TOKEN_ARG_COMMANDS.includes(command) &&
    (currentArgIdx === 1 || currentArgIdx === 2)
  )
    return true;
  if (["balance", "bal"].includes(command) && currentArgIdx === 1)
    return true;
  return false;
};

// Candidate labels for a token argument: a hardcoded common token always
// yields its plain symbol; a custom token yields its plain symbol only when
// it's the sole occurrence of that symbol (otherwise it would be ambiguous),
// and the address-qualified SYM@0xaddr form always (custom shadows hardcoded
// in resolveTokenDetails, but the plain common label remains the user's way to
// reach the hardcoded token).
export const buildTokenArgCandidates = (
  command: string,
  commonSymbols: readonly string[],
  customList: readonly CustomTokenEntry[],
  nativeSymbol?: string
): string[] => {
  const labelSet = new Set<string>();
  const commonSet = new Set(commonSymbols.map((s) => s.toUpperCase()));
  const symCounts = new Map<string, number>();
  for (const t of customList)
    symCounts.set(
      t.symbol.toUpperCase(),
      (symCounts.get(t.symbol.toUpperCase()) || 0) + 1
    );
  for (const sym of commonSymbols) labelSet.add(sym);
  for (const t of customList) {
    const k = t.symbol.toUpperCase();
    // Plain label only when this symbol is unique to a single custom token
    // AND no common token shares it (plain common exists then).
    if (symCounts.get(k) === 1 && !commonSet.has(k)) labelSet.add(t.symbol);
    labelSet.add(
      `${t.symbol}@${t.address.slice(0, 6)}…${t.address.slice(-4)}`
    );
  }
  if (nativeSymbol) labelSet.add(nativeSymbol);
  if (command === "price") {
    labelSet.add("pool");
    labelSet.add("api");
  }
  return Array.from(labelSet);
};
