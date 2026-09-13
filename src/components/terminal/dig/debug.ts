/**
 * @file debug.ts
 * @description Dig debug session — structLog steps, stepping, source-map PC (#41)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/** Cap displayed / stored steps (eng pin). */
export const DIG_DEBUG_TRACE_CAP = 10_000;

/** One opcode frame — subset of geth structLogs / ethereumjs step. */
export type DigTraceStep = {
  pc: number;
  op: string;
  gas: string;
  depth: number;
  /** Stack words bottom→top (ethereumjs order); hex 0x… */
  stack: string[];
  /** Memory hex without 0x (may be empty). */
  memory: string;
  address?: string;
};

export type DigDebugStatus = "OK" | "REVERT";

export type DigDebugPanelState = {
  stepIndex: number;
  totalSteps: number;
  status: DigDebugStatus;
  truncated: boolean;
  mapMismatch?: boolean;
  pc: number;
  op: string;
  gas: string;
  stackTop8: string[];
  /** Nearby opcode rows for the list pane (when no source). */
  opcodeRows: Array<{ pc: number; op: string; current: boolean }>;
  /** Source lines + 0-based current line when map resolves. */
  sourceLines?: string[];
  sourceLine?: number;
  hasSourceMap: boolean;
  breakpoints: number[];
};

export type DigDebugSession = {
  steps: DigTraceStep[];
  truncated: boolean;
  status: DigDebugStatus;
  index: number;
  breakpoints: number[];
  mapMismatch?: boolean;
  hasSourceMap: boolean;
  sourceLines?: string[];
  /** pc → 0-based source line */
  lineByPc: Record<number, number>;
};

function wordHex(n: bigint): string {
  if (n < 0n) n = BigInt.asUintN(256, n);
  return `0x${n.toString(16)}`;
}

/** Normalize ethereumjs / RPC stack item to 0x-hex. */
export function normalizeStackWord(v: unknown): string {
  if (typeof v === "bigint") return wordHex(v);
  if (typeof v === "number") return wordHex(BigInt(v));
  if (typeof v === "string") {
    const s = v.startsWith("0x") || v.startsWith("0X") ? v : `0x${v}`;
    return s === "0x" ? "0x0" : s;
  }
  return "0x0";
}

