// @vitest-environment jsdom
/**
 * @file ShareCard.test.tsx
 * @description Render tests for look / status ShareCard (Designer lock #62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Address } from "viem";
import { THEMES } from "../constants";
import { emptyCard, mergeShareCard } from "../shareCard";
import { NO_ACTIVE_CHANNEL_MSG } from "../chatChannels";
import ShareCard from "./ShareCard";

const ALICE = "0x3333333333333333333333333333333333333333" as Address;

const baseCard = mergeShareCard(emptyCard(ALICE, "alice.eth"), {
  portfolio: {
    totalUsd: 2400,
    moreCount: 2,
    holdings: [{ symbol: "ETH", amount: "1.2", usd: 2400, chainId: 1 }]
  },
  pnl: {
    snapshotLabel: "start",
    snapshotAt: 1_700_000_000,
    totalUsd: 2400,
    pnlUsd: 12.5,
    pnlPct: 0.5
  }
});

describe("ShareCard chrome", () => {
  it.each(["matrix", "teletype", "dos"] as const)(
    "renders identity + sections on %s with theme tokens only",
    (mode) => {
      const theme = THEMES[mode];
      const { container } = render(
        <ShareCard card={baseCard} active theme={theme} hasActiveChannel />
      );
      expect(screen.getByText("alice.eth")).toBeTruthy();
      expect(screen.getByText("0x3333…3333")).toBeTruthy();
      expect(screen.getByText("SHARED")).toBeTruthy();
      expect(screen.getByText(/UPDATED /)).toBeTruthy();
      expect(screen.getByText("PORTFOLIO")).toBeTruthy();
      expect(screen.getByText("+2 more")).toBeTruthy();
      expect(screen.getByText("PNL")).toBeTruthy();
      expect(screen.getByText("CHAT")).toBeTruthy();
      expect(screen.getByText("COPY")).toBeTruthy();
      expect(container.textContent).not.toContain("▣");
      expect(container.innerHTML).not.toContain("text-red-400");
    }
  );

  it("REVOKED hides portfolio/pnl and shows revoke line", () => {
    render(
      <ShareCard card={{ ...baseCard, revoked: true }} active={false} theme={THEMES.matrix} />
    );
    expect(screen.getByText("REVOKED")).toBeTruthy();
    expect(screen.getByText("[!] Share revoked.")).toBeTruthy();
    expect(screen.queryByText("PORTFOLIO")).toBeNull();
    expect(screen.queryByText("PNL")).toBeNull();
  });

  it("CHAT fail-closed with no active channel", () => {
    const onWarn = vi.fn();
    const onFill = vi.fn();
    render(
      <ShareCard
        card={baseCard}
        active
        theme={THEMES.matrix}
        hasActiveChannel={false}
        onWarn={onWarn}
        onFillPrompt={onFill}
      />
    );
    fireEvent.click(screen.getByText("CHAT"));
    expect(onWarn).toHaveBeenCalledWith(NO_ACTIVE_CHANNEL_MSG);
    expect(onFill).not.toHaveBeenCalled();
  });

  it("CHAT prefills prompt when a channel is active", () => {
    const onFill = vi.fn();
    render(
      <ShareCard
        card={baseCard}
        active
        theme={THEMES.matrix}
        hasActiveChannel
        onFillPrompt={onFill}
      />
    );
    fireEvent.click(screen.getByText("CHAT"));
    expect(onFill).toHaveBeenCalledWith(`chat ${ALICE} `);
  });

  it("COPY acks truncated checksum", async () => {
    const onCopyAck = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    render(
      <ShareCard
        card={baseCard}
        active
        theme={THEMES.matrix}
        onCopyAck={onCopyAck}
      />
    );
    fireEvent.click(screen.getByText("COPY"));
    await vi.waitFor(() => {
      expect(onCopyAck).toHaveBeenCalledWith("[✓] Copied 0x3333…3333");
    });
  });

  it("negative pnl uses theme.warn class, never text-red-400", () => {
    const card = mergeShareCard(emptyCard(ALICE), {
      pnl: {
        snapshotLabel: "x",
        snapshotAt: 1,
        totalUsd: 1,
        pnlUsd: -4,
        pnlPct: -2
      }
    });
    const { container } = render(
      <ShareCard card={card} active theme={THEMES.matrix} />
    );
    expect(container.innerHTML).toContain(THEMES.matrix.warn);
    expect(container.innerHTML).not.toContain("text-red-400");
    expect(container.textContent).toContain("−");
  });
});
