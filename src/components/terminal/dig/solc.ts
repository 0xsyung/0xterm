/**
 * @file solc.ts
 * @description Load official solc wasm (worker) + compile Standard JSON (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  DIG_ERROR,
  DIG_OPTIMIZER_ENABLED,
  DIG_OPTIMIZER_RUNS
} from "./constants";
import type { DigAbiItem, DigContractArtifact } from "./artifact";
import { loadCachedWasm, saveCachedWasm } from "./idb";
import { solcUrlsFor } from "./version";
import { hasSpdx, findImports, parsePragma, pragmaMatchesVersion } from "./pragma";

export type DigCompileResult =
  | {
      ok: true;
      artifacts: DigContractArtifact[];
      warnings: string[];
      solcVersion: string;
    }
  | {
      ok: false;
      code:
        | "no_source"
        | "pragma"
        | "missing_import"
        | "load_fail"
        | "compile_fail";
      message: string;
      errors?: string[];
      warnings?: string[];
    };

let worker: Worker | null = null;
let loadedVersion: string | null = null;
let loadPromise: Promise<void> | null = null;
let compileSeq = 0;
const pending = new Map<
  number,
  { resolve: (v: string) => void; reject: (e: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  // public/workers/solc-worker.js — static export friendly
  const url = `${typeof window !== "undefined" && window.location?.pathname?.includes("/app") ? "" : ""}/workers/solc-worker.js`;
  // Prefer absolute path from site root
  const workerUrl =
    typeof window !== "undefined"
      ? new URL("/workers/solc-worker.js", window.location.origin).href
      : "/workers/solc-worker.js";
  void url;
  worker = new Worker(workerUrl);
  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data || {};
    if (msg.type === "compile_result" && typeof msg.id === "number") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(String(msg.output || ""));
      }
    } else if (msg.type === "compile_fail" && typeof msg.id === "number") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.reject(new Error(msg.error || "compile failed"));
      }
    }
  };
  worker.onerror = (err) => {
    for (const [, p] of pending) {
      p.reject(new Error(err.message || "worker error"));
    }
    pending.clear();
  };
  return worker;
}

async function fetchSolcJs(version: string): Promise<string> {
  const cached = await loadCachedWasm(version);
  if (cached) return cached;
  const urls = solcUrlsFor(version);
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.length < 1000) throw new Error("solc payload too small");
      await saveCachedWasm(version, text);
      return text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("solc fetch failed");
}

function waitLoaded(w: Worker, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data || {};
      if (msg.type === "loaded" && msg.version === version) {
        w.removeEventListener("message", onMsg);
        resolve();
      } else if (msg.type === "load_fail") {
        w.removeEventListener("message", onMsg);
        reject(new Error(msg.error || DIG_ERROR.load_fail));
      }
    };
    w.addEventListener("message", onMsg);
  });
}

export async function ensureSolcLoaded(version: string): Promise<void> {
  if (loadedVersion === version && worker) return;
  if (loadPromise) {
    await loadPromise;
    if (loadedVersion === version) return;
  }
  loadPromise = (async () => {
    const w = ensureWorker();
    const jsText = await fetchSolcJs(version);
    const done = waitLoaded(w, version);
    w.postMessage({ type: "load_text", version, jsText });
    await done;
    loadedVersion = version;
  })();
  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function compileInWorker(input: string): Promise<string> {
  const w = ensureWorker();
  const id = ++compileSeq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "compile", id, input });
  });
}

function buildStandardInput(
  filename: string,
  content: string
): string {
  return JSON.stringify({
    language: "Solidity",
    sources: {
      [filename]: { content }
    },
    settings: {
      optimizer: {
        enabled: DIG_OPTIMIZER_ENABLED,
        runs: DIG_OPTIMIZER_RUNS
      },
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode",
            "evm.methodIdentifiers"
          ]
        }
      }
    }
  });
}

function extractArtifacts(
  output: {
    contracts?: Record<
      string,
      Record<
        string,
        {
          abi?: DigAbiItem[];
          evm?: {
            bytecode?: { object?: string; sourceMap?: string };
            deployedBytecode?: {
              object?: string;
              sourceMap?: string;
              opcodes?: string;
            };
          };
        }
      >
    >;
  },
  solcVersion: string
): DigContractArtifact[] {
  const out: DigContractArtifact[] = [];
  const files = output.contracts || {};
  for (const file of Object.keys(files)) {
    const contracts = files[file];
    for (const name of Object.keys(contracts)) {
      const c = contracts[name];
      const creation = c.evm?.bytecode?.object || "";
      const runtime = c.evm?.deployedBytecode?.object || "";
      const opcodes = c.evm?.deployedBytecode?.opcodes || "";
      out.push({
        name,
        solcVersion,
        creationBytecode: creation ? `0x${creation.replace(/^0x/i, "")}` : "",
        runtimeBytecode: runtime ? `0x${runtime.replace(/^0x/i, "")}` : "",
        opcodes,
        abi: Array.isArray(c.abi) ? c.abi : [],
        sourceMap: c.evm?.bytecode?.sourceMap,
        deployedSourceMap: c.evm?.deployedBytecode?.sourceMap
      });
    }
  }
  return out;
}

/**
 * Validate source + compile with selected solc. Pure-ish: IDB/network for wasm.
 */
export async function compileDigSource(opts: {
  filename: string;
  content: string;
  solcVersion: string;
}): Promise<DigCompileResult> {
  const content = opts.content?.trim() ? opts.content : "";
  if (!content.trim()) {
    return { ok: false, code: "no_source", message: DIG_ERROR.no_source };
  }
  if (!hasSpdx(content) || !parsePragma(content)) {
    return { ok: false, code: "pragma", message: DIG_ERROR.pragma };
  }
  if (!pragmaMatchesVersion(content, opts.solcVersion)) {
    return { ok: false, code: "pragma", message: DIG_ERROR.pragma };
  }
  const imports = findImports(content);
  if (imports.length > 0) {
    return {
      ok: false,
      code: "missing_import",
      message: DIG_ERROR.missing_import
    };
  }

  try {
    await ensureSolcLoaded(opts.solcVersion);
  } catch {
    return { ok: false, code: "load_fail", message: DIG_ERROR.load_fail };
  }

  let raw: string;
  try {
    raw = await compileInWorker(
      buildStandardInput(opts.filename || "Contract.sol", content)
    );
  } catch {
    return { ok: false, code: "load_fail", message: DIG_ERROR.load_fail };
  }

  let parsed: {
    errors?: Array<{ severity?: string; formattedMessage?: string; message?: string }>;
    contracts?: DigCompileResult extends never ? never : any;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "compile_fail", message: DIG_ERROR.compile_fail, errors: ["invalid compiler output"] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const e of parsed.errors || []) {
    const line = (e.formattedMessage || e.message || "").trim().split("\n")[0];
    if (!line) continue;
    if (e.severity === "warning") warnings.push(line);
    else errors.push(line);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      code: "compile_fail",
      message: DIG_ERROR.compile_fail,
      errors,
      warnings
    };
  }

  const artifacts = extractArtifacts(parsed as any, opts.solcVersion);
  return {
    ok: true,
    artifacts,
    warnings,
    solcVersion: opts.solcVersion
  };
}
