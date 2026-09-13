/**
 * @file opcodes.ts
 * @description Runtime opcode dump formatting (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type OpcodeRow = {
  pc: number;
  mnemonic: string;
  immediate?: string;
};

/**
 * Parse solc `evm.deployedBytecode.opcodes` string
 * ("PUSH1 0x80 PUSH1 0x40 MSTORE ...") into rows with PCs.
 */
export function parseOpcodeString(opcodes: string): OpcodeRow[] {
  const tokens = opcodes.trim().split(/\s+/).filter(Boolean);
  const rows: OpcodeRow[] = [];
  let pc = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^0x/i.test(tok)) {
      // orphan immediate — attach to previous if possible
      if (rows.length > 0 && !rows[rows.length - 1].immediate) {
        rows[rows.length - 1].immediate = tok;
      }
      continue;
    }
    const mnemonic = tok.toUpperCase();
    const pushMatch = mnemonic.match(/^PUSH(\d+)$/);
    let immediate: string | undefined;
    let size = 1;
    if (pushMatch) {
      const n = Number(pushMatch[1]);
      size = 1 + n;
      if (i + 1 < tokens.length && /^0x/i.test(tokens[i + 1])) {
        immediate = tokens[++i];
      }
    }
    rows.push({ pc, mnemonic, immediate });
    pc += size;
  }
  return rows;
}

/** Disassemble raw runtime hex when opcodes string is missing. */
export function disassembleHex(hex: string): OpcodeRow[] {
  const h = (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase();
  const rows: OpcodeRow[] = [];
  let i = 0;
  const OP: Record<number, string> = {
    0x00: "STOP",
    0x01: "ADD",
    0x02: "MUL",
    0x03: "SUB",
    0x04: "DIV",
    0x05: "SDIV",
    0x06: "MOD",
    0x07: "SMOD",
    0x08: "ADDMOD",
    0x09: "MULMOD",
    0x0a: "EXP",
    0x0b: "SIGNEXTEND",
    0x10: "LT",
    0x11: "GT",
    0x12: "SLT",
    0x13: "SGT",
    0x14: "EQ",
    0x15: "ISZERO",
    0x16: "AND",
    0x17: "OR",
    0x18: "XOR",
    0x19: "NOT",
    0x1a: "BYTE",
    0x1b: "SHL",
    0x1c: "SHR",
    0x1d: "SAR",
    0x20: "SHA3",
    0x30: "ADDRESS",
    0x31: "BALANCE",
    0x32: "ORIGIN",
    0x33: "CALLER",
    0x34: "CALLVALUE",
    0x35: "CALLDATALOAD",
    0x36: "CALLDATASIZE",
    0x37: "CALLDATACOPY",
    0x38: "CODESIZE",
    0x39: "CODECOPY",
    0x3a: "GASPRICE",
    0x3b: "EXTCODESIZE",
    0x3c: "EXTCODECOPY",
    0x3d: "RETURNDATASIZE",
    0x3e: "RETURNDATACOPY",
    0x3f: "EXTCODEHASH",
    0x40: "BLOCKHASH",
    0x41: "COINBASE",
    0x42: "TIMESTAMP",
    0x43: "NUMBER",
    0x44: "DIFFICULTY",
    0x45: "GASLIMIT",
    0x46: "CHAINID",
    0x47: "SELFBALANCE",
    0x50: "POP",
    0x51: "MLOAD",
    0x52: "MSTORE",
    0x53: "MSTORE8",
    0x54: "SLOAD",
    0x55: "SSTORE",
    0x56: "JUMP",
    0x57: "JUMPI",
    0x58: "PC",
    0x59: "MSIZE",
    0x5a: "GAS",
    0x5b: "JUMPDEST",
    0x5f: "PUSH0",
    0xf0: "CREATE",
    0xf1: "CALL",
    0xf2: "CALLCODE",
    0xf3: "RETURN",
    0xf4: "DELEGATECALL",
    0xf5: "CREATE2",
    0xfa: "STATICCALL",
    0xfd: "REVERT",
    0xfe: "INVALID",
    0xff: "SELFDESTRUCT"
  };
  while (i + 1 < h.length) {
    const pc = i / 2;
    const op = parseInt(h.slice(i, i + 2), 16);
    i += 2;
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      const imm = h.slice(i, i + n * 2);
      i += n * 2;
      rows.push({
        pc,
        mnemonic: `PUSH${n}`,
        immediate: imm ? `0x${imm}` : undefined
      });
      continue;
    }
    if (op >= 0x80 && op <= 0x8f) {
      rows.push({ pc, mnemonic: `DUP${op - 0x7f}` });
      continue;
    }
    if (op >= 0x90 && op <= 0x9f) {
      rows.push({ pc, mnemonic: `SWAP${op - 0x8f}` });
      continue;
    }
    if (op >= 0xa0 && op <= 0xa4) {
      rows.push({ pc, mnemonic: `LOG${op - 0xa0}` });
      continue;
    }
    rows.push({ pc, mnemonic: OP[op] || `UNKNOWN_0x${op.toString(16)}` });
  }
  return rows;
}

export function rowsFromArtifact(
  opcodes: string | undefined,
  runtimeHex: string | undefined
): OpcodeRow[] {
  if (opcodes && opcodes.trim()) return parseOpcodeString(opcodes);
  if (runtimeHex && runtimeHex.trim()) return disassembleHex(runtimeHex);
  return [];
}

/** Truncate for default view; `--all` shows full. */
export const OPCODE_DEFAULT_MAX_ROWS = 64;

export function formatOpcodeLines(
  rows: OpcodeRow[],
  opts?: { all?: boolean; max?: number }
): { lines: string[]; truncated: boolean; total: number } {
  const max = opts?.all ? rows.length : opts?.max ?? OPCODE_DEFAULT_MAX_ROWS;
  const slice = rows.slice(0, max);
  const lines = slice.map((r) => {
    const pc = String(r.pc).padStart(4, " ");
    const imm = r.immediate ? ` ${r.immediate}` : "";
    return `${pc}  ${r.mnemonic}${imm}`;
  });
  return {
    lines,
    truncated: !opts?.all && rows.length > max,
    total: rows.length
  };
}
