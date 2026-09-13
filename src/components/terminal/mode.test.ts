/**
 * @file mode.test.ts
 * @description Unit tests for terminal mode gating (#54)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODE,
  MODE_ORDER,
  MODE_LABEL,
  classifyLiveVerb,
  filterCommandsForMode,
  helpRowsForMode,
  homeModeForCommand,
  isCommandAllowed,
  isTerminalMode,
  loadMode,
  modeChoiceCommands,
  modeStatusText,
  modeSwitchAck,
  resolveModeId,
  saveMode,
  wrongModeMessage
} from "./mode";

describe("resolveModeId / aliases", () => {
  it("resolves canonical ids", () => {
    expect(resolveModeId("invest")).toBe("invest");
    expect(resolveModeId("dev")).toBe("dev");
    expect(resolveModeId("forensic")).toBe("forensic");
  });

  it("resolves invest aliases trade / i", () => {
    expect(resolveModeId("trade")).toBe("invest");
    expect(resolveModeId("i")).toBe("invest");
    expect(resolveModeId("TRADE")).toBe("invest");
  });

  it("resolves dig aliases workshop / d", () => {
    expect(resolveModeId("workshop")).toBe("dev");
    expect(resolveModeId("d")).toBe("dev");
  });

  it("resolves forensic aliases dig / trace / f", () => {
    expect(resolveModeId("dig")).toBe("forensic");
    expect(resolveModeId("trace")).toBe("forensic");
    expect(resolveModeId("f")).toBe("forensic");
  });

  it("returns null for unknown", () => {
    expect(resolveModeId("social")).toBeNull();
    expect(resolveModeId("")).toBeNull();
    expect(resolveModeId(null)).toBeNull();
  });
});

describe("default + persistence", () => {
  it("defaults to invest on first boot", () => {
    expect(DEFAULT_MODE).toBe("invest");
    expect(loadMode(null)).toBe("invest");
    expect(loadMode({ getItem: () => null })).toBe("invest");
  });

  it("round-trips via storage", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      }
    };
    saveMode(storage, "forensic");
    expect(loadMode(storage)).toBe("forensic");
    saveMode(storage, "dev");
    expect(loadMode(storage)).toBe("dev");
  });

  it("isTerminalMode guards", () => {
    expect(isTerminalMode("invest")).toBe(true);
    expect(isTerminalMode("dev")).toBe(true);
    expect(isTerminalMode("nope")).toBe(false);
  });
});

describe("isCommandAllowed — classification table", () => {
  const globals = [
    "help",
    "?",
    "mode",
    "modes",
    "theme",
    "style",
    "connect",
    "disconnect",
    "networks",
    "network",
    "net",
    "rpc",
    "export",
    "import",
    "tokens",
    "register",
    "ens",
    "chat",
    "inbox",
    "chatfee",
    "board",
    "boardfee",
    "channel",
    "channels",
    "share",
    "unshare",
    "look",
    "feed",
    "clear",
    "rain"
  ];

  const invest = [
    "price",
    "pool",
    "swap",
    "dexes",
    "dex",
    "balance",
    "bal",
    "portfolio",
    "snapshot",
    "pnl",
    "createpool",
    "getpool",
    "findpool",
    "initialize",
    "initpool",
    "addliq",
    "provideliq"
  ];

  it("globals work in every mode", () => {
    for (const mode of MODE_ORDER) {
      for (const cmd of globals) {
        expect(isCommandAllowed(mode, cmd), `${mode}/${cmd}`).toBe(true);
      }
    }
  });

  it("invest verbs only in invest (except forensic read helpers)", () => {
    for (const cmd of invest) {
      expect(isCommandAllowed("invest", cmd)).toBe(true);
      expect(isCommandAllowed("dev", cmd)).toBe(false);
    }
    // forensic read helpers
    for (const cmd of ["price", "balance", "bal", "portfolio"]) {
      expect(isCommandAllowed("forensic", cmd)).toBe(true);
    }
    for (const cmd of [
      "swap",
      "createpool",
      "addliq",
      "initialize",
      "arb",
      "plan",
      "getpool",
      "pool",
      "dex",
      "snapshot",
      "pnl"
    ]) {
      expect(isCommandAllowed("forensic", cmd), `forensic blocks ${cmd}`).toBe(
        false
      );
    }
  });

  it("dig / compile / solc are dig-only", () => {
    for (const cmd of ["dig", "compile", "solc"]) {
      expect(isCommandAllowed("dev", cmd), cmd).toBe(true);
      expect(isCommandAllowed("invest", cmd), cmd).toBe(false);
      expect(isCommandAllowed("forensic", cmd), cmd).toBe(false);
    }
  });

  it("is/info shared dig ∩ forensic", () => {
    for (const cmd of ["is", "info"]) {
      expect(isCommandAllowed("dev", cmd)).toBe(true);
      expect(isCommandAllowed("forensic", cmd)).toBe(true);
      expect(isCommandAllowed("invest", cmd)).toBe(false);
    }
  });

  it("unknown verbs are not wrong-mode-blocked", () => {
    expect(isCommandAllowed("invest", "foobar")).toBe(true);
    expect(classifyLiveVerb("foobar")).toBeNull();
  });

  it("classifies live verbs", () => {
    expect(classifyLiveVerb("swap")).toBe("invest");
    expect(classifyLiveVerb("dig")).toBe("dev");
    expect(classifyLiveVerb("compile")).toBe("dev");
    expect(classifyLiveVerb("kyt")).toBe("forensic");
    expect(classifyLiveVerb("is")).toBe("shared");
    expect(classifyLiveVerb("help")).toBe("global");
    expect(classifyLiveVerb("share")).toBe("global");
    expect(classifyLiveVerb("look")).toBe("global");
    expect(classifyLiveVerb("feed")).toBe("global");
    expect(classifyLiveVerb("unshare")).toBe("global");
  });
});

describe("wrong-mode messaging", () => {
  it("shapes the fail-closed line", () => {
    expect(wrongModeMessage("swap")).toBe(
      "[!] `swap` is an INVEST command. Type `mode invest` or `help`."
    );
    expect(wrongModeMessage("dig compile")).toBe(
      "[!] `dig compile` is a DEV command. Type `mode dev` or `help`."
    );
    expect(wrongModeMessage("dig debug")).toBe(
      "[!] `dig debug` is a DEV command. Type `mode dev` or `help`."
    );
    expect(homeModeForCommand("is")).toBe("dev");
  });

  it("switch ack blurbs", () => {
    expect(modeSwitchAck("invest")).toContain("Mode → INVEST");
    expect(modeSwitchAck("invest")).toContain("prices, portfolio, DEX, plans");
    expect(modeSwitchAck("dev")).toContain("Mode → DEV");
    expect(modeSwitchAck("forensic")).toContain("Mode → FORENSIC");
  });

  it("status lists all three", () => {
    const text = modeStatusText("invest");
    expect(text).toContain("INVEST");
    expect(text).toContain("DEV");
    expect(text).toContain("FORENSIC");
    expect(text).toMatch(/^\* INVEST/m);
  });
});

describe("autocomplete filter + CHOICES", () => {
  it("filters out-of-mode verbs", () => {
    const all = ["help", "swap", "dig", "is", "price", "kyt"];
    expect(filterCommandsForMode("invest", all).sort()).toEqual(
      ["help", "price", "swap"].sort()
    );
    expect(filterCommandsForMode("dev", all).sort()).toEqual(
      ["dig", "help", "is"].sort()
    );
    expect(filterCommandsForMode("forensic", all).sort()).toEqual(
      ["help", "is", "kyt", "price"].sort()
    );
  });

  it("chip CHOICES are mode <id> rows", () => {
    expect(modeChoiceCommands()).toEqual([
      "mode invest",
      "mode dev",
      "mode forensic"
    ]);
  });
});

describe("helpRowsForMode", () => {
  it("invest includes swap, excludes dig/is", () => {
    const cmds = helpRowsForMode("invest").map((r) => r.command);
    expect(cmds.some((c) => c.startsWith("swap"))).toBe(true);
    expect(cmds.some((c) => c.startsWith("dig"))).toBe(false);
    expect(cmds.some((c) => c.startsWith("is "))).toBe(false);
    expect(cmds.some((c) => c.startsWith("mode"))).toBe(true);
  });

  it("dev includes dig + is, excludes swap", () => {
    const cmds = helpRowsForMode("dev").map((r) => r.command);
    expect(cmds.some((c) => c === "dig" || c.startsWith("dig "))).toBe(true);
    expect(cmds.some((c) => c.startsWith("is "))).toBe(true);
    expect(cmds.some((c) => c.startsWith("swap"))).toBe(false);
  });

  it("forensic includes price/is, excludes swap/dig", () => {
    const cmds = helpRowsForMode("forensic").map((r) => r.command);
    expect(cmds.some((c) => c.startsWith("price"))).toBe(true);
    expect(cmds.some((c) => c.startsWith("is "))).toBe(true);
    expect(cmds.some((c) => c.startsWith("swap"))).toBe(false);
    expect(cmds.some((c) => c.startsWith("dig"))).toBe(false);
  });
});

describe("MODE_LABEL chip copy", () => {
  it("matches Stephy status-only labels", () => {
    expect(MODE_LABEL.invest).toBe("INVEST");
    expect(MODE_LABEL.dev).toBe("DEV");
    expect(MODE_LABEL.forensic).toBe("FORENSIC");
  });
});
