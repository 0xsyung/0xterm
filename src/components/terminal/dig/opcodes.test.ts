/**
 * @file opcodes.test.ts
 * @description Unit tests for opcode formatting (#39)
 */
import { describe, expect, it } from "vitest";
import {
  formatOpcodeLines,
  parseOpcodeString,
  disassembleHex
} from "./opcodes";

describe("opcodes", () => {
  it("parses solc opcode strings with PCs", () => {
    const rows = parseOpcodeString("PUSH1 0x80 PUSH1 0x40 MSTORE");
    expect(rows[0]).toMatchObject({ pc: 0, mnemonic: "PUSH1", immediate: "0x80" });
    expect(rows[1].pc).toBe(2);
    expect(rows[2].mnemonic).toBe("MSTORE");
  });

  it("disassembles hex and truncates", () => {
    const rows = disassembleHex("6080604052");
    expect(rows.some((r) => r.mnemonic.startsWith("PUSH"))).toBe(true);
    const many = Array.from({ length: 100 }, (_, i) => ({
      pc: i,
      mnemonic: "JUMP"
    }));
    const fmt = formatOpcodeLines(many);
    expect(fmt.truncated).toBe(true);
    expect(fmt.lines.length).toBe(64);
    expect(formatOpcodeLines(many, { all: true }).truncated).toBe(false);
  });
});
