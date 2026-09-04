/**
 * @file viewport.ts
 * @description Pure layout-band / viewport helpers for the responsive shell
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { useEffect, useState } from "react";

export type LayoutBand = "stack" | "tablet" | "desktop";

// Breakpoint lock (issue #49): width AND height, never width alone. The
// `md:` footgun — a short landscape phone is >= 768px wide but must not
// two-column. 768-1023 wide and >= 700 tall = tablet; >= 1024 = desktop;
// everything else (narrow phone, short landscape, split view) stacks.
export const getLayoutBand = (width: number, height: number): LayoutBand => {
  if (width >= 1024) return "desktop";
  if (width >= 768 && height >= 700) return "tablet";
  return "stack";
};

export type ViewportState = {
  band: LayoutBand;
  narrow: boolean;
};

export const getViewportState = (
  width: number,
  height: number
): ViewportState => ({
  band: getLayoutBand(width, height),
  narrow: width < 768
});

// The shell's log + pin grid. Two-column only on tablet/desktop WITH pins;
// short-landscape / phone stacks the pin above the prompt.
export const pinGridClass = (
  band: LayoutBand,
  hasPins: boolean
): string => {
  if (!hasPins) return "flex-1 min-h-0 flex flex-col";
  if (band === "stack") {
    return "flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_auto] gap-2";
  }
  return "flex-1 min-h-0 grid grid-rows-1 grid-cols-[minmax(0,1fr)_18rem] gap-2";
};

// Touch vs mouse. Must guard matchMedia — jsdom (and some webviews) don't
// implement it.
export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

export const useLayoutBand = (): ViewportState => {
  const [state, setState] = useState<ViewportState>(() =>
    getViewportState(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setState(getViewportState(window.innerWidth, window.innerHeight))
      );
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return state;
};
