// @vitest-environment jsdom
/**
 * @file FeedbackWidget.test.tsx
 * @description Compose widget tests for the feedback command (#19)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEMES } from "../constants";
import FeedbackWidget from "./FeedbackWidget";

const theme = THEMES.matrix;

const mockOpen = vi.fn();
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockOpen.mockReset();
  mockOpen.mockReturnValue({} as Window);
  Object.defineProperty(window, "open", {
    configurable: true,
    value: mockOpen
  });
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderWidget = (props: Record<string, unknown> = {}) =>
  render(
    <FeedbackWidget
      theme={theme}
      signer="0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
      themeName="matrix"
      chainLabel="Base (8453)"
      onLogText={vi.fn()}
      {...props}
    />
  );

describe("FeedbackWidget", () => {
  it("opens the GitHub form with redacted body on clean submit", async () => {
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "swap failed on base" }
    });
    fireEvent.click(screen.getByText("open github"));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const url = mockOpen.mock.calls[0]![0] as string;
    expect(url).toContain("issues/new");
    expect(url).toContain("labels=feedback");
    expect(decodeURIComponent(url)).toContain("swap failed on base");
    expect(decodeURIComponent(url)).toContain("0xABCD…EF12");
  });

  it("requires YES before opening when a secret is present", async () => {
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: `my key is ${"ab".repeat(32)}` }
    });
    fireEvent.click(screen.getByText("open github"));
    // Gate is up; GitHub must NOT have been opened yet.
    expect(mockOpen).not.toHaveBeenCalled();
    expect(screen.getByText(/type YES to open the redacted github form/)).toBeTruthy();
    // The opened body is redacted.
    fireEvent.click(screen.getByText("YES"));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const url = mockOpen.mock.calls[0]![0] as string;
    expect(url).not.toContain("ab".repeat(32));
    expect(decodeURIComponent(url)).toContain("[redacted:privkey]");
  });

  it("shows FB_EMPTY on empty submit", () => {
    renderWidget();
    fireEvent.click(screen.getByText("open github"));
    expect(screen.getByText(/write a few words first/)).toBeTruthy();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("shows a copy-able URL when the popup is blocked", () => {
    mockOpen.mockReturnValue(null);
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "help" }
    });
    fireEvent.click(screen.getByText("open github"));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const pre = screen.getByText(/issues\/new/);
    expect(pre).toBeTruthy();
  });

  it("logs FB_OPENED on success", async () => {
    const onLogText = vi.fn();
    const win = { opener: {} as Window | null } as Window;
    mockOpen.mockReturnValue(win);
    renderWidget({ onLogText });
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "typo" }
    });
    fireEvent.click(screen.getByText("open github"));
    await waitFor(() =>
      expect(onLogText).toHaveBeenCalledWith(expect.stringContaining("opened"))
    );
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining("issues/new"), "_blank");
    expect(win.opener).toBeNull();
  });

  it("logs FB_LONG and copies to clipboard on overlong body", async () => {
    const onLogText = vi.fn();
    renderWidget({ onLogText });
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "x".repeat(6000) }
    });
    fireEvent.click(screen.getByText("open github"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    await waitFor(() =>
      expect(onLogText).toHaveBeenCalledWith(
        "body copied to clipboard; paste it into the github form.",
        true
      )
    );
  });

  it("starts with the secret gate up when initialGate is set (one-shot flagged)", () => {
    renderWidget({ initialText: "help", initialGate: true });
    expect(screen.getByText(/type YES to open the redacted github form/)).toBeTruthy();
  });

  it("renders read-only when pinned", () => {
    renderWidget({ pinned: true });
    expect(screen.queryByText("open github")).toBeNull();
    expect(screen.getByPlaceholderText(/what broke/i)).toHaveProperty("disabled", true);
  });

  it("sets data-retain-focus so the shell does not steal prompt focus", () => {
    const { container } = renderWidget();
    expect(container.querySelector("[data-retain-focus]")).toBeTruthy();
  });
});
