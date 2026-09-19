/**
 * @file constants.test.ts
 * @description Dig usage line wrap contract (#88)
 */
import { describe, expect, it } from "vitest";
import { DIG_SUBCOMMANDS, digUsageText } from "./constants";

describe("digUsageText (#88)", () => {
  it("lists every subcommand with spaces so the log can wrap", () => {
    const line = digUsageText();
    expect(line.startsWith("Usage: dig [")).toBe(true);
    expect(line.endsWith("]")).toBe(true);
    // Spaces around `|` — break on spaces, not one unbreakable token.
    expect(line).toContain(" | ");
    expect(line).not.toMatch(/\|[a-z]/); // no bare pipe-glue without spaces
    for (const sub of DIG_SUBCOMMANDS) {
      expect(line).toContain(sub);
    }
  });

  it("does not truncate with a visual ellipsis", () => {
    const line = digUsageText();
    expect(line).not.toContain("…");
    expect(line).not.toContain("...");
  });
});
