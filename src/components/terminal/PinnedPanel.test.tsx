// @vitest-environment jsdom
/**
 * @file PinnedPanel.test.tsx
 * @description Render tests for the pinned panel
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "./constants";
import PinnedPanel from "./PinnedPanel";
import type { PinnedManifest } from "./types";

const theme = THEMES.matrix;

const noops = { onRefresh: vi.fn(), onMinimize: vi.fn(), onUnpin: vi.fn() };

describe("PinnedPanel", () => {
  it("returns null when there are no pins", () => {
    const { container } = render(
      <PinnedPanel pinned={[]} theme={theme} {...noops} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a price pin via componentData", () => {
    const pricePin: PinnedManifest = {
      id: "p1",
      kind: "component",
      title: "USDC/WETH",
      componentData: {
        kind: "price",
        mode: "onchain",
        pairAddress: "0xAbC123",
        symbolA: "USDC",
        symbolB: "WETH",
        rate: 1.23,
        dexName: "Uniswap V3",
        chainName: "Base"
      }
    };
    render(<PinnedPanel pinned={[pricePin]} theme={theme} {...noops} />);
    expect(screen.getByText(/ON-CHAIN POOL PRICE \(Uniswap V3\)/)).toBeTruthy();
    expect(screen.getByText(/1 USDC =/)).toBeTruthy();
  });

  it("renders a help pin", () => {
    const helpPin: PinnedManifest = { id: "h1", kind: "help", title: "help" };
    render(<PinnedPanel pinned={[helpPin]} theme={theme} {...noops} />);
    expect(screen.getByText(/SYSTEM COMMAND MANUAL/)).toBeTruthy();
  });

  it("renders multiple pins with their titles", () => {
    const pins: PinnedManifest[] = [
      { id: "n1", kind: "networks", title: "networks" },
      { id: "h2", kind: "help", title: "help" }
    ];
    render(<PinnedPanel pinned={pins} theme={theme} {...noops} />);
    expect(screen.getByText(/AVAILABLE NETWORKS REGISTRY/)).toBeTruthy();
    expect(screen.getByText(/SYSTEM COMMAND MANUAL/)).toBeTruthy();
  });
});
