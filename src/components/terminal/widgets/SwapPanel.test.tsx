// @vitest-environment jsdom
/**
 * @file SwapPanel.test.tsx
 * @description Smoke tests for the INVEST Swap tool panel (#119)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEMES } from "../constants";
import SwapPanel, {
  buildSwapCli,
  canRunSwap,
  isValidAmount,
  isValidSlippage,
  DEFAULT_SWAP_FEE,
  DEFAULT_SWAP_SLIPPAGE
} from "./SwapPanel";

const theme = THEMES.matrix;

describe("buildSwapCli", () => {
  it("always includes slippage + fee (panel defaults explicit)", () => {
    expect(
      buildSwapCli({
        amount: "100",
        fromToken: "USDC",
        toToken: "ETH",
        slippage: 0.5,
        feeTier: 3000
      })
    ).toBe("swap 100 USDC ETH 0.5 3000");
  });

  it("uses … placeholders for empty required fields (preview only)", () => {
    expect(
      buildSwapCli({
        amount: "",
        fromToken: "",
        toToken: "",
        slippage: DEFAULT_SWAP_SLIPPAGE,
        feeTier: DEFAULT_SWAP_FEE
      })
    ).toBe("swap … … … 0.5 3000");
  });
});

describe("canRunSwap / validators", () => {
  it("rejects empty / invalid amount", () => {
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("-1")).toBe(false);
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("100")).toBe(true);
  });

  it("rejects invalid slippage", () => {
    expect(isValidSlippage(0)).toBe(false);
    expect(isValidSlippage(-1)).toBe(false);
    expect(isValidSlippage(101)).toBe(false);
    expect(isValidSlippage(NaN)).toBe(false);
    expect(isValidSlippage(0.5)).toBe(true);
    expect(isValidSlippage(100)).toBe(true);
  });

  it("gates RUN on amount + from + to + slippage + FROM≠TO", () => {
    expect(
      canRunSwap({
        amount: "100",
        fromToken: "USDC",
        toToken: "ETH",
        slippage: 0.5
      })
    ).toBe(true);
    expect(
      canRunSwap({
        amount: "",
        fromToken: "USDC",
        toToken: "ETH",
        slippage: 0.5
      })
    ).toBe(false);
    expect(
      canRunSwap({
        amount: "100",
        fromToken: "USDC",
        toToken: "USDC",
        slippage: 0.5
      })
    ).toBe(false);
    expect(
      canRunSwap({
        amount: "100",
        fromToken: "USDC",
        toToken: "ETH",
        slippage: 0
      })
    ).toBe(false);
    expect(
      canRunSwap({
        amount: "100",
        fromToken: "USDC",
        toToken: "ETH",
        slippage: 0.5,
        running: true
      })
    ).toBe(false);
  });
});

describe("SwapPanel", () => {
  it("defaults fee 3000 and slippage 0.5; preview includes both", () => {
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getByTestId("swap-panel")).toBeTruthy();
    expect(screen.getByTestId("swap-preview").textContent).toBe(
      "swap … … … 0.5 3000"
    );
    expect(
      (screen.getByTestId("swap-slippage") as HTMLInputElement).value
    ).toBe("0.5");
  });

  it("disables RUN until amount + from + to filled", () => {
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    const run = () =>
      (screen.getByTestId("swap-run") as HTMLButtonElement).disabled;
    expect(run()).toBe(true);
    fireEvent.change(screen.getByTestId("swap-amount"), {
      target: { value: "100" }
    });
    expect(run()).toBe(true);
    fireEvent.change(screen.getByTestId("swap-from"), {
      target: { value: "USDC" }
    });
    expect(run()).toBe(true);
    fireEvent.change(screen.getByTestId("swap-to"), {
      target: { value: "ETH" }
    });
    expect(run()).toBe(false);
  });

  it("disables RUN and warns when FROM === TO", () => {
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    fireEvent.change(screen.getByTestId("swap-amount"), {
      target: { value: "1" }
    });
    fireEvent.change(screen.getByTestId("swap-from"), {
      target: { value: "ETH" }
    });
    fireEvent.change(screen.getByTestId("swap-to"), {
      target: { value: "eth" }
    });
    expect(
      (screen.getByTestId("swap-run") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByTestId("swap-warn-same").textContent).toMatch(/differ/i);
  });

  it("disables RUN and warns on invalid slippage", () => {
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    fireEvent.change(screen.getByTestId("swap-amount"), {
      target: { value: "1" }
    });
    fireEvent.change(screen.getByTestId("swap-from"), {
      target: { value: "USDC" }
    });
    fireEvent.change(screen.getByTestId("swap-to"), {
      target: { value: "ETH" }
    });
    fireEvent.change(screen.getByTestId("swap-slippage"), {
      target: { value: "0" }
    });
    expect(
      (screen.getByTestId("swap-run") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByTestId("swap-warn-slippage")).toBeTruthy();
  });

  it("quick chips fill FROM / TO separately", () => {
    render(
      <SwapPanel
        theme={theme}
        commonTokens={["ETH", "USDC", "DAI"]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByTestId("swap-from-quick").querySelector("button")!
    );
    expect((screen.getByTestId("swap-from") as HTMLInputElement).value).toBe(
      "ETH"
    );
    const toBtns = screen.getByTestId("swap-to-quick").querySelectorAll("button");
    fireEvent.click(toBtns[1]);
    expect((screen.getByTestId("swap-to") as HTMLInputElement).value).toBe(
      "USDC"
    );
  });

  it("RUN invokes onRun and renders confirm slot", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: true,
      component: <div data-testid="fake-swap-widget">SwapWidget</div>
    });
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={onRun} />);
    fireEvent.change(screen.getByTestId("swap-amount"), {
      target: { value: "100" }
    });
    fireEvent.change(screen.getByTestId("swap-from"), {
      target: { value: "USDC" }
    });
    fireEvent.change(screen.getByTestId("swap-to"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("swap-run"));
    await waitFor(() => expect(onRun).toHaveBeenCalled());
    expect(onRun.mock.calls[0][0]).toMatchObject({
      amount: "100",
      fromToken: "USDC",
      toToken: "ETH",
      slippage: 0.5,
      feeTier: 3000
    });
    await waitFor(() =>
      expect(screen.getByTestId("fake-swap-widget")).toBeTruthy()
    );
  });

  it("Esc and × close the panel", () => {
    const onClose = vi.fn();
    render(<SwapPanel theme={theme} onClose={onClose} onRun={vi.fn()} />);
    fireEvent.click(screen.getByTestId("swap-panel-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("surfaces inline error without Usage dump", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: false,
      error: "Wallet not connected."
    });
    render(<SwapPanel theme={theme} onClose={vi.fn()} onRun={onRun} />);
    fireEvent.change(screen.getByTestId("swap-amount"), {
      target: { value: "1" }
    });
    fireEvent.change(screen.getByTestId("swap-from"), {
      target: { value: "USDC" }
    });
    fireEvent.change(screen.getByTestId("swap-to"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("swap-run"));
    await waitFor(() => expect(screen.getByTestId("swap-error")).toBeTruthy());
    expect(screen.getByTestId("swap-error").textContent).toMatch(/Wallet/);
  });
});
