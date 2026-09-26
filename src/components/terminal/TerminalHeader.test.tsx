// @vitest-environment jsdom
/**
 * @file TerminalHeader.test.tsx
 * @description Header logo + NETWORK + single nav strip + CONSOLE-only F-row (#117/#121)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HEADER_H, HEADER_PAD, THEMES } from "./constants";
import TerminalHeader from "./TerminalHeader";

const theme = THEMES.matrix;

describe("TerminalHeader chrome (#117/#121)", () => {
  it("renders 32px logo (28 on narrow/coarse) and optional wordmark", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    const logo = screen.getByTestId("header-logo");
    expect(logo.getAttribute("src")).toBe("/logo.svg");
    expect(logo.getAttribute("width")).toBe("32");
    expect(logo.getAttribute("height")).toBe("32");
    expect(logo.getAttribute("alt")).toBe("0xTERM");
    expect(logo.className).toMatch(/w-8/);
    expect(logo.className).toMatch(/h-8/);
    expect(logo.className).toMatch(/max-md:w-7/);
    expect(logo.className).toMatch(/pointer-coarse:w-7/);
    const brand = screen.getByTestId("brand-cluster");
    expect(brand.textContent).toMatch(/0xTERM/);
  });

  it("HEADER_H / HEADER_PAD clear 32px mark on md (≥48px + safe)", () => {
    expect(HEADER_H).toMatch(/md:h-\[calc\(48px_/);
    expect(HEADER_PAD).toMatch(/md:pt-\[calc\(48px_/);
  });

  it("renders NETWORK control after clock; options = SUPPORTED_CHAINS", () => {
    const onChainSwitch = vi.fn();
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
        activeChainId={8453}
        onChainSwitch={onChainSwitch}
      />
    );
    const trigger = screen.getByTestId("header-network");
    expect(trigger.textContent).toMatch(/BASE/);
    fireEvent.click(trigger);
    expect(screen.getByTestId("header-network-option-1")).toBeTruthy();
    expect(screen.getByTestId("header-network-option-8453")).toBeTruthy();
    expect(screen.getByTestId("header-network-option-11155111")).toBeTruthy();
    fireEvent.click(screen.getByTestId("header-network-option-1"));
    expect(onChainSwitch).toHaveBeenCalledWith(1);
  });

  it("shows muted NETWORK placeholder when chain unset", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
        activeChainId={null}
      />
    );
    expect(screen.getByTestId("header-network").textContent).toMatch(/NETWORK/);
  });

  it("NETWORK is visible on SOCIAL / SETTINGS (not a mode chip)", () => {
    const { rerender } = render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="social"
        onPrimaryTabChange={vi.fn()}
        activeChainId={1}
      />
    );
    expect(screen.getByTestId("header-network")).toBeTruthy();
    rerender(
      <TerminalHeader
        theme={theme}
        mode="console"
        onModeChange={vi.fn()}
        primaryTab="settings"
        onPrimaryTabChange={vi.fn()}
        activeChainId={1}
      />
    );
    expect(screen.getByTestId("header-network")).toBeTruthy();
  });

  it("renders a single nav strip with modes + SOCIAL + SETTINGS and no TERMINAL peer", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("nav-strip")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "INVEST" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "DEV" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "FORENSIC" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "CONSOLE" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "SOCIAL" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "SETTINGS" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "TERMINAL" })).toBeNull();
    expect(screen.getByTestId("nav-separator").textContent).toBe("·");
  });

  it("marks only one chip active — mode when on terminal surface", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="dev"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "DEV" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(
      screen.getByRole("tab", { name: "INVEST" }).getAttribute("aria-selected")
    ).toBe("false");
    expect(
      screen.getByRole("tab", { name: "SOCIAL" }).getAttribute("aria-selected")
    ).toBe("false");
  });

  it("marks SOCIAL active (not a mode) when primaryTab is social", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="social"
        onPrimaryTabChange={vi.fn()}
        socialBadge={3}
      />
    );
    const social = screen.getByRole("tab", { name: /SOCIAL/ });
    expect(social.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("tab", { name: "INVEST" }).getAttribute("aria-selected")
    ).toBe("false");
  });

  it("mode chip sets mode and returns to terminal surface", () => {
    const onModeChange = vi.fn();
    const onPrimaryTabChange = vi.fn();
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={onModeChange}
        primaryTab="social"
        onPrimaryTabChange={onPrimaryTabChange}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "CONSOLE" }));
    expect(onModeChange).toHaveBeenCalledWith("console");
    expect(onPrimaryTabChange).toHaveBeenCalledWith("terminal");
  });

  it("SOCIAL / SETTINGS invoke onPrimaryTabChange only", () => {
    const onModeChange = vi.fn();
    const onPrimaryTabChange = vi.fn();
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={onModeChange}
        primaryTab="terminal"
        onPrimaryTabChange={onPrimaryTabChange}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "SOCIAL" }));
    expect(onPrimaryTabChange).toHaveBeenCalledWith("social");
    expect(onModeChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "SETTINGS" }));
    expect(onPrimaryTabChange).toHaveBeenCalledWith("settings");
  });

  it("scrolls chips on narrow via overflow-x-auto on the nav strip", () => {
    render(
      <TerminalHeader
        theme={theme}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    const strip = screen.getByTestId("nav-strip");
    expect(strip.className).toMatch(/max-md:overflow-x-auto/);
    expect(strip.className).toMatch(/max-md:basis-full/);
  });

  it("shows F1–F5 only on CONSOLE surface", () => {
    const { rerender } = render(
      <TerminalHeader
        theme={theme}
        onCommand={vi.fn()}
        mode="console"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("fkey-row")).toBeTruthy();
    expect(screen.getByText("F1 HELP")).toBeTruthy();
    expect(screen.getByText("F4 THEME")).toBeTruthy();

    rerender(
      <TerminalHeader
        theme={theme}
        onCommand={vi.fn()}
        mode="invest"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.queryByTestId("fkey-row")).toBeNull();
    expect(screen.queryByText("F1 HELP")).toBeNull();
  });

  it("hides F-row on SOCIAL even if mode is console", () => {
    render(
      <TerminalHeader
        theme={theme}
        onCommand={vi.fn()}
        mode="console"
        onModeChange={vi.fn()}
        primaryTab="social"
        onPrimaryTabChange={vi.fn()}
      />
    );
    expect(screen.queryByTestId("fkey-row")).toBeNull();
  });

  it("fires the bound command from a custom binding via onCommand on CONSOLE", () => {
    const onCommand = vi.fn();
    render(
      <TerminalHeader
        theme={theme}
        onCommand={onCommand}
        mode="console"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
        bindings={{ version: 1, footer: true, map: { F2: "balance" } }}
      />
    );
    fireEvent.click(screen.getByText("F2 BALANC"));
    expect(onCommand).toHaveBeenCalledWith("balance");
  });

  it("shows an em-dash for a cleared binding on CONSOLE", () => {
    render(
      <TerminalHeader
        theme={theme}
        onCommand={vi.fn()}
        mode="console"
        onModeChange={vi.fn()}
        primaryTab="terminal"
        onPrimaryTabChange={vi.fn()}
        bindings={{ version: 1, footer: true, map: { F3: "" } }}
      />
    );
    expect(screen.getByText("F3 —")).toBeTruthy();
  });
});
