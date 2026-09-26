// @vitest-environment jsdom
/**
 * @file NewsReader.test.tsx
 * @description Smoke tests for editorial NewsReader (#83)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import NewsReader from "./NewsReader";
import { NEWS_FOOTER_BASE } from "../newsAllowlist";
import type { NewsItem } from "../news";
import * as news from "../news";

const theme = THEMES.matrix;

const fixtures: NewsItem[] = [
  {
    id: "1",
    sourceId: "cointelegraph",
    title: "Bitcoin hits new research high",
    url: "https://cointelegraph.com/news/btc",
    publishedAt: Date.parse("2026-09-14T13:35:00.000Z")
  },
  {
    id: "2",
    sourceId: "decrypt",
    title: "ETH staking insights",
    url: "https://decrypt.co/eth",
    publishedAt: Date.parse("2026-09-14T12:00:00.000Z")
  },
  {
    id: "3",
    sourceId: "coindesk",
    title: "Markets open higher",
    url: "https://www.coindesk.com/a",
    publishedAt: Date.parse("2026-09-14T11:00:00.000Z")
  },
  {
    id: "4",
    sourceId: "defiant",
    title: "DeFi report weekly",
    url: "https://thedefiant.io/r",
    publishedAt: Date.parse("2026-09-14T10:00:00.000Z")
  },
  {
    id: "5",
    sourceId: "cointelegraph",
    title: "Extra grid story one",
    url: "https://cointelegraph.com/news/extra1",
    publishedAt: Date.parse("2026-09-14T09:00:00.000Z")
  },
  {
    id: "6",
    sourceId: "decrypt",
    title: "Extra grid story two",
    url: "https://decrypt.co/extra2",
    publishedAt: Date.parse("2026-09-14T08:00:00.000Z")
  }
];

const baseData = {
  kind: "news" as const,
  widgetId: "news:all",
  tag: "",
  fetchedAt: Date.parse("2026-09-14T15:00:00.000Z"),
  items: fixtures
};

describe("NewsReader", () => {
  it("renders masthead, pills, lead, and footer", () => {
    render(<NewsReader data={baseData} theme={theme} />);
    expect(screen.getByText("0xTERM")).toBeTruthy();
    const reader = screen.getByTestId("news-reader");
    expect(reader.textContent).toMatch(/0xTERM\s*research/);
    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "News" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Insights" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Reports" })).toBeTruthy();
    expect(screen.getAllByText("Bitcoin hits new research high").length).toBeGreaterThan(0);
    expect(screen.getByText("MORE")).toBeTruthy();
    expect(screen.getByText(NEWS_FOOTER_BASE, { exact: false })).toBeTruthy();
    expect(screen.getByTestId("news-reader").getAttribute("tabindex")).toBe(
      "0"
    );
  });

  it("shows empty state No items found.", () => {
    render(
      <NewsReader
        data={{ ...baseData, items: [] }}
        theme={theme}
      />
    );
    expect(screen.getByText("No items found.")).toBeTruthy();
  });

  it("shows tag-miss copy under masthead parity", () => {
    render(
      <NewsReader
        data={{ ...baseData, tag: "zzz", items: [], widgetId: "news:zzz" }}
        theme={theme}
      />
    );
    expect(screen.getByText("No headlines matched 'zzz'.")).toBeTruthy();
  });

  it("filters to empty via category pill", () => {
    // Only News sources — Insights filter empties
    const newsOnly = fixtures.filter((i) => i.sourceId === "cointelegraph");
    render(
      <NewsReader
        data={{ ...baseData, items: newsOnly }}
        theme={theme}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Insights" }));
    expect(screen.getByText("No items found.")).toBeTruthy();
  });

  it("lead is newest; category filter keeps lead from filtered set", () => {
    render(<NewsReader data={baseData} theme={theme} />);
    // Lead title present
    expect(screen.getAllByText("Bitcoin hits new research high").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Insights" }));
    expect(screen.getAllByText("ETH staking insights").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Bitcoin hits new research high")).toHaveLength(0);
  });

  it("loading shows Fetching headlines…", () => {
    render(
      <NewsReader
        data={{ ...baseData, items: [], loading: true }}
        theme={theme}
      />
    );
    expect(screen.getByText("Fetching headlines…")).toBeTruthy();
  });

  it("Enter opens active via openNewsArticle (#89 parity)", () => {
    const onFocusPrompt = vi.fn();
    const openSpy = vi.spyOn(news, "openNewsArticle").mockReturnValue(true);
    const { container } = render(
      <NewsReader
        data={baseData}
        theme={theme}
        autoFocus
        onFocusPrompt={onFocusPrompt}
      />
    );
    const root = container.querySelector("[data-retain-focus]") as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "Enter" });
    expect(openSpy).toHaveBeenCalledWith(
      "https://cointelegraph.com/news/btc"
    );
    expect(onFocusPrompt).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("j/k move active index across flat list", () => {
    const openSpy = vi.spyOn(news, "openNewsArticle").mockReturnValue(true);
    const { container } = render(
      <NewsReader data={baseData} theme={theme} autoFocus />
    );
    const root = container.querySelector("[data-retain-focus]") as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "j" });
    fireEvent.keyDown(root, { key: "Enter" });
    expect(openSpy).toHaveBeenCalledWith("https://decrypt.co/eth");
    openSpy.mockRestore();
  });
});
