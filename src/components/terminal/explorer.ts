/**
 * @file explorer.ts
 * @description Pure logic for the `verify` command — Etherscan source-code
 * verification request building, response parsing, and status polling (#105)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Chain } from "viem";
import {
  DIG_DEFAULT_SOLC_LONG,
  DIG_OPTIMIZER_ENABLED,
  DIG_OPTIMIZER_RUNS
} from "./dig/constants";
import type { DigDeployment } from "./dig/session";
import type { ExplorerKeys } from "./explorerKeys";
import { maskSecret } from "./settingsPrefs";
import { SUPPORTED_CHAINS } from "./constants";

/** Verify target resolved from the dig session + workspace. */
export type VerifyTarget = {
  name: string;
  address: string;
  chainId: number;
  chainName: string;
  source: string;
  apiUrl: string;
  /** Explorer UI base (no trailing slash) for the "View on Explorer" link. */
  explorerUrl: string;
};

/** Etherscan verification API base from the viem chain definition. */
export function explorerApiUrl(chain: Chain): string | null {
  const be = chain.blockExplorers?.default;
  return be?.apiUrl ?? null;
}

export type VerifySubmitInput = {
  target: VerifyTarget;
  apiKey: string;
  /** Constructor args as hex ABI-encoded data, no 0x prefix ("" = none). */
  constructorArgsHex?: string;
  /** License type id — 1 (No License) to 17 (unlicense). */
  licenseType?: number;
};

/**
 * Build the `verifysourcecode` POST body. Compile settings are sent verbatim
 * from the dig constants so the submitted source matches the on-chain bytecode.
 */
export function buildVerifyRequest(input: VerifySubmitInput): URLSearchParams {
  const p = new URLSearchParams();
  p.set("module", "contract");
  p.set("action", "verifysourcecode");
  p.set("apikey", input.apiKey);
  // Etherscan's multichain endpoint (api.etherscan.io/v2/api) requires chainId;
  // chain-specific endpoints reject it. viem polyfill: strip the "/v2/api" suffix.
  const needsChainId = input.target.apiUrl.includes("/v2/api");
  if (needsChainId) p.set("chainId", String(input.target.chainId));
  p.set("contractaddress", input.target.address);
  p.set("sourceCode", input.target.source);
  p.set("contractname", input.target.name);
  p.set("compilerversion", DIG_DEFAULT_SOLC_LONG);
  p.set("optimizationUsed", DIG_OPTIMIZER_ENABLED ? "1" : "0");
  p.set("runs", String(DIG_OPTIMIZER_RUNS));
  p.set("constructorArguements", input.constructorArgsHex ?? "");
  p.set("licenseType", String(input.licenseType ?? 1));
  return p;
}

export type EtherscanEnvelope = {
  status: string;
  message: string;
  result: string;
};

/** Parse the `{status,message,result}` envelope, tolerating missing fields. */
export function parseEtherscanEnvelope(raw: string): EtherscanEnvelope | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const env = parsed as Record<string, unknown>;
    return {
      status: typeof env.status === "string" ? env.status : "0",
      message: typeof env.message === "string" ? env.message : "",
      result: typeof env.result === "string" ? env.result : ""
    };
  } catch {
    return null;
  }
}

/** Verify submission reply: `1` = accepted (returns GUID), `0` = rejected. */
export type VerifySubmitResult = {
  accepted: boolean;
  guid?: string;
  message: string;
  raw: string;
};

export function parseVerifyResponse(raw: string): VerifySubmitResult {
  const env = parseEtherscanEnvelope(raw);
  if (!env) return { accepted: false, message: "Malformed API response.", raw };
  if (env.status === "1" && env.result) {
    return { accepted: true, guid: env.result.trim(), message: env.message, raw };
  }
  if (env.result) return { accepted: false, message: env.result, raw };
  return { accepted: false, message: env.message || "Verification rejected.", raw };
}

export type VerifyStatusResult = {
  done: boolean;
  verified: boolean;
  message: string;
  raw: string;
};

