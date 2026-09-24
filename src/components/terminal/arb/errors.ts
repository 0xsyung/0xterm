/**
 * @file errors.ts
 * @description arb error → copy resolver (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { ARB_ERROR, type ArbErrorCode } from "./constants";

export function arbErrorText(
  code: ArbErrorCode,
  param?: string
): string {
  const entry = ARB_ERROR[code];
  if (typeof entry === "function") return (entry as (p: string) => string)(param || "");
  return entry;
}
