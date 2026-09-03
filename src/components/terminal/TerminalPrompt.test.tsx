// @vitest-environment jsdom
/**
 * @file TerminalPrompt.test.tsx
 * @description Render tests for the prompt component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { THEMES } from "./constants";
import TerminalPrompt from "./TerminalPrompt";

const theme = THEMES.matrix;

function makeProps(overrides: any = {}) {
  return {
    theme,
    input: "",
    setInput: vi.fn(),
    handleKeyDown: vi.fn(),
    inputRef: createRef<HTMLInputElement>(),
    suggestions: [] as string[],
    suggestionIdx: 0,
    activeChainId: null,
    activeDexId: null,
    isConnected: false,
    address: undefined,
    mounted: true,
    ...overrides
  };
}

describe("TerminalPrompt", () => {
  it("shows DISCONNECTED when no wallet", () => {
    render(<TerminalPrompt {...makeProps()} />);
    expect(screen.getByText(/WALLET: DISCONNECTED/)).toBeTruthy();
  });

  it("shows the connected address", () => {
    render(
      <TerminalPrompt
        {...makeProps({ isConnected: true, address: "0xAbC1234567890Def4567890AbC1234567890DeF" })}
      />
    );
    expect(screen.getByText(/WALLET: 0xAbC1\.\.\.0DeF/)).toBeTruthy();
  });

  it("forwards typed input through setInput", () => {
    const setInput = vi.fn();
    render(<TerminalPrompt {...makeProps({ setInput })} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "balance" } });
    expect(setInput).toHaveBeenCalledWith("balance");
  });

  it("renders suggestion chips with the active one highlighted", () => {
    render(
      <TerminalPrompt
        {...makeProps({ suggestions: ["USDC@0xAAA…", "USDC@0xBBB…"], suggestionIdx: 1 })}
      />
    );
    expect(screen.getByText("USDC@0xAAA…")).toBeTruthy();
    expect(screen.getByText("USDC@0xBBB…")).toBeTruthy();
  });

  it("does not render the CHOICES bar when there are no suggestions", () => {
    render(<TerminalPrompt {...makeProps()} />);
    expect(screen.queryByText(/CHOICES/)).toBeNull();
  });
});
