// @vitest-environment jsdom
/**
 * @file TerminalHeader.test.tsx
 * @description Smoke/render tests for header primary tabs (#91)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { THEMES } from "./constants";
import TerminalHeader from "./TerminalHeader";

const theme = THEMES.matrix;

describe("TerminalHeader primary tabs (#91)", () => {
  it("renders TERMINAL and SOCIAL labels when primary switch is wired", () => {
    render(
      <TerminalHeader
        theme={theme}
        currentThemeKey="matrix"
        onThemeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "TERMINAL" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "SOCIAL" })).toBeTruthy();
  });

  it("marks the active tab selected and keeps inactive outlined via border class", () => {
    render(
      <TerminalHeader
        theme={theme}
        currentThemeKey="matrix"
        onThemeChange={vi.fn()}
        primaryTab="social"
        onPrimaryTabChange={vi.fn()}
        socialBadge={3}
      />
    );
    const terminal = screen.getByRole("tab", { name: "TERMINAL" });
    const social = screen.getByRole("tab", { name: /SOCIAL/ });
    expect(social.getAttribute("aria-selected")).toBe("true");
    expect(terminal.getAttribute("aria-selected")).toBe("false");
    // Inactive = outlined chip (border + muted); active uses solid phosphor fill.
    expect(terminal.className).toMatch(/border/);
    expect(terminal.className).toMatch(/bg-transparent/);
  });

  it("wraps the tab strip on narrow via basis-full + overflow-x-auto fallback", () => {
    render(
      <TerminalHeader
        theme={theme}
        currentThemeKey="matrix"
        onThemeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    const strip = screen.getByTestId("primary-tab-strip");
    expect(strip.className).toMatch(/max-md:basis-full/);
    expect(strip.className).toMatch(/max-md:overflow-x-auto/);
    expect(strip.getAttribute("role")).toBe("tablist");
  });

  it("invokes onPrimaryTabChange when SOCIAL is tapped", () => {
    const onPrimaryTabChange = vi.fn();
    render(
      <TerminalHeader
        theme={theme}
        currentThemeKey="matrix"
        onThemeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={onPrimaryTabChange}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "SOCIAL" }));
    expect(onPrimaryTabChange).toHaveBeenCalledWith("social");
  });

  it("keeps F1–F5 labels unchanged", () => {
    render(
      <TerminalHeader
        theme={theme}
        currentThemeKey="matrix"
        onThemeChange={vi.fn()}
        onCommand={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.getByText("F1 HELP")).toBeTruthy();
    expect(screen.getByText("F2 NET")).toBeTruthy();
    expect(screen.getByText("F3 DEX")).toBeTruthy();
    expect(screen.getByText("F4 THEME")).toBeTruthy();
    expect(screen.getByText("F5 SWAP")).toBeTruthy();
  });
});
