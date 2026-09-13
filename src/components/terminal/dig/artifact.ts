/**
 * @file artifact.ts
 * @description Dig compile artifact summary + pin helpers (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type DigAbiItem = {
  type?: string;
  name?: string;
  inputs?: unknown[];
  outputs?: unknown[];
  stateMutability?: string;
};

export type DigContractArtifact = {
  name: string;
  solcVersion: string;
  creationBytecode: string;
  runtimeBytecode: string;
  opcodes: string;
  abi: DigAbiItem[];
  sourceMap?: string;
  deployedSourceMap?: string;
};

export type DigCompileSummary = {
  solcVersion: string;
  contractNames: string[];
  errorCount: number;
  warningCount: number;
};

/** Byte length of hex bytecode (strips 0x). */
export function bytecodeByteLength(hex: string): number {
  const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (!h) return 0;
  return Math.ceil(h.length / 2);
}

export function abiFunctionCount(abi: DigAbiItem[]): number {
  return abi.filter((x) => x && x.type === "function").length;
}

export function abiFunctionNames(abi: DigAbiItem[]): string[] {
  return abi
    .filter((x) => x && x.type === "function" && x.name)
    .map((x) => x.name as string);
}

/** Compact pin title: `NAME · nB · n fn` */
export function digArtifactPinTitle(artifact: DigContractArtifact): string {
  const nB = bytecodeByteLength(artifact.runtimeBytecode || artifact.creationBytecode);
  const nFn = abiFunctionCount(artifact.abi || []);
  return `${artifact.name} · ${nB}B · ${nFn} fn`;
}

/** Stable pin dedupe key for dig-artifact. */
export function digArtifactPinKey(artifact: DigContractArtifact): string {
  return `dig-artifact:${artifact.name}:${artifact.solcVersion}`;
}

export function summarizeCompile(
  solcVersion: string,
  artifacts: DigContractArtifact[],
  errorCount: number,
  warningCount: number
): DigCompileSummary {
  return {
    solcVersion,
    contractNames: artifacts.map((a) => a.name),
    errorCount,
    warningCount
  };
}

export function formatCompileSummary(s: DigCompileSummary): string {
  const names =
    s.contractNames.length > 0 ? s.contractNames.join(", ") : "(none)";
  const lines = [
    `[dig] solc ${s.solcVersion}`,
    `contracts: ${names}`
  ];
  if (s.errorCount > 0) lines.push(`errors: ${s.errorCount}`);
  if (s.warningCount > 0) lines.push(`warnings: ${s.warningCount}`);
  if (s.errorCount === 0 && s.contractNames.length > 0) {
    lines.push("ok — dig bytecode | dig abi | dig artifact");
  }
  return lines.join("\n");
}

/** Pick contract by name (case-insensitive); default = first. */
export function pickArtifact(
  artifacts: DigContractArtifact[],
  name?: string | null
): DigContractArtifact | null {
  if (!artifacts.length) return null;
  if (!name) return artifacts[0];
  const q = name.toLowerCase();
  return artifacts.find((a) => a.name.toLowerCase() === q) || null;
}
