// @vitest-environment jsdom
/**
 * @file BindWidget.test.tsx
 * @description BindWidget renders the 12-row F-key keymap with origins and a
 * PinButton (#28)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import { defaultBindings } from "../keybindings";
import BindWidget from "./BindWidget";

const theme = THEMES.matrix;

describe("BindWidget shell", () => {
  it("renders a w-full shell with no max-w-*", () => {
    const el = render(<BindWidget data={defaultBindings()} theme={theme} />)
      .container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-full");
    expect(el.className).not.toMatch(/max-w-(md|lg|xl|2xl)/);
  });

  it("renders 12 F-key rows", () => {
    render(<BindWidget data={defaultBindings()} theme={theme} />);
    for (const k of ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]) {
      expect(screen.getByText(k)).toBeTruthy();
    }
    expect(screen.getAllByText(/default/)).toHaveLength(12);
  });

  it("marks user bindings and cleared keys", () => {
    const state = { ...defaultBindings(), map: { F6: "ticker", F2: "" } };
    render(<BindWidget data={state} theme={theme} />);
    expect(screen.getByText("ticker")).toBeTruthy();
    expect(screen.getAllByText("user")).toHaveLength(1);
    // F2 shows an em-dash for the cleared command
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows a PinButton when not pinned, and hides it when pinned", () => {
    const onPin = vi.fn();
    const { unmount } = render(<BindWidget data={defaultBindings()} theme={theme} onPin={onPin} />);
    expect(screen.getByTitle("Pin to right panel")).toBeTruthy();
    unmount();
    render(<BindWidget data={defaultBindings()} theme={theme} pinned />);
    expect(screen.queryByTitle("Pin to right panel")).toBeNull();
  });
});
