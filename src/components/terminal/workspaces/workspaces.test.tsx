// @vitest-environment jsdom
/**
 * @file workspaces.test.tsx
 * @description Smoke render for the workspace launcher (#80/#117)
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
  it("PRICE opens panel path (not bare onCommand)", () => {
    const onCommand = vi.fn();
    const onOpenPanel = vi.fn();
    render(
      <WorkspaceStrip
        theme={theme}
        mode="invest"
        onCommand={onCommand}
        onOpenPanel={onOpenPanel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /PRICE/i }));
    expect(onOpenPanel).toHaveBeenCalledWith("price");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("PRICE hint is panel-oriented, not Usage dump", () => {
    render(
      <WorkspaceStrip theme={theme} mode="invest" onCommand={vi.fn()} onOpenPanel={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /PRICE/i }).textContent).toMatch(
      /open price panel/i
    );
    expect(screen.getByRole("button", { name: /PRICE/i }).textContent).not.toMatch(
      /price <tA>/i
    );
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

  it("panel action calls onOpenPanel instead of onCommand", () => {
    const onCommand = vi.fn();
    const onOpenPanel = vi.fn();
    render(
      <WorkspaceTile
        theme={theme}
        action={{
          cmd: "price",
          label: "PRICE",
          hint: "open price panel",
          panel: "price"
        }}
        onCommand={onCommand}
        onOpenPanel={onOpenPanel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /PRICE/i }));
    expect(onOpenPanel).toHaveBeenCalledWith("price");
    expect(onCommand).not.toHaveBeenCalled();
  });
});
