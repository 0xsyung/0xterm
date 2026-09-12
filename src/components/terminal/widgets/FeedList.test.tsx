// @vitest-environment jsdom
/**
 * @file FeedList.test.tsx
 * @description Render tests for the share feed list (Designer lock #62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Address } from "viem";
import { THEMES } from "../constants";
import FeedList from "./FeedList";
import type { FeedItem } from "../shareCard";

const ALICE = "0x3333333333333333333333333333333333333333" as Address;

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  owner: ALICE,
  ens: "alice.eth",
  active: true,
  updatedAt: Math.floor(Date.now() / 1000) - 7200,
  totalUsd: 2400,
  pnlPct: 1.5,
  ...over
});

describe("FeedList", () => {
  it("empty feed is muted No shares yet.", () => {
    const { container } = render(<FeedList items={[]} theme={THEMES.matrix} />);
    expect(screen.getByText("No shares yet.")).toBeTruthy();
    expect(container.innerHTML).toContain(THEMES.matrix.muted);
    expect(container.textContent).not.toMatch(/\[!\]/);
  });

  it("rows are buttons that run look <owner>", () => {
    const onLook = vi.fn();
    render(
      <FeedList items={[item()]} theme={THEMES.teletype} onLook={onLook} />
    );
    expect(screen.getByText("SHARED")).toBeTruthy();
    expect(screen.getByText("alice.eth")).toBeTruthy();
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(onLook).toHaveBeenCalledWith(ALICE);
  });

  it("shows REVOKED badge and no pin", () => {
    const { container } = render(
      <FeedList items={[item({ active: false, ens: "" })]} theme={THEMES.dos} />
    );
    expect(screen.getByText("REVOKED")).toBeTruthy();
    expect(container.textContent).not.toContain("▣");
  });
});
