// @vitest-environment jsdom
/**
 * @file FloatingChat.test.tsx
 * @description Floating messenger badge / focus-retain / expand (#82)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { THEMES } from "../constants";
import FloatingChat from "./FloatingChat";
import type { Address } from "viem";

const theme = THEMES.matrix;
const peer = "0x1111111111111111111111111111111111111111" as Address;
const self = "0x2222222222222222222222222222222222222222" as Address;

function renderFloater(overrides: Partial<Parameters<typeof FloatingChat>[0]> = {}) {
  const onAckInbox = vi.fn();
  const onOpenChange = vi.fn();
  const onFocusPrompt = vi.fn();
  const loadSenders = vi.fn().mockResolvedValue([
    { peer, count: 1, label: "alice" }
  ]);
  const loadThread = vi.fn().mockResolvedValue({
    peer,
    self,
    peerLabel: "alice",
    messages: []
  });
  const result = render(
    <div style={{ position: "relative", height: 800, width: 1280 }}>
      <FloatingChat
        theme={theme}
        themeKey="matrix"
        inboxUnread={3}
        channelLabel="sepolia-chat"
        isConnected
        promptClearancePx={100}
        primaryTab="terminal"
        loadSenders={loadSenders}
        loadThread={loadThread}
        onAckInbox={onAckInbox}
        onOpenChange={onOpenChange}
        onFocusPrompt={onFocusPrompt}
        {...overrides}
      />
    </div>
  );
  return { ...result, onAckInbox, onOpenChange, onFocusPrompt, loadSenders, loadThread };
}

describe("FloatingChat (#82)", () => {
  it("shows unread badge via formatBadgeCount (3)", () => {
    const { container } = renderFloater({ inboxUnread: 3 });
    const bubble = container.querySelector("[data-floating-chat-bubble]");
    expect(bubble).toBeTruthy();
    expect(bubble!.textContent).toContain("CHAT");
    expect(bubble!.textContent).toContain("3");
  });

  it("hides badge when unread is 0", () => {
    const { container } = renderFloater({ inboxUnread: 0 });
    const bubble = container.querySelector("[data-floating-chat-bubble]");
    expect(bubble!.textContent).not.toMatch(/\d/);
  });

  it("shows 9+ for unread > 9", () => {
    const { container } = renderFloater({ inboxUnread: 12 });
    expect(
      container.querySelector("[data-floating-chat-bubble]")!.textContent
    ).toContain("9+");
  });

  it("collapsed bubble has no data-retain-focus", () => {
    const { container } = renderFloater();
    const bubble = container.querySelector("[data-floating-chat-bubble]");
    expect(bubble!.hasAttribute("data-retain-focus")).toBe(false);
  });

  it("expand acks inbox, mounts retain-focus panel, loads senders", async () => {
    const { container, onAckInbox, onOpenChange, loadSenders } = renderFloater();
    fireEvent.click(container.querySelector("[data-floating-chat-bubble]")!);
    expect(onAckInbox).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    const panel = container.querySelector("[data-floating-chat-panel]");
    expect(panel).toBeTruthy();
    expect(panel!.hasAttribute("data-retain-focus")).toBe(true);
    await waitFor(() => expect(loadSenders).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("alice")).toBeTruthy());
  });

  it("Esc collapses when focus inside panel and returns prompt focus on TERMINAL", async () => {
    const { container, onFocusPrompt, onOpenChange } = renderFloater();
    fireEvent.click(container.querySelector("[data-floating-chat-bubble]")!);
    const panel = container.querySelector(
      "[data-floating-chat-panel]"
    ) as HTMLElement;
    await waitFor(() => expect(panel).toBeTruthy());
    panel.focus();
    fireEvent.keyDown(window, { key: "Escape", bubbles: true });
    // capture listener on window
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    window.dispatchEvent(esc);
    await waitFor(() => {
      expect(
        container.querySelector("[data-floating-chat-panel]")
      ).toBeNull();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onFocusPrompt).toHaveBeenCalled();
  });

  it("stopPropagation on panel mouseDown/click", async () => {
    const { container } = renderFloater();
    fireEvent.click(container.querySelector("[data-floating-chat-bubble]")!);
    const panel = (await waitFor(() =>
      container.querySelector("[data-floating-chat-panel]")
    )) as HTMLElement;
    const md = fireEvent.mouseDown(panel);
    const cl = fireEvent.click(panel);
    expect(md).toBe(true);
    expect(cl).toBe(true);
  });

  it("no-channel muted one-liner", async () => {
    const { container } = renderFloater({ channelLabel: null });
    fireEvent.click(container.querySelector("[data-floating-chat-bubble]")!);
    await waitFor(() =>
      expect(screen.getByText(/No active channel/)).toBeTruthy()
    );
  });

  it("does not steal focus path when collapsed (bubble outside retain-focus)", () => {
    const { container } = renderFloater();
    expect(container.querySelector("[data-retain-focus]")).toBeNull();
  });
});
