// @vitest-environment jsdom
/**
 * @file WidgetsShell.test.tsx
 * @description Issue #5 — log-column widget shells are w-full (no max-w-*),
 * numeric nodes use tabular-nums, and MatrixRain is never mounted.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import HelpManual from "./HelpManual";
import NetworksList from "./NetworksList";
import BalanceWidget from "./BalanceWidget";
import PriceCard from "./PriceCard";
import type { PriceCardData } from "./PriceCard";
import BillboardWidget from "./BillboardWidget";
import ChatWidget from "./ChatWidget";
import PortfolioWidget from "./PortfolioWidget";
import type { PortfolioHolding } from "./PortfolioWidget";

const theme = THEMES.matrix;
const ALL_THEMES = Object.values(THEMES);

const PRICE_API: PriceCardData = {
  kind: "price",
  mode: "api",
  tokenSymbol: "USDC",
  quoteSymbol: "WETH",
  dex: "uniswap",
  chain: "base",
  priceUsd: "0.9999",
  priceNative: "0.00042",
  h24: 1.5
};

const holding = (over: Partial<PortfolioHolding> = {}): PortfolioHolding => ({
  chainName: "Base",
  chainId: 8453,
  symbol: "USDC",
  type: "erc20",
  balance: "100.00",
  priceUsd: 1,
  valueUsd: 100,
  change24h: 1.5,
  priceSource: "api",
  isTestnet: false,
  ...over
});

describe("widget shells are w-full (issue #5 width)", () => {
  const cases: Array<[string, () => HTMLElement]> = [
    ["HelpManual", () => render(<HelpManual theme={theme} />).container.firstElementChild as HTMLElement],
    ["NetworksList", () => render(<NetworksList theme={theme} />).container.firstElementChild as HTMLElement],
    ["BalanceWidget", () => render(<BalanceWidget balance="1.5" symbol="ETH" theme={theme} />).container.firstElementChild as HTMLElement],
    ["PriceCard onchain", () => render(<PriceCard theme={theme} data={{ kind: "price", mode: "onchain", symbolA: "USDC", symbolB: "WETH", rate: 1.2 }} />).container.firstElementChild as HTMLElement],
    ["PriceCard api", () => render(<PriceCard theme={theme} data={PRICE_API} />).container.firstElementChild as HTMLElement],
    ["BillboardWidget", () => render(<BillboardWidget posts={[]} total={0} theme={theme} />).container.firstElementChild as HTMLElement],
    [
      "ChatWidget",
      () =>
        render(
          <ChatWidget
            messages={[]}
            peer={"0x" + "1".repeat(40)}
            theme={theme}
          />
        ).container.firstElementChild as HTMLElement
    ],
    [
      "PortfolioWidget",
      () =>
        render(
          <PortfolioWidget holdings={[holding()]} theme={theme} />
        ).container.firstElementChild as HTMLElement
    ]
  ];

  for (const [name, getShell] of cases) {
    it(`${name} shell has w-full and no max-w-*`, () => {
      const el = getShell();
      expect(el.className).toContain("w-full");
      expect(el.className).not.toMatch(/max-w-(md|lg|xl|2xl)/);
    });
  }
});

describe("numeric nodes use tabular-nums (issue #5 type)", () => {
  it("BalanceWidget balance text has tabular-nums", () => {
    const { container } = render(
      <BalanceWidget balance="1.5" symbol="ETH" theme={theme} />
    );
    expect(container.textContent).toContain("1.5 ETH");
    expect(container.firstElementChild!.className).toContain("tabular-nums");
  });

  it("PriceCard api price nodes carry tabular-nums and theme colors", () => {
    const { container } = render(<PriceCard theme={theme} data={PRICE_API} />);
    const usd = screen.getByText(/\$0\.9999/);
    expect(usd.className).toContain("tabular-nums");
    expect(usd.className).toContain(theme.primary);
    const native = screen.getByText(/0\.00042/);
    expect(native.className).toContain("tabular-nums");
    const h24 = screen.getByText(/\+1\.5%/);
    expect(h24.className).toContain("tabular-nums");
    expect(h24.className).toContain(theme.primary);
    expect(container.innerHTML).not.toContain("text-red-400");
  });

  it("PriceCard negative 24h uses theme.warn (no red-400)", () => {
    render(<PriceCard theme={theme} data={{ ...PRICE_API, h24: -2.1 }} />);
    const h24 = screen.getByText(/-2\.1%/);
    expect(h24.className).toContain("tabular-nums");
    expect(h24.className).toContain(theme.warn);
    expect(h24.className).not.toContain("text-red-400");
  });
});

describe("widgets mount under all 8 themes (issue #5 theme loop)", () => {
  for (const t of ALL_THEMES) {
    it(`HelpManual + PriceCard + BalanceWidget render under ${t.name}`, () => {
      render(<HelpManual theme={t} />);
      render(
        <PriceCard
          theme={t}
          data={{ kind: "price", mode: "api", tokenSymbol: "USDC", quoteSymbol: "WETH", dex: "uniswap", chain: "base", priceUsd: "1.0", priceNative: "0.0004", h24: 0 }}
        />
      );
      render(<BalanceWidget balance="0" symbol="ETH" theme={t} />);
    });
  }
});

describe("MatrixRain is not mounted (issue #5 motion/rain)", () => {
  const shellSrc = readFileSync(
    resolve(__dirname, "../TerminalShell.tsx"),
    "utf8"
  );
  const appSrc = readFileSync(
    resolve(__dirname, "../TerminalApp.tsx"),
    "utf8"
  );

  it("TerminalShell does not import or render MatrixRain", () => {
    expect(shellSrc).not.toMatch(/import MatrixRain/);
    expect(shellSrc).not.toMatch(/<MatrixRain/);
  });

  it("rain command stays a muted no-op, not a canvas/rAF", () => {
    expect(shellSrc).toContain("rain is disabled.");
    expect(shellSrc).toContain("muted");
    expect(shellSrc).not.toMatch(/onToggleRain/);
    expect(shellSrc).not.toMatch(/requestAnimationFrame|createElement\("canvas"\)/);
  });

  it("TerminalApp no longer wires onToggleRain", () => {
    expect(appSrc).not.toMatch(/isRainActive|toggleRain|onToggleRain/);
  });
});

describe("wagmi-bound widget shells are w-full (issue #5 width)", () => {
  const WIDGET_SRC: Record<string, string> = {
    SwapWidget: readFileSync(resolve(__dirname, "../SwapWidget.tsx"), "utf8"),
    DeployWidget: readFileSync(resolve(__dirname, "DeployWidget.tsx"), "utf8"),
    CreatePoolWidget: readFileSync(resolve(__dirname, "CreatePoolWidget.tsx"), "utf8"),
    InitializePoolWidget: readFileSync(resolve(__dirname, "InitializePoolWidget.tsx"), "utf8"),
    AddLiquidityWidget: readFileSync(resolve(__dirname, "AddLiquidityWidget.tsx"), "utf8")
  };

  for (const [name, src] of Object.entries(WIDGET_SRC)) {
    it(`${name} shell uses w-full and no max-w-*`, () => {
      // outermost card class string: the first `className={` on a <div>
      const m = src.match(/className=\{`([^`]*w-full[^`]*)`\}/);
      expect(m, `${name} should have a w-full card class`).toBeTruthy();
      expect(m![1]).not.toMatch(/max-w-(md|lg|xl|2xl)/);
    });
  }

  it("SwapWidget numeric amount nodes use tabular-nums", () => {
    const src = WIDGET_SRC.SwapWidget;
    const amountNodes = src.match(/className=\{`text-base font-bold \$\{theme\.primary\} tabular-nums`\}/g);
    expect(amountNodes?.length).toBeGreaterThanOrEqual(2);
  });
});
