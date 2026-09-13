/**
 * @file encode.ts
 * @description Dig ABI encode/decode helpers via viem (#40)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  type Abi,
  type AbiFunction,
  type Address,
  decodeEventLog,
  decodeFunctionResult,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  isAddress
} from "viem";
import type { DigAbiItem } from "./artifact";
import { parseDigValue } from "./args";

export function toViemAbi(abi: DigAbiItem[]): Abi {
  return abi as unknown as Abi;
}

export function findAbiFunction(
  abi: DigAbiItem[],
  name: string
): AbiFunction | null {
  const fn = abi.find(
    (x) =>
      x &&
      x.type === "function" &&
      typeof x.name === "string" &&
      x.name === name
  );
  return (fn as AbiFunction | undefined) ?? null;
}

export function isViewLike(fn: AbiFunction): boolean {
  const m = fn.stateMutability;
  return m === "view" || m === "pure";
}

export function encodeDigCall(opts: {
  abi: DigAbiItem[];
  functionName: string;
  argTokens: string[];
}): { ok: true; data: `0x${string}`; fn: AbiFunction } | { ok: false; code: "bad_fn" | "arg" } {
  const fn = findAbiFunction(opts.abi, opts.functionName);
  if (!fn) return { ok: false, code: "bad_fn" };
  try {
    const args = coerceArgs(fn, opts.argTokens);
    const data = encodeFunctionData({
      abi: toViemAbi(opts.abi),
      functionName: opts.functionName,
      args
    });
    return { ok: true, data, fn };
  } catch {
    return { ok: false, code: "arg" };
  }
}

export function encodeDigDeploy(opts: {
  abi: DigAbiItem[];
  bytecode: `0x${string}`;
  argTokens: string[];
}): { ok: true; data: `0x${string}` } | { ok: false; code: "arg" } {
  try {
    const ctor = opts.abi.find((x) => x && x.type === "constructor") as
      | AbiFunction
      | undefined;
    const inputs = (ctor?.inputs || []) as { type?: string; name?: string }[];
    const fakeFn = {
      type: "function",
      name: "constructor",
      inputs,
      outputs: [],
      stateMutability: "nonpayable"
    } as AbiFunction;
    const args = inputs.length ? coerceArgs(fakeFn, opts.argTokens) : [];
    if (opts.argTokens.length && inputs.length === 0 && opts.argTokens.length > 0) {
      // unexpected args with no constructor inputs
      if (opts.argTokens.length > 0 && args.length === 0 && opts.argTokens.some(Boolean)) {
        // still try encodeDeployData with empty — refuse if tokens present
        return { ok: false, code: "arg" };
      }
    }
    if (opts.argTokens.length !== inputs.length) {
      // allow empty both
      if (!(opts.argTokens.length === 0 && inputs.length === 0)) {
        // try coerce anyway; length mismatch often fails below
      }
    }
    const data = encodeDeployData({
      abi: toViemAbi(opts.abi),
      bytecode: opts.bytecode,
      args
    });
    return { ok: true, data };
  } catch {
    return { ok: false, code: "arg" };
  }
}

export function decodeDigReturn(opts: {
  abi: DigAbiItem[];
  functionName: string;
  data: `0x${string}`;
}): { ok: true; values: unknown[] } | { ok: false; raw: string } {
  try {
    const result = decodeFunctionResult({
      abi: toViemAbi(opts.abi),
      functionName: opts.functionName,
      data: opts.data
    });
    const values = Array.isArray(result) ? [...result] : [result];
    return { ok: true, values };
  } catch {
    return { ok: false, raw: opts.data };
  }
}

export type DigDecodedEvent = {
  eventName: string;
  argsSummary: string;
};

export function decodeDigLogs(
  abi: DigAbiItem[],
  logs: Array<{ topics: `0x${string}`[]; data: `0x${string}` }>
): DigDecodedEvent[] {
  const out: DigDecodedEvent[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: toViemAbi(abi),
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data
      });
      const args = decoded.args as Record<string, unknown> | readonly unknown[] | undefined;
      out.push({
        eventName: decoded.eventName || "Event",
        argsSummary: formatEventArgs(args)
      });
    } catch {
      const topic0 = log.topics[0] || "0x";
      out.push({
        eventName: "log",
        argsSummary: truncateHex(topic0)
      });
    }
  }
  return out;
}

function coerceArgs(fn: AbiFunction, tokens: string[]): unknown[] {
  const inputs = fn.inputs || [];
  if (tokens.length !== inputs.length) {
    throw new Error("arity");
  }
  return inputs.map((input, i) => coerceOne(input.type, tokens[i]!));
}

function coerceOne(type: string, token: string): unknown {
  const v = parseDigValue(token);
  if (type === "address") {
    if (typeof v !== "string" || !isAddress(v)) throw new Error("addr");
    return getAddress(v);
  }
  if (type === "bool") {
    if (typeof v === "boolean") return v;
    throw new Error("bool");
  }
  if (type.startsWith("uint") || type.startsWith("int")) {
    if (typeof v === "bigint") return v;
    if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
    throw new Error("int");
  }
  if (type === "string") {
    return String(v);
  }
  if (type.startsWith("bytes")) {
    if (typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v)) return v;
    throw new Error("bytes");
  }
  if (type.endsWith("[]")) {
    if (!Array.isArray(v)) throw new Error("arr");
    const inner = type.slice(0, -2);
    return v.map((item) =>
      coerceOne(inner, typeof item === "string" ? item : String(item))
    );
  }
  return v;
}

export function formatReturnValues(values: unknown[]): string {
  return values.map((v) => formatOne(v)).join(", ");
}

function formatOne(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string" && isAddress(v)) return truncateAddress(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(formatOne).join(", ")}]`;
  if (v && typeof v === "object") {
    try {
      return JSON.stringify(v, (_k, val) =>
        typeof val === "bigint" ? val.toString() : val
      );
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatEventArgs(
  args: Record<string, unknown> | readonly unknown[] | undefined
): string {
  if (!args) return "";
  if (Array.isArray(args)) return args.map(formatOne).join(", ");
  const entries = Object.entries(args as Record<string, unknown>).filter(
    ([k]) => !/^\d+$/.test(k)
  );
  if (entries.length === 0) {
    return Object.values(args as Record<string, unknown>)
      .map(formatOne)
      .join(", ");
  }
  return entries.map(([k, v]) => `${k}=${formatOne(v)}`).join(", ");
}

export function truncateAddress(addr: string): string {
  try {
    const a = getAddress(addr);
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  } catch {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
}

export function truncateHex(hex: string): string {
  if (hex.length <= 14) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function checksumAddr(addr: string): Address {
  return getAddress(addr as Address);
}
