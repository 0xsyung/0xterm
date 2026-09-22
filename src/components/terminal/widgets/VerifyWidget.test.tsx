// @vitest-environment jsdom
/**
 * @file VerifyWidget.test.tsx
 * @description VerifyWidget renders all 4 states with the w-full shell, no
 * max-w-*, tabular-nums numeric nodes, and mounts under all 8 themes (#105)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import VerifyWidget from "./VerifyWidget";

const theme = THEMES.matrix;
const ALL_THEMES = Object.values(THEMES);

const base = {
  kind: "verify" as const,
  name: "Counter",
  address: "0x1234567890123456789012345678901234567890",
  chainName: "Base",
  explorerUrl: "https://basescan.org"
};

describe("VerifyWidget shell (issue #5 width)", () => {
  it("has w-full and no max-w-* in all states", () => {
    for (const state of ["submitting", "pending", "verified", "failed"] as const) {
      const { container } = render(
        <VerifyWidget theme={theme} data={{ ...base, state }} />
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.className).toContain("w-full");
      expect(el.className).not.toMatch(/max-w-(md|lg|xl|2xl)/);
    }
  });
});

describe("VerifyWidget states", () => {
  it("shows SUBMITTING state label", () => {
    render(<VerifyWidget theme={theme} data={{ ...base, state: "submitting" }} />);
    expect(screen.getByText("SUBMITTING")).toBeTruthy();
  });

  it("shows PENDING state label", () => {
    render(<VerifyWidget theme={theme} data={{ ...base, state: "pending" }} />);
    expect(screen.getByText("PENDING")).toBeTruthy();
  });

  it("shows VERIFIED label and a link to the contract source", () => {
    render(<VerifyWidget theme={theme} data={{ ...base, state: "verified" }} />);
    expect(screen.getByText("VERIFIED")).toBeTruthy();
    const link = screen.getByText(/VIEW CONTRACT SOURCE/);
    expect(link.getAttribute("href")).toContain(
      "/address/0x1234567890123456789012345678901234567890#code"
    );
  });

  it("shows the failure message with theme.warn (no red-400)", () => {
    const { container } = render(
      <VerifyWidget
        theme={theme}
        data={{ ...base, state: "failed", message: "Contract source code already verified" }}
      />
    );
    expect(screen.getByText("FAILED")).toBeTruthy();
    const msg = screen.getByText("Contract source code already verified");
    expect(msg.className).toContain(theme.warn);
    expect(container.innerHTML).not.toContain("text-red-400");
  });

  it("address node uses tabular-nums", () => {
    const { container } = render(
      <VerifyWidget theme={theme} data={{ ...base, state: "pending" }} />
    );
    expect(container.innerHTML).toContain("tabular-nums");
  });
});

describe("VerifyWidget mounts under all 8 themes (issue #5 theme loop)", () => {
  for (const t of ALL_THEMES) {
    it(`renders verified state under ${t.name}`, () => {
      const { container } = render(
        <VerifyWidget theme={t} data={{ ...base, state: "verified" }} />
      );
      expect(container.firstElementChild!.className).toContain("w-full");
    });
  }
});
