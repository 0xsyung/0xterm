// @vitest-environment jsdom
/**
 * @file InboxViews.test.tsx
 * @description Shared inbox list/thread extract helpers (#82)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import {
  InboxThreadList,
  InboxThreadMessages,
  shortAddr,
  type InboxThreadView
} from "./InboxViews";
import type { Address } from "viem";

const theme = THEMES.matrix;
const peer = "0x1111111111111111111111111111111111111111" as Address;
const self = "0x2222222222222222222222222222222222222222" as Address;

describe("shortAddr", () => {
  it("abbreviates long addresses", () => {
    expect(shortAddr(peer)).toBe("0x1111…1111");
  });
  it("passes through short strings", () => {
    expect(shortAddr("0xabc")).toBe("0xabc");
  });
});

describe("InboxThreadList", () => {
  it("renders empty label when no senders", () => {
    render(
      <InboxThreadList
        theme={theme}
        senders={[]}
        onOpenThread={() => {}}
        emptyLabel="No conversations"
      />
    );
    expect(screen.getByText("No conversations")).toBeTruthy();
  });

  it("opens a thread on row click", () => {
    const onOpen = vi.fn();
    render(
      <InboxThreadList
        theme={theme}
        senders={[{ peer, count: 2, label: "alice" }]}
        onOpenThread={onOpen}
      />
    );
    fireEvent.click(screen.getByText("alice"));
    expect(onOpen).toHaveBeenCalledWith(peer);
  });
});

describe("InboxThreadMessages", () => {
  const thread: InboxThreadView = {
    peer,
    self,
    peerLabel: "bob",
    messages: [
      {
        from: peer,
        timestamp: 1_700_000_000,
        iv: "0x00",
        ciphertext: "0x01",
        decrypted: "hello"
      }
    ]
  };

  it("renders decrypted message and back control", () => {
    const onBack = vi.fn();
    render(
      <InboxThreadMessages theme={theme} thread={thread} onBack={onBack} />
    );
    expect(screen.getByText("hello")).toBeTruthy();
    fireEvent.click(screen.getByText("‹ threads"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows cannot-decrypt fallback", () => {
    const t: InboxThreadView = {
      ...thread,
      messages: [
        {
          from: peer,
          timestamp: 1_700_000_000,
          iv: "0x00",
          ciphertext: "0x01",
          decryptFailed: true
        }
      ]
    };
    render(<InboxThreadMessages theme={theme} thread={t} />);
    expect(screen.getByText("[cannot decrypt — wrong key]")).toBeTruthy();
  });

  it("invokes onSend from composer", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <InboxThreadMessages theme={theme} thread={thread} onSend={onSend} />
    );
    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "yo" } });
    fireEvent.click(screen.getByLabelText("Send"));
    expect(onSend).toHaveBeenCalledWith("yo");
  });
});
