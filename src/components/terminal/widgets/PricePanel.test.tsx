// @vitest-environment jsdom
/**
 * @file PricePanel.test.tsx
 * @description Smoke tests for the INVEST Price tool panel (#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEMES } from "../constants";
import PricePanel, {
  buildPriceCli,
  DEFAULT_PRICE_SOURCE
} from "./PricePanel";

const theme = THEMES.matrix;

describe("buildPriceCli", () => {
  it("builds api and pool lines", () => {
    expect(
      buildPriceCli({ base: "ETH", quote: "USDC", source: "api", feeTier: 3000 })
    ).toBe("price ETH USDC api");
    expect(
      buildPriceCli({ base: "ETH", quote: "USDC", source: "pool", feeTier: 500 })
    ).toBe("price ETH USDC 500 pool");
  });

  it("omits fee when POOL has no quote (fee must not become tokenB)", () => {
    // Regression #118: was `price ETH 3000 pool` → CLI parses 3000 as quote.
    expect(
      buildPriceCli({ base: "ETH", quote: "", source: "pool", feeTier: 3000 })
    ).toBe("price ETH pool");
    expect(
      buildPriceCli({ base: "ETH", quote: "  ", source: "pool", feeTier: 3000 })
    ).toBe("price ETH pool");
  });
});

describe("PricePanel", () => {
  it("defaults SOURCE to API (safer zero-config) and hides FEE until POOL", () => {
    expect(DEFAULT_PRICE_SOURCE).toBe("api");
    render(
      <PricePanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />
    );
    expect(screen.getByTestId("price-panel")).toBeTruthy();
    expect(screen.queryByTestId("price-fee")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "POOL" }));
    expect(screen.getByTestId("price-fee")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "API" }));
    expect(screen.queryByTestId("price-fee")).toBeNull();
  });

  it("disables RUN without BASE", () => {
    render(<PricePanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    expect(
      (screen.getByTestId("price-run") as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    expect(
      (screen.getByTestId("price-run") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("disables RUN on POOL until QUOTE is set", () => {
    render(<PricePanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByRole("button", { name: "POOL" }));
    expect(
      (screen.getByTestId("price-run") as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.change(screen.getByTestId("price-quote"), {
      target: { value: "USDC" }
    });
    expect(
      (screen.getByTestId("price-run") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("quick chips fill BASE / QUOTE", () => {
    render(
      <PricePanel
        theme={theme}
        commonTokens={["ETH", "USDC", "DAI"]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("price-base-quick").querySelector("button")!);
    expect((screen.getByTestId("price-base") as HTMLInputElement).value).toBe(
      "ETH"
    );
  });

  it("RUN invokes onRun and renders result slot", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        kind: "price",
        mode: "api",
        tokenSymbol: "ETH",
        quoteSymbol: "USDC",
        priceUsd: "2500",
        priceNative: "1",
        dex: "uniswap",
        chain: "ethereum",
        h24: 1.2
      }
    });
    render(<PricePanel theme={theme} onClose={vi.fn()} onRun={onRun} />);
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.change(screen.getByTestId("price-quote"), {
      target: { value: "USDC" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(onRun).toHaveBeenCalled());
    expect(onRun.mock.calls[0][0]).toMatchObject({
      base: "ETH",
      quote: "USDC",
      source: "api"
    });
    await waitFor(() => expect(screen.getByTestId("price-result")).toBeTruthy());
  });

  it("Esc and × close the panel", () => {
    const onClose = vi.fn();
    render(<PricePanel theme={theme} onClose={onClose} onRun={vi.fn()} />);
    fireEvent.click(screen.getByTestId("price-panel-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("surfaces inline error without calling it Usage dump", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: false,
      error: "Select network and DEX first"
    });
    render(<PricePanel theme={theme} onClose={vi.fn()} onRun={onRun} />);
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(screen.getByTestId("price-error")).toBeTruthy());
    expect(screen.getByTestId("price-error").textContent).toMatch(/Select network/);
  });
});
