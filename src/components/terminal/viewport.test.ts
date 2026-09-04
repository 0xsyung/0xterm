/**
 * @file viewport.test.ts
 * @description Unit tests for layout-band / grid helpers
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  getLayoutBand,
  getViewportState,
  isCoarsePointer,
  pinGridClass
} from "./viewport";

describe("getLayoutBand", () => {
  it("stacks narrow phones", () => {
    expect(getLayoutBand(375, 667)).toBe("stack");
    expect(getLayoutBand(390, 844)).toBe("stack");
    expect(getLayoutBand(430, 932)).toBe("stack");
    expect(getLayoutBand(767, 1024)).toBe("stack");
  });

  it("stacks short landscape / split view despite width >= 768", () => {
    expect(getLayoutBand(844, 390)).toBe("stack");
    expect(getLayoutBand(932, 430)).toBe("stack");
    expect(getLayoutBand(768, 699)).toBe("stack");
  });

  it("is tablet between 768-1023 wide and >= 700 tall", () => {
    expect(getLayoutBand(768, 1024)).toBe("tablet");
    expect(getLayoutBand(820, 1180)).toBe("tablet");
    expect(getLayoutBand(1023, 1024)).toBe("tablet");
  });

  it("is desktop at >= 1024 wide regardless of height", () => {
    expect(getLayoutBand(1024, 768)).toBe("desktop");
    expect(getLayoutBand(1180, 820)).toBe("desktop");
    expect(getLayoutBand(1280, 800)).toBe("desktop");
  });
});

describe("getViewportState", () => {
  it("marks narrow only below 768", () => {
    expect(getViewportState(375, 667)).toEqual({ band: "stack", narrow: true });
    expect(getViewportState(430, 932)).toEqual({ band: "stack", narrow: true });
    expect(getViewportState(768, 1024)).toEqual({ band: "tablet", narrow: false });
    expect(getViewportState(1024, 768)).toEqual({ band: "desktop", narrow: false });
  });
});

describe("pinGridClass", () => {
  it("uses a plain flex column when nothing is pinned", () => {
    expect(pinGridClass("desktop", false)).toBe("flex-1 min-h-0 flex flex-col");
    expect(pinGridClass("stack", false)).toBe("flex-1 min-h-0 flex flex-col");
  });

  it("stacks the pin below the log in the stack band", () => {
    expect(pinGridClass("stack", true)).toBe(
      "flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_auto] gap-2"
    );
  });

  it("uses the two-column log|18rem grid on tablet/desktop", () => {
    expect(pinGridClass("tablet", true)).toBe(
      "flex-1 min-h-0 grid grid-rows-1 grid-cols-[minmax(0,1fr)_18rem] gap-2"
    );
    expect(pinGridClass("desktop", true)).toBe(
      "flex-1 min-h-0 grid grid-rows-1 grid-cols-[minmax(0,1fr)_18rem] gap-2"
    );
  });
});

describe("isCoarsePointer", () => {
  it("returns false when matchMedia is unavailable", () => {
    expect(isCoarsePointer()).toBe(false);
  });
});
