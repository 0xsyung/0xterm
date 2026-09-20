// @vitest-environment jsdom
/**
 * @file DigEditorWidget.test.tsx
 * @description Dig editor layout + gutter scroll sync (#92 #98)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import DigEditorWidget from "./DigEditorWidget";

vi.mock("../dig/idb", () => ({
  saveDigSource: vi.fn().mockResolvedValue(undefined)
}));

const theme = THEMES.matrix;

describe("DigEditorWidget (#92 #98)", () => {
  it("editor shell uses min-h-0, internal overflow scroll, and prompt gap", () => {
    const { container } = render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent={"line1\nline2\nline3\n"}
      />
    );
    const shell = container.querySelector("[data-dig-editor]");
    expect(shell).toBeTruthy();
    const cls = shell!.className;
    expect(cls).toMatch(/\bmin-h-0\b/);
    expect(cls).toMatch(/\bmb-3\b/); // 12px above status/prompt
    expect(cls).toMatch(/\bflex\b/);
    expect(cls).toMatch(/\bflex-col\b/);

    const body = shell!.querySelector(".flex.flex-1.min-h-0");
    expect(body).toBeTruthy();
    expect(body!.className).toMatch(/\bmin-h-0\b/);

    const ta = screen.getByLabelText("Source Counter.sol");
    expect(ta.className).toMatch(/\bmin-h-0\b/);
    expect(ta.className).toMatch(/\boverflow-y-auto\b/);
  });

  it("Esc closes and invokes onClose", () => {
    const onClose = vi.fn();
    render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent="pragma solidity ^0.8.37;"
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets data-retain-focus so shell does not steal prompt focus", () => {
    const { container } = render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent="pragma solidity ^0.8.37;"
      />
    );
    const shell = container.querySelector("[data-dig-editor]");
    expect(shell).toBeTruthy();
    expect(shell!.hasAttribute("data-retain-focus")).toBe(true);
  });

  it("stopPropagation on mouseDown/click keeps retain-focus path", () => {
    const { container } = render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent="pragma solidity ^0.8.37;"
      />
    );
    const shell = container.querySelector("[data-dig-editor]") as HTMLElement;
    const md = fireEvent.mouseDown(shell);
    const cl = fireEvent.click(shell);
    // fireEvent returns false when preventDefault was called; we only stopPropagation
    expect(md).toBe(true);
    expect(cl).toBe(true);
  });

  it("gutter is overflow-y scrollable with scrollbar hidden (#98)", () => {
    const { container } = render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent={Array.from({ length: 40 }, (_, i) => `// ${i}`).join("\n")}
      />
    );
    const gutter = container.querySelector("[data-dig-gutter]") as HTMLElement;
    expect(gutter).toBeTruthy();
    expect(gutter.className).toMatch(/\boverflow-y-auto\b/);
    expect(gutter.className).toMatch(/\bmin-h-0\b/);
    expect(gutter.className).toMatch(/scrollbar-width:none/);
    // Match textarea type size for vertical align
    expect(gutter.className).toMatch(/text-\[16px\]/);
    expect(gutter.className).toMatch(/md:text-\[12px\]/);
  });

  it("textarea scrollTop syncs to gutter scrollTop (#98)", () => {
    const { container } = render(
      <DigEditorWidget
        theme={theme}
        filename="Counter.sol"
        initialContent={Array.from({ length: 80 }, (_, i) => `// line ${i}`).join("\n")}
      />
    );
    const ta = screen.getByLabelText("Source Counter.sol") as HTMLTextAreaElement;
    const gutter = container.querySelector("[data-dig-gutter]") as HTMLElement;
    expect(gutter).toBeTruthy();

    // jsdom: set scrollTop + fire scroll; assert sync handler copies value
    Object.defineProperty(ta, "scrollTop", { configurable: true, value: 120, writable: true });
    Object.defineProperty(gutter, "scrollTop", {
      configurable: true,
      get() {
        return (gutter as HTMLElement & { _st?: number })._st ?? 0;
      },
      set(v: number) {
        (gutter as HTMLElement & { _st?: number })._st = v;
      }
    });
    fireEvent.scroll(ta);
    expect(gutter.scrollTop).toBe(120);
  });

});
