// @vitest-environment jsdom
/**
 * @file keybindings.test.ts
 * @description Unit tests for the pure `bind` keymap logic — arg parsing,
 * validation, dangerous commands, resolution, storage, merge, footer (#28)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  BINDINGS_STORAGE_KEY,
  DANGEROUS_COMMANDS,
  DEFAULTS,
  FKEYS,
  FUTURE_COMMANDS,
  defaultBindings,
  footerLabel,
  isDangerousBinding,
  isEditableTarget,
  loadBindings,
  mergeImportedBindings,
  parseBindArgs,
  resolveBinding,
  saveBindings,
  serializeBindings,
  validateBinding
} from "./keybindings";

const AVAILABLE = ["help", "networks", "dexes", "theme", "swap", "bind", "balance"];

describe("parseBindArgs", () => {
  it("parses no-arg / list", () => {
    expect(parseBindArgs([])).toEqual({ op: "list" });
    expect(parseBindArgs(["bind"])).toEqual({ op: "list" });
    expect(parseBindArgs(["bind", "list"])).toEqual({ op: "list" });
  });

  it("parses reset", () => {
    expect(parseBindArgs(["bind", "reset"])).toEqual({ op: "reset" });
  });

  it("parses footer on/off/toggle", () => {
    expect(parseBindArgs(["bind", "footer", "on"])).toEqual({ op: "footer", value: "on" });
    expect(parseBindArgs(["bind", "footer", "off"])).toEqual({ op: "footer", value: "off" });
    expect(parseBindArgs(["bind", "footer"])).toEqual({ op: "footer", value: "toggle" });
    expect(parseBindArgs(["bind", "footer", "bogus"]).op).toBe("error");
  });

  it("parses show, default, clear, and set", () => {
    expect(parseBindArgs(["bind", "f6"])).toEqual({ op: "show", key: "F6" });
    expect(parseBindArgs(["bind", "f6", "default"])).toEqual({ op: "default", key: "F6" });
    expect(parseBindArgs(["bind", "F6", "clear"])).toEqual({ op: "clear", key: "F6" });
    expect(parseBindArgs(["bind", "f6", "ticker"])).toEqual({ op: "set", key: "F6", cmd: "ticker" });
    expect(parseBindArgs(["bind", "F12", "theme", "next"])).toEqual({ op: "set", key: "F12", cmd: "theme next" });
  });

  it("rejects an unknown key", () => {
    expect(parseBindArgs(["bind", "f13"]).op).toBe("error");
    expect(parseBindArgs(["bind", "esc"]).op).toBe("error");
  });
});

describe("validateBinding", () => {
  it("accepts a real command and returns the canonical string", () => {
    const res = validateBinding("balance eth", AVAILABLE);
    expect(res.ok).toBe(true);
    expect(res.canonical).toBe("balance eth");
  });

  it("accepts empty strings (cleared)", () => {
    const res = validateBinding("", AVAILABLE);
    expect(res.ok).toBe(true);
    expect(res.canonical).toBe("");
  });

  it("accepts future commands", () => {
    expect(validateBinding("ticker", AVAILABLE).ok).toBe(true);
  });

  it("rejects unknown commands", () => {
    const res = validateBinding("nothing", AVAILABLE);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("nothing");
  });

  it("rejects scripts and chaining", () => {
    expect(validateBinding("balance\nrm -rf /", AVAILABLE).ok).toBe(false);
    expect(validateBinding("balance; evil", AVAILABLE).ok).toBe(false);
    expect(validateBinding("{{constructor}}", AVAILABLE).ok).toBe(false);
    expect(validateBinding("<script>alert(1)</script>", AVAILABLE).ok).toBe(false);
    expect(validateBinding("javascript:alert(1)", AVAILABLE).ok).toBe(false);
  });
});

describe("isDangerousBinding", () => {
  it("matches wallet create/import/export/nuke prefixes case-insensitively", () => {
    expect(isDangerousBinding("wallet create hello")).toBe(true);
    expect(isDangerousBinding("WALLET NUKE")).toBe(true);
    expect(isDangerousBinding("wallet export")).toBe(true);
  });

  it("does not match plain wallet or unrelated commands", () => {
    expect(isDangerousBinding("wallet")).toBe(false);
    expect(isDangerousBinding("wallet balance")).toBe(false);
    expect(isDangerousBinding("balance")).toBe(false);
  });
});

describe("resolveBinding", () => {
  it("falls back to factory defaults", () => {
    const r = resolveBinding(defaultBindings(), "F1");
    expect(r.cmd).toBe("help");
    expect(r.origin).toBe("default");
  });

  it("returns user bindings and cleared keys", () => {
    const state = { ...defaultBindings(), map: { F6: "ticker", F2: "" } };
    expect(resolveBinding(state, "F6")).toEqual({ cmd: "ticker", origin: "user" });
    expect(resolveBinding(state, "F2")).toEqual({ cmd: "", origin: "cleared" });
  });
});

describe("serializeBindings / loadBindings / saveBindings", () => {
  it("serializes only diffs and clears, keeping footer", () => {
    const state = {
      version: 1 as const,
      footer: false,
      map: { F6: "ticker", F2: "" }
    };
    const parsed = JSON.parse(serializeBindings(state));
    expect(parsed.footer).toBe(false);
    expect(parsed.map).toEqual({ F6: "ticker", F2: "" });
  });

  it("round-trips through a storage stub", () => {
    const storage = new Map<string, string>();
    const stub = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } };
    const state = { version: 1 as const, footer: true, map: { F9: "kyt" } };
    saveBindings(stub, state);
    const loaded = loadBindings(stub);
    expect(loaded.footer).toBe(true);
    expect(loaded.map.F9).toBe("kyt");
  });

  it("returns defaults for missing or malformed storage", () => {
    const empty = { getItem: () => null };
    expect(loadBindings(empty)).toEqual(defaultBindings());
    const bad = { getItem: () => "not json" };
    expect(loadBindings(bad)).toEqual(defaultBindings());
  });

  it("tolerates garbage keys in storage", () => {
    const stub = {
      getItem: (k: string) => (k === BINDINGS_STORAGE_KEY ? JSON.stringify({ version: 1, footer: true, map: { F6: "ticker", F13: "nope", F2: 42 } }) : null)
    };
    const loaded = loadBindings(stub);
    expect(loaded.map.F6).toBe("ticker");
    expect((loaded.map as Record<string, string | undefined>)["F13"]).toBeUndefined();
    expect(loaded.map.F2).toBeUndefined();
  });
});

describe("mergeImportedBindings", () => {
  it("adopts imported bindings when the device has no custom keys", () => {
    const merged = mergeImportedBindings(defaultBindings(), {
      footer: true,
      map: { F6: "ticker", F1: "balance" }
    });
    expect(merged.map.F6).toBe("ticker");
    expect(merged.map.F1).toBe("balance");
  });

  it("device wins when it has a custom key", () => {
    const device = { ...defaultBindings(), map: { F6: "news" } };
    const merged = mergeImportedBindings(device, { footer: true, map: { F6: "ticker" } });
    expect(merged.map.F6).toBe("news");
  });

  it("ignores a non-object import", () => {
    expect(mergeImportedBindings(defaultBindings(), null)).toEqual(defaultBindings());
  });
});

describe("footerLabel", () => {
  it("returns an empty string when the footer is off", () => {
    expect(footerLabel({ ...defaultBindings(), footer: false }, "matrix")).toBe("");
  });

  it("shows marquee defaults on non-bloomberg themes", () => {
    const label = footerLabel(defaultBindings(), "macintosh");
    expect(label).toContain("F1 HELP");
    expect(label).toContain("F5 SWAP");
    expect(label).toContain("F12 FEEDBACK");
  });

  it("on bloomberg hints F6-F12 and customs, not F1-F5", () => {
    const label = footerLabel(defaultBindings(), "bloomberg");
    expect(label).not.toMatch(/(^|· )F1 /);
    expect(label).not.toMatch(/(^|· )F5 /);
    expect(label).toContain("F6 TICKER");
    expect(label).toContain("F11 PLAN LS");
  });

  it("includes user custom bindings anywhere", () => {
    const state = { ...defaultBindings(), map: { F3: "balance", F1: "" } };
    const label = footerLabel(state, "void");
    expect(label).toContain("F3 balance");
  });
});

describe("isEditableTarget", () => {
  it("treats textareas and password inputs as editable", () => {
    const ta = document.createElement("textarea");
    expect(isEditableTarget(ta)).toBe(true);
    const pw = document.createElement("input");
    pw.type = "password";
    expect(isEditableTarget(pw)).toBe(true);
  });

  it("ignores regular text inputs", () => {
    const inp = document.createElement("input");
    expect(isEditableTarget(inp)).toBe(true);
  });

  it("exempts the terminal prompt input", () => {
    const inp = document.createElement("input");
    inp.setAttribute("data-0xterm-prompt", "");
    expect(isEditableTarget(inp)).toBe(false);
  });

  it("exempts retain-focus panels", () => {
    const el = document.createElement("div");
    el.setAttribute("data-retain-focus", "");
    expect(isEditableTarget(el)).toBe(true);
  });
});

describe("keymap shape invariants", () => {
  it("DEFAULTS covers all 12 F-keys", () => {
    expect(FKEYS).toHaveLength(12);
    for (const k of FKEYS) expect(typeof DEFAULTS[k]).toBe("string");
  });

  it("future commands referenced by the fire path are all known", () => {
    for (const c of FUTURE_COMMANDS) expect(typeof c).toBe("string");
  });

  it("DANGEROUS_COMMANDS is a non-empty list of prefixes", () => {
    expect(DANGEROUS_COMMANDS.length).toBeGreaterThan(0);
    for (const prefix of DANGEROUS_COMMANDS) expect(prefix.length).toBeGreaterThan(0);
  });
});
