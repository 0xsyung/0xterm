// @vitest-environment jsdom
/**
 * @file HelpManual.test.tsx
 * @description Render tests for the help manual widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES } from "../constants";
import HelpManual from "./HelpManual";

const theme = THEMES.matrix;

describe("HelpManual", () => {
  it("renders the command manual header with mode", () => {
    render(<HelpManual theme={theme} mode="invest" />);
    expect(screen.getByText(/SYSTEM COMMAND MANUAL — INVEST/)).toBeTruthy();
  });

  it("lists invest commands and globals, not deploy", () => {
    render(<HelpManual theme={theme} mode="invest" />);
    expect(screen.getByText("networks")).toBeTruthy();
    expect(screen.getByText("dexes")).toBeTruthy();
    expect(screen.getByText("export")).toBeTruthy();
    expect(screen.getByText("look <address|ens>")).toBeTruthy();
    expect(screen.getByText("feed [n]")).toBeTruthy();
    expect(screen.queryByText(/deploy <erc20/)).toBeNull();
  });

  it("lists dig compile / dig deploy + is, not root deploy or swap", () => {
    render(<HelpManual theme={theme} mode="dev" />);
    expect(screen.getByText("dig compile [Contract]")).toBeTruthy();
    expect(screen.getByText("dig deploy erc20|erc721 …")).toBeTruthy();
    expect(screen.getByText("dig debug [tx]")).toBeTruthy();
    expect(screen.getByText(/is <erc20/)).toBeTruthy();
    expect(screen.queryByText("deploy <erc20|erc721> <name> <symbol> [decimals]")).toBeNull();
    expect(screen.queryByText(/swap <amt/)).toBeNull();
  });

  it("renders a real theme with the required fields", () => {
    render(<HelpManual theme={theme} />);
    expect(theme.border).toBeTypeOf("string");
    expect(theme.cardBg).toBeTypeOf("string");
    expect(theme.rounded).toBeTypeOf("string");
    expect(theme.text).toBeTypeOf("string");
  });
});
