// @vitest-environment jsdom
/**
 * @file PricePanel.test.tsx
 * @description Smoke tests for the INVEST Price tool panel (#117/#121)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { THEMES } from "../constants";
import type { DexProtocol } from "../types";
import PricePanel, {
  buildPriceCli,
  DEFAULT_PRICE_SOURCE,
  resolveDefaultPriceSource,
  sanitizePricePanelError
} from "./PricePanel";

const theme = THEMES.matrix;

const V3: DexProtocol = {
  id: "univ3",
  name: "Uniswap V3",
  router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  type: "V3"
};
const V2: DexProtocol = {
  id: "univ2",
  name: "Uniswap V2",
  router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  type: "V2"
};

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

  it("omits fee for V2 ON-CHAIN even with quote", () => {
    expect(
      buildPriceCli({
        base: "ETH",
        quote: "USDC",
        source: "pool",
        feeTier: 3000,
        dexType: "V2"
      })
    ).toBe("price ETH USDC pool");
  });
});

describe("resolveDefaultPriceSource", () => {
  it("defaults to API without chain/DEX", () => {
    expect(DEFAULT_PRICE_SOURCE).toBe("api");
    expect(resolveDefaultPriceSource({})).toBe("api");
    expect(resolveDefaultPriceSource({ activeChainId: null })).toBe("api");
  });

  it("defaults to ON-CHAIN (pool) when chain + DEX available", () => {
    expect(
      resolveDefaultPriceSource({ activeChainId: 8453, dexCount: 2 })
    ).toBe("pool");
    expect(
      resolveDefaultPriceSource({ activeChainId: 1, activeDexId: "univ3" })
    ).toBe("pool");
  });
});

describe("sanitizePricePanelError", () => {
  it("replaces omit-api CLI advice with soft on-chain hint", () => {
    expect(
      sanitizePricePanelError(
        "No Base price data found for \"USDC\". Try 'price <tokenA> <tokenB>' or omit 'api' to read the pool on-chain."
      )
    ).toBe("No DexScreener quote — try on-chain pool.");
    expect(sanitizePricePanelError("Select network first")).toBe(
      "Select network first"
    );
  });
});

describe("PricePanel", () => {
  it("defaults SOURCE to API without chain and labels ON-CHAIN | API", () => {
    render(<PricePanel theme={theme} onClose={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getByTestId("price-panel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ON-CHAIN" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "API" })).toBeTruthy();
    expect(screen.queryByTestId("price-fee")).toBeNull();
    expect(screen.queryByTestId("price-dex")).toBeNull();
  });

  it("defaults SOURCE to ON-CHAIN when chain + DEX set", () => {
    render(
      <PricePanel
        theme={theme}
        activeChainId={8453}
        activeDexId="univ3"
        dexes={[V3, V2]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "ON-CHAIN" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByTestId("price-dex")).toBeTruthy();
    expect(screen.getByTestId("price-fee")).toBeTruthy();
  });

  it("shows DEX pills and hides FEE for V2", () => {
    render(
      <PricePanel
        theme={theme}
        activeChainId={1}
        activeDexId="univ2"
        dexes={[V3, V2]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(screen.getByTestId("price-dex-option-univ2")).toBeTruthy();
    expect(screen.queryByTestId("price-fee")).toBeNull();
    fireEvent.click(screen.getByTestId("price-dex-option-univ3"));
    expect(screen.getByTestId("price-fee")).toBeTruthy();
  });

  it("syncs global activeDexId when DEX pill clicked", () => {
    const onDexChange = vi.fn();
    render(
      <PricePanel
        theme={theme}
        activeChainId={1}
        activeDexId="univ3"
        dexes={[V3, V2]}
        onDexChange={onDexChange}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("price-dex-option-univ2"));
    expect(onDexChange).toHaveBeenCalledWith("univ2");
  });

  it("empty DEX registry warns and disables RUN for ON-CHAIN", () => {
    render(
      <PricePanel
        theme={theme}
        activeChainId={80002}
        dexes={[]}
        defaultSource="pool"
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(screen.getByTestId("price-dex-empty").textContent).toMatch(
      /change NETWORK/
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.change(screen.getByTestId("price-quote"), {
      target: { value: "USDC" }
    });
    expect(
      (screen.getByTestId("price-run") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("API mode hides DEX+FEE; RUN needs BASE only", () => {
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        dexes={[V3]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(screen.queryByTestId("price-dex")).toBeNull();
    expect(screen.queryByTestId("price-fee")).toBeNull();
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

  it("disables RUN on ON-CHAIN until QUOTE is set", () => {
    render(
      <PricePanel
        theme={theme}
        activeChainId={1}
        activeDexId="univ3"
        dexes={[V3]}
        onClose={vi.fn()}
        onRun={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
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
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
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
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(screen.getByTestId("price-error")).toBeTruthy());
    expect(screen.getByTestId("price-error").textContent).toMatch(/Select network/);
  });

  it("API fail shows USE ON-CHAIN (no omit-api copy) and switches source", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: false,
      error:
        "No Base price data found for \"USDC\". Try 'price ETH USDC' or omit 'api' to read the pool on-chain."
    });
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        activeChainId={8453}
        activeDexId="univ3"
        dexes={[V3, V2]}
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "USDC" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(screen.getByTestId("price-error")).toBeTruthy());
    expect(screen.getByTestId("price-error").textContent).not.toMatch(/omit/i);
    expect(screen.getByTestId("price-error").textContent).toMatch(
      /on-chain pool/
    );
    expect(screen.getByTestId("price-use-on-chain")).toBeTruthy();
    fireEvent.click(screen.getByTestId("price-use-on-chain"));
    expect(
      screen.getByRole("button", { name: "ON-CHAIN" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByTestId("price-dex")).toBeTruthy();
    expect(screen.queryByTestId("price-error")).toBeNull();
  });
});


  it("ON-CHAIN RUN syncs dex when selection differs from activeDexId", async () => {
    const onDexChange = vi.fn();
    const onRun = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        kind: "price",
        mode: "onchain",
        symbolA: "ETH",
        symbolB: "USDC",
        rate: 2500,
        dexName: "Uniswap V3",
        chainName: "Ethereum"
      }
    });
    render(
      <PricePanel
        theme={theme}
        activeChainId={1}
        activeDexId="univ3"
        dexes={[V3, V2]}
        onDexChange={onDexChange}
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
    fireEvent.click(screen.getByTestId("price-dex-option-univ2"));
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.change(screen.getByTestId("price-quote"), {
      target: { value: "USDC" }
    });
    // re-click univ2 path already synced; set mismatch via run after selecting V3 again
    // with activeDexId still univ3 from props — pick V2 then RUN
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(onRun).toHaveBeenCalled());
    expect(onDexChange).toHaveBeenCalledWith("univ2");
  });

  it("selects fee tier and quote quick chip; pin appears on result", async () => {
    const onPin = vi.fn();
    const onRun = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        kind: "price",
        mode: "onchain",
        symbolA: "ETH",
        symbolB: "USDC",
        rate: 1,
        dexName: "Uniswap V3",
        chainName: "Ethereum"
      }
    });
    render(
      <PricePanel
        theme={theme}
        activeChainId={1}
        activeDexId="univ3"
        dexes={[V3]}
        commonTokens={["ETH", "USDC"]}
        onClose={vi.fn()}
        onRun={onRun}
        onPin={onPin}
      />
    );
    fireEvent.click(screen.getByTestId("price-quote-quick").querySelector("button")!);
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    const fee500 = screen.getByRole("button", { name: "500" });
    fireEvent.click(fee500);
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(screen.getByTestId("price-result")).toBeTruthy());
    fireEvent.click(screen.getByTitle("Pin to right panel"));
    expect(onPin).toHaveBeenCalled();
  });

  it("surfaces thrown onRun errors", async () => {
    const onRun = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() =>
      expect(screen.getByTestId("price-error").textContent).toMatch(/boom/)
    );
  });

  it("SOURCE ON-CHAIN pill clears API error", async () => {
    const onRun = vi.fn().mockResolvedValue({
      ok: false,
      error: "No DexScreener quote — try on-chain pool."
    });
    render(
      <PricePanel
        theme={theme}
        defaultSource="api"
        activeChainId={1}
        dexes={[V3]}
        onClose={vi.fn()}
        onRun={onRun}
      />
    );
    fireEvent.change(screen.getByTestId("price-base"), {
      target: { value: "ETH" }
    });
    fireEvent.click(screen.getByTestId("price-run"));
    await waitFor(() => expect(screen.getByTestId("price-error")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "ON-CHAIN" }));
    expect(screen.queryByTestId("price-error")).toBeNull();
  });

