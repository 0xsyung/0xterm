// @vitest-environment jsdom
/**
 * @file TerminalLogList.digUsage.test.tsx
 * @description Dig usage log line wraps — no truncate/ellipsis classes (#88)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "./constants";
import { digUsageText } from "./dig/constants";
import TerminalLogList from "./TerminalLogList";
import type { LogEntry } from "./types";

const theme = THEMES.matrix;

describe("TerminalLogList dig usage (#88)", () => {
  it("renders usage with whitespace-normal / break-words (not truncate)", () => {
    const text = digUsageText();
    const logs: LogEntry[] = [
      { id: "1", type: "text", text }
    ];
    const { container } = render(
      <TerminalLogList
        logs={logs}
        theme={theme}
        activeChainId={1}
        onPin={() => {}}
        pinnedIds={new Set()}
      />
    );
    const el = container.querySelector("[data-dig-usage='true']");
    expect(el).toBeTruthy();
    expect(el!.className).toMatch(/\bwhitespace-normal\b/);
    expect(el!.className).toMatch(/\bbreak-words\b/);
    expect(el!.className).not.toMatch(/\btruncate\b/);
    expect(el!.className).not.toMatch(/ellipsis/);
    expect(screen.getByText(text)).toBeTruthy();
    expect(text).not.toContain("…");
  });
});
