// @vitest-environment jsdom
/**
 * @file NewsWidget.test.tsx
 * @description Render smoke for news board chrome (#14)
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import NewsWidget from "./NewsWidget";
import { NEWS_FOOTER_BASE } from "../newsAllowlist";

const theme = THEMES.matrix;

describe("NewsWidget", () => {
  it("renders TIME SOURCE TITLE, footer, and filter chip", () => {
    render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.parse("2026-09-13T15:04:22"),
          items: [
            {
              id: "1",
              sourceId: "cointelegraph",
              title: "Bitcoin moves",
              url: "https://cointelegraph.com/news/x",
              publishedAt: Date.parse("2026-09-13T14:02:00")
            }
          ]
        }}
        theme={theme}
      />
    );
    expect(screen.getByText("NEWS")).toBeTruthy();
    expect(screen.getByText("ALL")).toBeTruthy();
    expect(screen.getByText("TIME")).toBeTruthy();
    expect(screen.getByText("SOURCE")).toBeTruthy();
    expect(screen.getByText("TITLE")).toBeTruthy();
    expect(screen.getByText("COINTELEGRAPH")).toBeTruthy();
    expect(screen.getByText("Bitcoin moves")).toBeTruthy();
    expect(screen.getByText(NEWS_FOOTER_BASE, { exact: false })).toBeTruthy();
  });

  it("drops TIME when compact or narrow; shows empty filter copy", () => {
    const { rerender } = render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:btc",
          tag: "btc",
          fetchedAt: Date.now(),
          items: []
        }}
        theme={theme}
        compact
      />
    );
    expect(screen.queryByText("TIME")).toBeNull();
    expect(screen.getByText("No headlines matched 'btc'.")).toBeTruthy();

    rerender(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.now(),
          items: [],
          loading: true
        }}
        theme={theme}
        narrow
      />
    );
    expect(screen.getByText("Fetching headlines…")).toBeTruthy();
  });
});