export function memoryToHex(memory: Uint8Array | string | undefined): string {
  if (!memory) return "";
  if (typeof memory === "string") {
    return memory.startsWith("0x") || memory.startsWith("0X")
      ? memory.slice(2)
      : memory;
  }
  let out = "";
  for (let i = 0; i < memory.length; i++) {
    out += memory[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

export function buildTraceFromSteps(
  raw: DigTraceStep[],
  opts?: { status?: DigDebugStatus; cap?: number }
): { steps: DigTraceStep[]; truncated: boolean; status: DigDebugStatus } {
  const cap = opts?.cap ?? DIG_DEBUG_TRACE_CAP;
  const truncated = raw.length > cap;
  const steps = truncated ? raw.slice(0, cap) : raw;
  return {
    steps,
    truncated,
    status: opts?.status ?? "OK"
  };
}

/**
 * Parse compacted Solidity source map → instruction index → {start, length, file}.
 * Empty fields inherit previous (solc compact format).
 */
export function parseSourceMap(
  sourceMap: string
): Array<{ start: number; length: number; file: number } | null> {
  const entries: Array<{ start: number; length: number; file: number } | null> =
    [];
  let s = 0;
  let l = 0;
  let f = 0;
  for (const part of sourceMap.split(";")) {
    if (!part) {
      entries.push(entries.length ? entries[entries.length - 1]! : null);
      continue;
    }
    const bits = part.split(":");
    if (bits[0] !== undefined && bits[0] !== "") s = Number(bits[0]);
    if (bits[1] !== undefined && bits[1] !== "") l = Number(bits[1]);
    if (bits[2] !== undefined && bits[2] !== "") f = Number(bits[2]);
    if (f < 0) {
      entries.push(null);
    } else {
      entries.push({ start: s, length: l, file: f });
    }
  }
  return entries;
}

/** Map runtime bytecode PCs → instruction indices (PUSH payloads skip). */
export function pcToInstructionIndex(runtimeHex: string): Map<number, number> {
  const h = (runtimeHex.startsWith("0x") ? runtimeHex.slice(2) : runtimeHex).toLowerCase();
  const map = new Map<number, number>();
  let pc = 0;
  let idx = 0;
  for (let i = 0; i + 1 < h.length; ) {
    const byte = parseInt(h.slice(i, i + 2), 16);
    map.set(pc, idx);
    let size = 1;
    if (byte >= 0x60 && byte <= 0x7f) size = 1 + (byte - 0x5f);
    pc += size;
    i += size * 2;
    idx++;
  }
  return map;
}

/** Byte offset in source → 0-based line number. */
export function offsetToLine(source: string, offset: number): number {
  let line = 0;
  const lim = Math.min(offset, source.length);
  for (let i = 0; i < lim; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

export function buildLineByPc(opts: {
  sourceMap?: string;
  runtimeBytecode?: string;
  source?: string;
}): { lineByPc: Record<number, number>; hasSourceMap: boolean } {
  const { sourceMap, runtimeBytecode, source } = opts;
  if (!sourceMap || !runtimeBytecode || !source) {
    return { lineByPc: {}, hasSourceMap: false };
  }
  const entries = parseSourceMap(sourceMap);
  const pcMap = pcToInstructionIndex(runtimeBytecode);
  const lineByPc: Record<number, number> = {};
  for (const [pc, idx] of pcMap) {
    const e = entries[idx];
    if (!e) continue;
    lineByPc[pc] = offsetToLine(source, e.start);
  }
  return { lineByPc, hasSourceMap: Object.keys(lineByPc).length > 0 };
}

export function stackTop8(stack: string[]): string[] {
  if (stack.length === 0) return [];
  // ethereumjs: end of array is top
  return stack.slice(-8).reverse();
}

export function formatMemSlice(
  memoryHex: string,
  offset = 0,
  len = 32
): string {
  const start = Math.max(0, offset) * 2;
  const end = start + Math.max(0, len) * 2;
  const slice = memoryHex.slice(start, end);
  if (!slice) return "—";
  return `0x${slice}`;
}

export function currentStep(session: DigDebugSession): DigTraceStep | undefined {
  return session.steps[session.index];
}

export function panelFromSession(session: DigDebugSession): DigDebugPanelState {
  const step = currentStep(session) || {
    pc: 0,
    op: "—",
    gas: "0",
    depth: 0,
    stack: [],
    memory: ""
  };
  // Stephy #41: mapMismatch forces opcode-only (no source pane).
  const hasSource =
    !session.mapMismatch &&
    session.hasSourceMap &&
    session.sourceLines &&
    session.sourceLines.length > 0 &&
    session.lineByPc[step.pc] !== undefined;

  const opcodeRows: DigDebugPanelState["opcodeRows"] = [];
  const start = Math.max(0, session.index - 4);
  const end = Math.min(session.steps.length, session.index + 8);
  for (let i = start; i < end; i++) {
    const s = session.steps[i]!;
    opcodeRows.push({ pc: s.pc, op: s.op, current: i === session.index });
  }

  return {
    stepIndex: session.steps.length === 0 ? 0 : session.index + 1,
    totalSteps: session.steps.length,
    status: session.status,
    truncated: session.truncated,
    mapMismatch: session.mapMismatch,
    pc: step.pc,
    op: step.op,
    gas: step.gas,
    stackTop8: stackTop8(step.stack),
    opcodeRows,
    sourceLines: hasSource ? session.sourceLines : undefined,
    sourceLine: hasSource ? session.lineByPc[step.pc] : undefined,
    hasSourceMap: !!hasSource,
    breakpoints: [...session.breakpoints]
  };
}

export function digDebugPinTitle(panel: DigDebugPanelState): string {
  return `step ${panel.stepIndex}/${panel.totalSteps} · ${panel.op} · ${panel.status}`;
}

/** Next opcode (into calls = next structLog). */
export function stepInto(session: DigDebugSession): DigDebugSession {
  if (session.index >= session.steps.length - 1) return session;
  return { ...session, index: session.index + 1 };
}

/** Step over: advance until depth <= start depth. */
export function stepOver(session: DigDebugSession): DigDebugSession {
  const cur = currentStep(session);
  if (!cur || session.index >= session.steps.length - 1) return session;
  const d = cur.depth;
  let i = session.index + 1;
  while (i < session.steps.length) {
    const s = session.steps[i]!;
    if (s.depth <= d) break;
    i++;
  }
  if (i >= session.steps.length) i = session.steps.length - 1;
  return { ...session, index: i };
}

/** Step out: advance until depth < start depth. */
export function stepOut(session: DigDebugSession): DigDebugSession {
  const cur = currentStep(session);
  if (!cur || session.index >= session.steps.length - 1) return session;
  const d = cur.depth;
  let i = session.index + 1;
  while (i < session.steps.length) {
    const s = session.steps[i]!;
    if (s.depth < d) break;
    i++;
  }
  if (i >= session.steps.length) i = session.steps.length - 1;
  return { ...session, index: i };
}

export function stepBack(session: DigDebugSession): DigDebugSession {
  if (session.index <= 0) return session;
  return { ...session, index: session.index - 1 };
}

export function addBreakpoint(
  session: DigDebugSession,
  pc: number
): DigDebugSession {
  if (session.breakpoints.includes(pc)) return session;
  return {
    ...session,
    breakpoints: [...session.breakpoints, pc].sort((a, b) => a - b)
  };
}

export function clearBreakpoints(session: DigDebugSession): DigDebugSession {
  return { ...session, breakpoints: [] };
}

/** Storage map reconstructed from SSTORE ops up to (and including) index. */
export function storageUpTo(
  steps: DigTraceStep[],
  index: number
): Record<string, string> {
  const out: Record<string, string> = {};
  const lim = Math.min(index, steps.length - 1);
  for (let i = 0; i <= lim; i++) {
    const s = steps[i]!;
    if (s.op !== "SSTORE") continue;
    // stack top = value, next = key (after pop order: before op, top is key then value in yellow paper — 
    // ethereumjs emits pre-op stack: top is key for SSTORE? Actually SSTORE pops key then value:
    // stack: [... value, key] with key on top.
    if (s.stack.length < 2) continue;
    const key = s.stack[s.stack.length - 1]!;
    const value = s.stack[s.stack.length - 2]!;
    out[key.toLowerCase()] = value;
  }
  return out;
}

/** Convert geth-style structLogs into DigTraceStep[]. */
export function stepsFromStructLogs(logs: unknown[]): DigTraceStep[] {
  const out: DigTraceStep[] = [];
  for (const raw of logs) {
    if (!raw || typeof raw !== "object") continue;
    const l = raw as Record<string, unknown>;
    const stackRaw = Array.isArray(l.stack) ? l.stack : [];
    out.push({
      pc: Number(l.pc ?? 0),
      op: String(l.op ?? l.opName ?? "UNKNOWN"),
      gas: String(l.gas ?? l.gasLeft ?? "0"),
      depth: Number(l.depth ?? 1),
      stack: stackRaw.map(normalizeStackWord),
      memory: memoryToHex(
        typeof l.memory === "string"
          ? l.memory
          : Array.isArray(l.memory)
            ? (l.memory as string[]).join("")
            : undefined
      ),
      address: typeof l.address === "string" ? l.address : undefined
    });
  }
  return out;
}
