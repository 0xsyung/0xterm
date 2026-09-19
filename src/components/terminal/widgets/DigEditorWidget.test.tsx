// @vitest-environment jsdom
/**
 * @file DigEditorWidget.test.tsx
 * @description Dig editor layout chrome — min-h-0 + internal scroll (#92)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import DigEditorWidget from "./DigEditorWidget";

vi.mock("../dig/idb", () => ({
  saveDigSource: vi.fn().mockResolvedValue(undefined)
}));

const theme = THEMES.matrix;

describe("DigEditorWidget (#92)", () => {
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
});
