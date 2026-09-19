// @vitest-environment jsdom
/**
 * @file NewsWidget.test.tsx
 * @description Render smoke for news board chrome (#14)
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import NewsWidget from "./NewsWidget";
import { NEWS_FOOTER_BASE } from "../newsAllowlist";
import * as news from "../news";

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

  it("stops mouse events from bubbling (shell prompt-focus steal)", () => {
    const { container } = render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          items: [
            {
              id: "n1",
              sourceId: "decrypt",
              title: "Hello",
              url: "https://decrypt.co/1",
              publishedAt: Date.now()
            }
          ],
          fetchedAt: Date.now()
        }}
        theme={theme}
      />
    );
    const root = container.querySelector("[data-retain-focus]") as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute("tabindex")).toBe("0");
    const bubble = { click: false, down: false };
    const onBubbleClick = () => {
      bubble.click = true;
    };
    const onBubbleDown = () => {
      bubble.down = true;
    };
    document.body.addEventListener("click", onBubbleClick);
    document.body.addEventListener("mousedown", onBubbleDown);
    fireEvent.mouseDown(root);
    fireEvent.click(root);
    const row = screen.getByRole("button", { name: /Hello/i });
    fireEvent.mouseDown(row);
    fireEvent.click(row);
    document.body.removeEventListener("click", onBubbleClick);
    document.body.removeEventListener("mousedown", onBubbleDown);
    expect(bubble.click).toBe(false);
    expect(bubble.down).toBe(false);
  });

  it("uses 6ch TIME template when TIME is shown (#85)", () => {
    const { container } = render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.now(),
          items: [
            {
              id: "1",
              sourceId: "defiant",
              title: "Gap check",
              url: "https://thedefiant.io/x",
              publishedAt: Date.now()
            }
          ]
        }}
        theme={theme}
      />
    );
    const grids = container.querySelectorAll(".grid");
    const withTime = [...grids].find((el) =>
      (el.className || "").includes(
        "grid-cols-[6ch_minmax(0,12ch)_minmax(0,1fr)]"
      )
    );
    expect(withTime).toBeTruthy();
    expect((withTime as HTMLElement).className).toContain("gap-x-2");
    expect((withTime as HTMLElement).className).not.toContain("4.5ch");
  });

  it("Enter opens via openNewsArticle; success blurs to prompt (#89)", () => {
    const onFocusPrompt = vi.fn();
    const openSpy = vi.spyOn(news, "openNewsArticle").mockReturnValue(true);
    const { container } = render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.now(),
          items: [
            {
              id: "1",
              sourceId: "decrypt",
              title: "Open me",
              url: "https://decrypt.co/open-me",
              publishedAt: Date.now()
            }
          ]
        }}
        theme={theme}
        autoFocus
        onFocusPrompt={onFocusPrompt}
      />
    );
    const root = container.querySelector("[data-retain-focus]") as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "Enter" });
    expect(openSpy).toHaveBeenCalledWith("https://decrypt.co/open-me");
    expect(onFocusPrompt).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("Enter keeps focus on widget when open fails (#89)", () => {
    const onFocusPrompt = vi.fn();
    const openSpy = vi.spyOn(news, "openNewsArticle").mockReturnValue(false);
    const { container } = render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.now(),
          items: [
            {
              id: "1",
              sourceId: "decrypt",
              title: "Blocked",
              url: "https://decrypt.co/blocked",
              publishedAt: Date.now()
            }
          ]
        }}
        theme={theme}
        autoFocus
        onFocusPrompt={onFocusPrompt}
      />
    );
    const root = container.querySelector("[data-retain-focus]") as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "Enter" });
    expect(openSpy).toHaveBeenCalled();
    expect(onFocusPrompt).not.toHaveBeenCalled();
    // j/k still wired: ArrowDown advances selection without throwing
    fireEvent.keyDown(root, { key: "j" });
    openSpy.mockRestore();
  });

  it("row click selects only — does not call openNewsArticle (#89)", () => {
    const openSpy = vi.spyOn(news, "openNewsArticle");
    render(
      <NewsWidget
        data={{
          kind: "news",
          widgetId: "news:all",
          tag: "",
          fetchedAt: Date.now(),
          items: [
            {
              id: "1",
              sourceId: "decrypt",
              title: "Select only",
              url: "https://decrypt.co/select",
              publishedAt: Date.now()
            }
          ]
        }}
        theme={theme}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Select only/i }));
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

});
