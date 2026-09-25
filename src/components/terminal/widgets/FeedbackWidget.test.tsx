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
import FeedbackWidget, { type FeedbackDraft } from "./FeedbackWidget";

const theme = THEMES.matrix;

type SubmitFn = (draft: FeedbackDraft) => Promise<{ ok: true } | { ok: false; error?: string }>;

let onSubmit: SubmitFn & ReturnType<typeof vi.fn>;

beforeEach(() => {
  onSubmit = vi.fn(async () => ({ ok: true }));
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
      onSubmit={onSubmit}
      onLogText={vi.fn()}
      {...props}
    />
  );

describe("FeedbackWidget", () => {
  it("sends the redacted body on clean submit", async () => {
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "swap failed on base" }
    });
    fireEvent.click(screen.getByText("send feedback"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const draft = onSubmit.mock.calls[0]![0] as FeedbackDraft;
    expect(draft.text).toContain("swap failed on base");
    expect(draft.includeAddress).toBe(true);
  });

  it("requires YES before sending when a secret is present", async () => {
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: `my key is ${"ab".repeat(32)}` }
    });
    fireEvent.click(screen.getByText("send feedback"));
    // Gate is up; onSubmit must NOT have been called yet.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/type YES to send the redacted message/)).toBeTruthy();
    // The sent body is redacted.
    fireEvent.click(screen.getByText("YES"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const draft = onSubmit.mock.calls[0]![0] as FeedbackDraft;
    expect(draft.text).not.toContain("ab".repeat(32));
    expect(draft.text).toContain("[redacted:privkey]");
  });

  it("shows the empty message on empty submit", () => {
    renderWidget();
    fireEvent.click(screen.getByText("send feedback"));
    expect(screen.getByText(/write a few words first/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a send error from onSubmit", async () => {
    onSubmit.mockResolvedValueOnce({ ok: false, error: "no network" });
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "help" }
    });
    fireEvent.click(screen.getByText("send feedback"));
    await waitFor(() => expect(screen.getByText(/no network/)).toBeTruthy());
  });

  it("dismisses the secret gate with the no button", () => {
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: `my key is ${"ab".repeat(32)}` }
    });
    fireEvent.click(screen.getByText("send feedback"));
    expect(screen.getByText(/type YES to send the redacted message/)).toBeTruthy();
    fireEvent.click(screen.getByText("no"));
    expect(screen.queryByText(/type YES to send the redacted message/)).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels and calls onCancel", () => {
    const onCancel = vi.fn();
    renderWidget({ onCancel });
    fireEvent.click(screen.getByText("cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("starts with the secret gate up when initialGate is set (one-shot flagged)", () => {
    renderWidget({ initialText: "help", initialGate: true });
    expect(screen.getByText(/type YES to send the redacted message/)).toBeTruthy();
  });

  it("renders read-only when pinned", () => {
    renderWidget({ pinned: true });
    expect(screen.queryByText("send feedback")).toBeNull();
    expect(screen.getByPlaceholderText(/what broke/i)).toHaveProperty("disabled", true);
  });

  it("sets data-retain-focus so the shell does not steal prompt focus", () => {
    const { container } = renderWidget();
    expect(container.querySelector("[data-retain-focus]")).toBeTruthy();
  });

  it("shows the sending indicator while onSubmit is pending", async () => {
    let resolveSend!: (v: { ok: true }) => void;
    onSubmit.mockImplementationOnce(
      () => new Promise<{ ok: true }>((r) => (resolveSend = r))
    );
    renderWidget();
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "slow feedback" }
    });
    fireEvent.click(screen.getByText("send feedback"));
    expect(screen.getByText(/sending…/)).toBeTruthy();
    resolveSend({ ok: true });
    await waitFor(() => expect(screen.queryByText(/sending…/)).toBeNull());
  });

  it("sends email and no-address choices in the draft", async () => {
    renderWidget({ noAddress: true });
    fireEvent.change(screen.getByPlaceholderText(/what broke/i), {
      target: { value: "include my contact" }
    });
    fireEvent.change(screen.getByPlaceholderText(/email \(optional\)/), {
      target: { value: "me@example.com" }
    });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveProperty("checked", false); // noAddress → unchecked
    fireEvent.click(checkbox);
    expect(checkbox).toHaveProperty("checked", true);
    fireEvent.click(screen.getByText("send feedback"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const draft = onSubmit.mock.calls[0]![0] as FeedbackDraft;
    expect(draft.email).toBe("me@example.com");
    expect(draft.includeAddress).toBe(true);
  });
});