export function parseVerifyStatus(raw: string): VerifyStatusResult {
  const env = parseEtherscanEnvelope(raw);
  if (!env) return { done: true, verified: false, message: "Malformed API response.", raw };
  if (env.status === "1") {
    const lower = env.result.toLowerCase();
    return {
      done: true,
      verified: lower.includes("pass"),
      message: env.result,
      raw
    };
  }
  return {
    done: true,
    verified: false,
    message: env.result || env.message || "Not verified.",
    raw
  };
}

/** Usage text for `verify` (no args). */
export const VERIFY_USAGE =
  "Usage:\n• verify <contractName|0xaddress> — submit source to the block explorer\n• verify key <chainName> <API_KEY> — save your Etherscan API key\n• verify key — list saved keys (masked)";

export type VerifyKeyCommandResult =
  | { kind: "saved"; text: string; nextKeys: ExplorerKeys }
  | { kind: "text"; text: string };

/** Resolve `verify key [chain] [key]` into a text reply or a keys-state patch. */
export function resolveVerifyKeyCommand(args: string[], keys: ExplorerKeys): VerifyKeyCommandResult {
  if (!args[2]) {
    const rows = Object.entries(keys)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([chainId, key]) => `${chainLabel(Number(chainId))} · ${maskSecret(key)}`);
    return {
      kind: "text",
      text:
        rows.length > 0
          ? `Saved explorer API keys:\n${rows.join("\n")}`
          : "No explorer API keys saved. Use 'verify key <chainName> <API_KEY>'."
    };
  }
  const chainKey = args[2].toLowerCase();
  const chain = SUPPORTED_CHAINS.find(
    (c) => c.name.toLowerCase() === chainKey || String(c.id) === chainKey
  );
  if (!chain) {
    return {
      kind: "text",
      text: `[!] Unknown chain "${args[2]}". Use one of: ${SUPPORTED_CHAINS.map((c) => c.name).join(", ")}.`
    };
  }
  if (!args[3]) {
    return { kind: "text", text: `Usage: verify key ${chain.name} <API_KEY>` };
  }
  return {
    kind: "saved",
    text: `[✓] Saved Etherscan API key for ${chain.name}.`,
    nextKeys: { ...keys, [chain.id]: args[3] }
  };
}

function chainLabel(chainId: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? String(chainId);
}

/** Resolve a deployment from the dig session by exact address, name, or case-insensitive name. */
export function findDigDeploymentForVerify(
  deployments: DigDeployment[],
  raw: string
): DigDeployment | null {
  const q = raw.toLowerCase();
  return (
    deployments.find((d) => d.address.toLowerCase() === q) ??
    deployments.find((d) => d.name.toLowerCase() === q) ??
    null
  );
}

export type VerifyGates = {
  connected: boolean;
  hasChain: boolean;
  hasApiUrl: boolean;
  hasKey: boolean;
};

/** Preflight checks for `verify <name|0xaddress>` — mirrors the inline gate order. */
export function checkVerifyGates(
  deps: { connected: boolean; chain?: Chain; apiUrl: string | null; key?: string }
): VerifyGates {
  return {
    connected: deps.connected,
    hasChain: !!deps.chain,
    hasApiUrl: !!deps.apiUrl,
    hasKey: !!deps.key
  };
}

/** Poll checkverifystatus until Pass/Fail or timeout. */
export async function pollVerifyStatus(
  apiUrl: string,
  guid: string,
  apiKey: string,
  opts?: { intervalMs?: number; timeoutMs?: number; fetchImpl?: typeof fetch }
): Promise<VerifyStatusResult> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const q = new URLSearchParams({
    module: "contract",
    action: "checkverifystatus",
    guid,
    apikey: apiKey
  });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let raw = "";
    try {
      const res = await fetchImpl(`${apiUrl}?${q.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" }
      });
      raw = await res.text();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { done: true, verified: false, message: `Network error: ${msg}`, raw: "" };
    }
    const status = parseVerifyStatus(raw);
    if (!raw) return status;
    if (status.message.toLowerCase().includes("pending")) {
      if (Date.now() >= deadline) {
        return {
          done: true,
          verified: false,
          message: "Timed out waiting for verification. Check the explorer page directly.",
          raw
        };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    return status;
  }
}
