// @vitest-environment jsdom
/**
 * @file NetworksList.test.tsx
 * @description Render tests for the networks list widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { THEMES, SUPPORTED_CHAINS } from "../constants";
import NetworksList from "./NetworksList";

const theme = THEMES.matrix;

describe("NetworksList", () => {
  it("renders the registry header and total count", () => {
    render(<NetworksList theme={theme} />);
    expect(screen.getByText(/AVAILABLE NETWORKS REGISTRY/)).toBeTruthy();
    expect(screen.getByText(`TOTAL: ${SUPPORTED_CHAINS.length}`)).toBeTruthy();
  });

  it("renders every supported chain name", () => {
    render(<NetworksList theme={theme} />);
    for (const c of SUPPORTED_CHAINS) {
      expect(screen.getByText(c.name)).toBeTruthy();
    }
  });

  it("labels testnets", () => {
    render(<NetworksList theme={theme} />);
    const sepolia = SUPPORTED_CHAINS.find((c) => c.name.includes("Sepolia"));
    if (sepolia) expect(screen.getAllByText("TESTNET").length).toBeGreaterThan(0);
  });
});
