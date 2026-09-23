// @vitest-environment jsdom
/**
 * @file SocialPanel.test.tsx
 * @description Render tests for the Social surface: inbox + board tabs (#63/#6)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEMES } from "./constants";
import SocialPanel from "./SocialPanel";

const theme = THEMES.matrix;

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

describe("SocialPanel inbox tab", () => {
  it("renders INBOX/BOARD segments and channel hint", () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={vi.fn()}
        inboxUnread={3}
        boardUnread={0}
        channelLabel="0xterm.eth"
        isConnected
        loadSenders={vi.fn(async () => [])}
        loadThread={vi.fn()}
        loadBoard={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /INBOX/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /BOARD/ })).toBeTruthy();
    expect(screen.getByText(/CHANNEL: 0xterm\.eth/)).toBeTruthy();
  });

  it("prompts to connect when not connected", () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel={null}
        isConnected={false}
        loadSenders={vi.fn()}
        loadThread={vi.fn()}
        loadBoard={vi.fn()}
      />
    );
    expect(screen.getByText(/Connect a wallet to read chat\./)).toBeTruthy();
  });

  it("shows empty-senders copy when connected with a channel", async () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel="0xterm.eth"
        isConnected
        loadSenders={vi.fn(async () => [])}
        loadThread={vi.fn()}
        loadBoard={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/No messages yet\. Send with/)).toBeTruthy()
    );
  });

  it("lists senders and opens a thread on click", async () => {
    const loadThread = vi.fn(async () => ({
      messages: [
        { from: ALICE, timestamp: 1700000000, iv: "0x1234", ciphertext: "0x5678", decrypted: "hi" }
      ],
      peer: ALICE as `0x${string}`,
      self: BOB as `0x${string}`,
      peerLabel: "Alice"
    }));
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel="0xterm.eth"
        isConnected
        loadSenders={vi.fn(async () => [{ peer: ALICE as `0x${string}`, count: 2, label: "Alice" }])}
        loadThread={loadThread}
        loadBoard={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(screen.getByText(/CHAT · Alice/)).toBeTruthy());
    expect(screen.getByText("hi")).toBeTruthy();
  });

  it("shows an inbox load error", async () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel="0xterm.eth"
        isConnected
        loadSenders={vi.fn(async () => { throw new Error("boom"); })}
        loadThread={vi.fn()}
        loadBoard={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
  });
});

describe("SocialPanel board tab", () => {
  const BOARD = {
    posts: [
      { author: ALICE, timestamp: 1700000000, content: "hello board" }
    ],
    total: 1,
    pageSize: 5,
    onLoadPage: undefined
  };

  it("renders board posts and pagination", async () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="board"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel={null}
        isConnected
        loadSenders={vi.fn()}
        loadThread={vi.fn()}
        loadBoard={vi.fn(async () => BOARD)}
      />
    );
    await waitFor(() => expect(screen.getByText("hello board")).toBeTruthy());
    expect(screen.getByText(/from 0x1111…1111/)).toBeTruthy();
    expect(screen.getByText(/page 1 \/ 1/)).toBeTruthy();
  });

  it("shows empty-board copy", async () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="board"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel={null}
        isConnected
        loadSenders={vi.fn()}
        loadThread={vi.fn()}
        loadBoard={vi.fn(async () => ({ posts: [], total: 0, pageSize: 5 }))}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/No posts yet\. Post with/)).toBeTruthy()
    );
  });

  it("shows board load error", async () => {
    render(
      <SocialPanel
        theme={theme}
        subTab="board"
        onSubTabChange={vi.fn()}
        inboxUnread={0}
        boardUnread={0}
        channelLabel={null}
        isConnected
        loadSenders={vi.fn()}
        loadThread={vi.fn()}
        loadBoard={vi.fn(async () => { throw new Error("board down"); })}
      />
    );
    await waitFor(() => expect(screen.getByText("board down")).toBeTruthy());
  });

  it("switches tabs via onSubTabChange", () => {
    const onSubTabChange = vi.fn();
    render(
      <SocialPanel
        theme={theme}
        subTab="inbox"
        onSubTabChange={onSubTabChange}
        inboxUnread={0}
        boardUnread={0}
        channelLabel={null}
        isConnected
        loadSenders={vi.fn(async () => [])}
        loadThread={vi.fn()}
        loadBoard={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /BOARD/ }));
    expect(onSubTabChange).toHaveBeenCalledWith("board");
  });
});
