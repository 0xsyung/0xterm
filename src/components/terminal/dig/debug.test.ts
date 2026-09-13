/**
 * @file debug.test.ts
 * @description Dig debug stepping / PC / over from fixture trace (#41)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DIG_ERROR } from "./constants";
import {
  DIG_DEBUG_TRACE_CAP,
  addBreakpoint,
  buildTraceFromSteps,
  clearBreakpoints,
  currentStep,
  digDebugPinTitle,
  formatMemSlice,
  panelFromSession,
  stepBack,
  stepInto,
  stepOut,
  stepOver,
  storageUpTo,
  stackTop8,
  type DigDebugSession,
  type DigTraceStep
} from "./debug";
import { resetDigSession, setDigDebugSession, getDigDebugSession } from "./session";
import { runDig } from "./runDig";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(dir, "fixtures/trace-small.json"), "utf8")
) as { steps: DigTraceStep[]; status: "OK" | "REVERT"; truncated: boolean };

function sessionFromFixture(index = 0): DigDebugSession {
  return {
    steps: fixture.steps,
    truncated: fixture.truncated,
    status: fixture.status,
    index,
    breakpoints: [],
    hasSourceMap: false,
    lineByPc: {}
  };
}

describe("dig debug fixture stepping", () => {
  it("step into advances PC/opcode", () => {
    let s = sessionFromFixture(0);
    expect(currentStep(s)?.op).toBe("PUSH1");
    expect(currentStep(s)?.pc).toBe(0);
    s = stepInto(s);
    expect(currentStep(s)?.pc).toBe(2);
    expect(currentStep(s)?.op).toBe("PUSH1");
    s = stepInto(s);
    expect(currentStep(s)?.op).toBe("MSTORE");
    expect(currentStep(s)?.pc).toBe(4);
  });

  it("step over skips into deeper call frames", () => {
    // index of CALL at depth 0
    const callIdx = fixture.steps.findIndex((x) => x.op === "CALL");
    expect(callIdx).toBeGreaterThan(0);
    let s = sessionFromFixture(callIdx);
    s = stepOver(s);
    expect(currentStep(s)?.depth).toBe(0);
    expect(currentStep(s)?.op).toBe("SSTORE");
  });

  it("step out returns from depth 1", () => {
    const deep = fixture.steps.findIndex((x) => x.depth === 1);
    let s = sessionFromFixture(deep);
    s = stepOut(s);
    expect(currentStep(s)?.depth).toBe(0);
  });

  it("step back restores previous PC", () => {
    let s = sessionFromFixture(3);
    const pc = currentStep(s)!.pc;
    s = stepBack(s);
    expect(currentStep(s)!.pc).not.toBe(pc);
    s = stepInto(s);
    expect(currentStep(s)!.pc).toBe(pc);
  });

  it("stack top 8 is reverse of ethereumjs end-top", () => {
    const s = sessionFromFixture(2);
    const top = stackTop8(currentStep(s)!.stack);
    expect(top[0]).toBe("0x40");
    expect(top[1]).toBe("0x80");
  });

  it("mem slice reads tabular offsets", () => {
    const s = sessionFromFixture(3);
    const hex = formatMemSlice(currentStep(s)!.memory, 64, 1);
    expect(hex).toBe("0x80");
  });

  it("stor reconstructs SSTORE key/value", () => {
    const sstoreIdx = fixture.steps.findIndex((x) => x.op === "SSTORE");
    const map = storageUpTo(fixture.steps, sstoreIdx);
    expect(map["0x0"]).toBe("0x5");
  });

  it("cap truncates with dig.debug_too_long flag", () => {
    const many = Array.from({ length: DIG_DEBUG_TRACE_CAP + 50 }, (_, i) => ({
      pc: i,
      op: "JUMPDEST",
      gas: "1",
      depth: 0,
      stack: [] as string[],
      memory: ""
    }));
    const built = buildTraceFromSteps(many);
    expect(built.truncated).toBe(true);
    expect(built.steps).toHaveLength(DIG_DEBUG_TRACE_CAP);
    expect(DIG_ERROR.debug_too_long).toContain("dig.debug_too_long");
  });

  it("panel + pin title shape", () => {
    const s = sessionFromFixture(1);
    const panel = panelFromSession(s);
    expect(panel.stepIndex).toBe(2);
    expect(panel.totalSteps).toBe(fixture.steps.length);
    expect(panel.op).toBe("PUSH1");
    expect(digDebugPinTitle(panel)).toMatch(/^step 2\/\d+ · PUSH1 · OK$/);
  });

  it("breakpoints add/clear", () => {
    let s = sessionFromFixture(0);
    s = addBreakpoint(s, 4);
    s = addBreakpoint(s, 4);
    expect(s.breakpoints).toEqual([4]);
    s = clearBreakpoints(s);
    expect(s.breakpoints).toEqual([]);
  });
});

describe("runDig debug verbs (session)", () => {
  beforeEach(() => {
    resetDigSession();
  });

  it("dig debug with nothing → dig.no_tx", async () => {
    const r = await runDig(["dig", "debug"]);
    expect(r).toMatchObject({
      kind: "text",
      warn: true,
      text: DIG_ERROR.no_tx
    });
  });

  it("dig step without session → dig.no_tx", async () => {
    const r = await runDig(["dig", "step"]);
    expect(r).toMatchObject({ kind: "text", warn: true, text: DIG_ERROR.no_tx });
  });

  it("dig debug <hash> without tracer → dig.debug_no_trace", async () => {
    const r = await runDig(["dig", "debug", "0x" + "ab".repeat(32)], {
      isConnected: true,
      debugTraceTransaction: async () => ({
        ok: false as const,
        code: "debug_no_trace" as const
      })
    });
    expect(r).toMatchObject({
      kind: "text",
      warn: true,
      text: DIG_ERROR.debug_no_trace
    });
  });

  it("opens fixture target and steps via runDig", async () => {
    const built = buildTraceFromSteps(fixture.steps);
    setDigDebugSession({
      steps: built.steps,
      truncated: false,
      status: "OK",
      index: 0,
      breakpoints: [],
      hasSourceMap: false,
      lineByPc: {}
    });
    const step = await runDig(["dig", "step"]);
    expect(step).toMatchObject({ kind: "debug" });
    if (!Array.isArray(step) && step.kind === "debug") {
      expect(step.panel.pc).toBe(2);
      expect(step.panel.op).toBe("PUSH1");
    }
    const over = await runDig(["dig", "over"]);
    expect(over).toMatchObject({ kind: "debug" });
    expect(getDigDebugSession()?.index).toBeGreaterThan(0);
  });
});
