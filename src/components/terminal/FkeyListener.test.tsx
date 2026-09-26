// @vitest-environment jsdom
/**
 * @file FkeyListener.test.tsx
 * @description CONSOLE-only gate for F-keys (#117 / #118)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import FkeyListener from "./FkeyListener";
import { defaultBindings } from "./keybindings";

describe("FkeyListener", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires onCommand when enabled (CONSOLE)", () => {
    const onCommand = vi.fn();
    render(
      <FkeyListener
        bindings={defaultBindings()}
        availableCommands={["theme", "help", "price"]}
        enabled
        onCommand={onCommand}
        setPendingConfirm={vi.fn()}
        onLogText={vi.fn()}
      />
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F1", bubbles: true, cancelable: true })
    );
    expect(onCommand).toHaveBeenCalled();
  });

  it("ignores F-keys when disabled (workspace / SOCIAL / SETTINGS)", () => {
    const onCommand = vi.fn();
    const onLogText = vi.fn();
    render(
      <FkeyListener
        bindings={defaultBindings()}
        availableCommands={["theme", "help", "price"]}
        enabled={false}
        onCommand={onCommand}
        setPendingConfirm={vi.fn()}
        onLogText={onLogText}
      />
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F1", bubbles: true, cancelable: true })
    );
    expect(onCommand).not.toHaveBeenCalled();
    expect(onLogText).not.toHaveBeenCalled();
  });
});
