/**
 * @file explorer.test.ts
 * @description Unit tests for the pure `verify` command logic — Etherscan
 * request building, response parsing, and status polling (#105)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { base, mainnet, polygon } from "viem/chains";
import {
  buildVerifyRequest,
  explorerApiUrl,
  findDigDeploymentForVerify,
  parseVerifyResponse,
  parseVerifyStatus,
  pollVerifyStatus,
  resolveVerifyKeyCommand,
  type VerifyTarget
} from "./explorer";
import type { DigDeployment } from "./dig/session";
import {
  DIG_DEFAULT_SOLC_LONG,
  DIG_OPTIMIZER_ENABLED,
  DIG_OPTIMIZER_RUNS
} from "./dig/constants";

const SOURCE = "// SPDX-License-Identifier: MIT\ncontract Counter {}";

const targetFor = <T extends { id: number; name: string; blockExplorers?: unknown }>(
  chain: T,
  over: Partial<VerifyTarget> = {}
): VerifyTarget => ({
  name: "Counter",
  address: "0x1234567890123456789012345678901234567890",
  chainId: chain.id,
  chainName: chain.name,
  source: SOURCE,
  apiUrl: chain.blockExplorers
    ? ((chain.blockExplorers as { default?: { apiUrl?: string } }).default?.apiUrl ?? "")
    : "",
  explorerUrl: chain.blockExplorers
    ? ((chain.blockExplorers as { default?: { url?: string } }).default?.url ?? "")
    : "",
  ...over
});

describe("explorerApiUrl", () => {
  it("returns the chain's API URL", () => {
    expect(explorerApiUrl(base)).toBe("https://api.basescan.org/api");
    expect(explorerApiUrl(polygon)).toBe("https://api.etherscan.io/v2/api");
    expect(explorerApiUrl(mainnet)).toBe("https://api.etherscan.io/api");
  });
});

describe("buildVerifyRequest", () => {
  it("sends the dig compile settings verbatim", () => {
    const body = buildVerifyRequest({
      target: targetFor(base),
      apiKey: "ABC123"
    });
    expect(body.get("module")).toBe("contract");
    expect(body.get("action")).toBe("verifysourcecode");
    expect(body.get("apikey")).toBe("ABC123");
    expect(body.get("contractaddress")).toBe(targetFor(base).address);
    expect(body.get("sourceCode")).toBe(SOURCE);
    expect(body.get("contractname")).toBe("Counter");
    expect(body.get("compilerversion")).toBe(DIG_DEFAULT_SOLC_LONG);
    expect(body.get("optimizationUsed")).toBe(
      DIG_OPTIMIZER_ENABLED ? "1" : "0"
    );
    expect(body.get("runs")).toBe(String(DIG_OPTIMIZER_RUNS));
  });

  it("sends no chainId for single-chain endpoints (base)", () => {
    const body = buildVerifyRequest({
      target: targetFor(base),
      apiKey: "ABC123"
    });
    expect(body.get("chainId")).toBeNull();
  });

  it("sends chainId for the multichain /v2/api endpoint (polygon)", () => {
    const body = buildVerifyRequest({
      target: targetFor(polygon),
      apiKey: "ABC123"
    });
    expect(body.get("chainId")).toBe(String(polygon.id));
  });

  it("sends empty constructor args and default license type", () => {
    const body = buildVerifyRequest({
      target: targetFor(base),
      apiKey: "ABC123"
    });
    expect(body.get("constructorArguements")).toBe("");
    expect(body.get("licenseType")).toBe("1");
  });

  it("passes through provided constructor args (no 0x prefix)", () => {
    const body = buildVerifyRequest({
      target: targetFor(base),
      apiKey: "ABC123",
      constructorArgsHex: "0000abcd",
      licenseType: 5
    });
    expect(body.get("constructorArguements")).toBe("0000abcd");
    expect(body.get("licenseType")).toBe("5");
  });
});

describe("parseVerifyResponse", () => {
  it("accepts a successful submission and returns the GUID", () => {
    const res = parseVerifyResponse(
      JSON.stringify({
        status: "1",
        message: "OK",
        result: "ezqmr3xk-abc-def"
      })
    );
    expect(res.accepted).toBe(true);
    expect(res.guid).toBe("ezqmr3xk-abc-def");
  });

  it("rejects an already-verified submission", () => {
    const res = parseVerifyResponse(
      JSON.stringify({
        status: "0",
        message: "NOTOK",
        result: "Contract source code already verified"
      })
    );
    expect(res.accepted).toBe(false);
    expect(res.message).toBe("Contract source code already verified");
  });

  it("handles malformed JSON", () => {
    const res = parseVerifyResponse("not json");
    expect(res.accepted).toBe(false);
    expect(res.message).toContain("Malformed");
  });
});

describe("parseVerifyStatus", () => {
  it("marks Pass as verified", () => {
    const res = parseVerifyStatus(
      JSON.stringify({ status: "1", message: "OK", result: "Pass - Verified" })
    );
    expect(res.done).toBe(true);
    expect(res.verified).toBe(true);
  });

  it("marks Fail as not verified", () => {
    const res = parseVerifyStatus(
      JSON.stringify({ status: "0", message: "NOTOK", result: "Fail - Invalid" })
    );
    expect(res.done).toBe(true);
    expect(res.verified).toBe(false);
  });
});

describe("pollVerifyStatus", () => {
  const apiUrl = "https://api.basescan.org/api";
  const okEnvelope = (status: string, result: string) =>
    JSON.stringify({ status, message: status === "1" ? "OK" : "NOTOK", result });

  it("returns verified once the explorer reports Pass", async () => {
    const pending = okEnvelope("0", "Pending in queue");
    const pass = okEnvelope("1", "Pass - Verified");
    const fetchImpl: typeof fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(pending))
      .mockResolvedValueOnce(new Response(pass));
    const res = await pollVerifyStatus(apiUrl, "guid-1", "KEY", {
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 1000
    });
    expect(res.verified).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns not-verified on Fail", async () => {
    const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
      new Response(okEnvelope("0", "Fail - Invalid"))
    );
    const res = await pollVerifyStatus(apiUrl, "guid-1", "KEY", {
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 1000
    });
    expect(res.verified).toBe(false);
    expect(res.message).toContain("Fail");
  });

  it("times out while still pending", async () => {
    const fetchImpl: typeof fetch = vi.fn().mockImplementation(
      () => Promise.resolve(new Response(okEnvelope("0", "Pending in queue")))
    );
    const res = await pollVerifyStatus(apiUrl, "guid-1", "KEY", {
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 30
    });
    expect(res.verified).toBe(false);
    expect(res.message).toContain("Timed out");
  });
});

describe("resolveVerifyKeyCommand", () => {
  it("lists saved keys masked when no chain is given", () => {
    const res = resolveVerifyKeyCommand(["verify", "key"], {
      8453: "ABC123",
      1: "XYZ789"
    });
    expect(res.kind).toBe("text");
    expect(res.text).toContain("Saved explorer API keys:");
    expect(res.text).toContain("Base");
    expect(res.text).toContain("Ethereum");
    expect(res.text).not.toContain("ABC123");
  });

  it("reports when no keys are saved", () => {
    const res = resolveVerifyKeyCommand(["verify", "key"], {});
    expect(res.kind).toBe("text");
    expect(res.text).toContain("No explorer API keys saved");
  });

  it("saves a key for a chain by name", () => {
    const res = resolveVerifyKeyCommand(["verify", "key", "base", "ABC123"], {});
    expect(res.kind).toBe("saved");
    if (res.kind === "saved") {
      expect(res.nextKeys).toEqual({ 8453: "ABC123" });
      expect(res.text).toContain("[✓] Saved");
    }
  });

  it("saves a key for a chain by id", () => {
    const res = resolveVerifyKeyCommand(["verify", "key", "137", "KEY"], {});
    expect(res.kind).toBe("saved");
    if (res.kind === "saved") expect(res.nextKeys).toEqual({ 137: "KEY" });
  });

  it("rejects an unknown chain", () => {
    const res = resolveVerifyKeyCommand(["verify", "key", "bogus", "KEY"], {});
    expect(res.kind).toBe("text");
    expect(res.text).toContain("[!] Unknown chain");
  });

  it("asks for the key when only the chain is given", () => {
    const res = resolveVerifyKeyCommand(["verify", "key", "base"], {});
    expect(res.kind).toBe("text");
    expect(res.text).toContain("Usage: verify key Base <API_KEY>");
  });
});

describe("findDigDeploymentForVerify", () => {
  const ADDR = "0x1234567890123456789012345678901234567890";
  const dep = (over: Partial<DigDeployment> = {}): DigDeployment => ({
    name: "Counter",
    address: ADDR as `0x${string}`,
    env: "injected",
    chainId: 8453,
    chainName: "Base",
    abi: [],
    ...over
  });

  it("matches by exact address", () => {
    const found = findDigDeploymentForVerify([dep()], ADDR);
    expect(found?.name).toBe("Counter");
  });

  it("matches by exact name", () => {
    const found = findDigDeploymentForVerify([dep()], "Counter");
    expect(found?.address).toBe(ADDR);
  });

  it("matches case-insensitively by name", () => {
    const found = findDigDeploymentForVerify([dep()], "counter");
    expect(found).not.toBeNull();
  });

  it("returns null when nothing matches", () => {
    const found = findDigDeploymentForVerify([dep()], "Missing");
    expect(found).toBeNull();
  });
});
