// @vitest-environment jsdom
/**
 * @file workspaces.test.tsx
 * @description Smoke render for the workspace launcher (#80)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { THEMES } from "../constants";
import { WorkspaceStrip } from "./index";
import { WorkspaceTile } from "./WorkspaceTile";

const theme = THEMES.matrix;

describe("WorkspaceStrip", () => {
  it("renders invest tiles and fires onCommand on click", () => {
    const onCommand = vi.fn();
    render(<WorkspaceStrip theme={theme} mode="invest" onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /PRICE/i }));
    expect(onCommand).toHaveBeenCalledWith("price");
  });

  it("renders forensic tiles with kyt", () => {
    const onCommand = vi.fn();
    render(<WorkspaceStrip theme={theme} mode="forensic" onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /KYT/i }));
    expect(onCommand).toHaveBeenCalledWith("kyt");
  });

  it("renders dev tiles with dig new", () => {
    const onCommand = vi.fn();
    render(<WorkspaceStrip theme={theme} mode="dev" onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /NEW/i }));
    expect(onCommand).toHaveBeenCalledWith("dig new");
  });

  it("renders nothing in console (raw terminal)", () => {
    const { container } = render(
      <WorkspaceStrip theme={theme} mode="console" onCommand={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("WorkspaceTile", () => {
  it("renders label + hint and fires the command", () => {
    const onCommand = vi.fn();
    render(
      <WorkspaceTile
        theme={theme}
        action={{ cmd: "swap 1 ETH USDC", label: "SWAP", hint: "swap <amt> <from> <to>" }}
        onCommand={onCommand}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /SWAP/i }));
    expect(onCommand).toHaveBeenCalledWith("swap 1 ETH USDC");
  });
});
