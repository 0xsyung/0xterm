/**
 * @file encode.ts
 * @description calldata generator core — encode from fnSig or known/pasted ABI (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  encodeFunctionData,
  isAddress,
  getAddress,
  type Abi,
  type AbiFunction,
  type Address
} from "viem";
import { parseDigValue } from "../dig/args";
import { parseFnSig } from "./parse";

export type CalldataOutcome =
  | { ok: true; data: `0x${string}`; to: Address; fnName: string; argsSummary: string; fn: AbiFunction }
  | { ok: false; code: "bad_to" | "bad_sig" | "bad_fn" | "arity" | "arg"; reason: string };

/**
 * Encode calldata for a contract call. Source is either a parsed fnSig
 * (`fnSig`) or an existing ABI (`abi` + `functionName`). Args are coerced from
 * string tokens via parseDigValue — shared with the dig workshop.
 */
export function encodeCalldata(opts: {
  to: string;
  fnSig?: string;
  abi?: Abi;
  functionName?: string;
  args: string[];
}): CalldataOutcome {
  if (!isAddress(opts.to))
    return { ok: false, code: "bad_to", reason: "Need a 0x contract address." };
  const to = getAddress(opts.to as Address);

  let fn: AbiFunction;
  let abi: Abi;
  if (opts.fnSig) {
    const parsed = parseFnSig(opts.fnSig);
    if (!parsed.ok) return { ok: false, code: "bad_sig", reason: parsed.reason };
    fn = parsed.fn;
    abi = [fn] as unknown as Abi;
  } else {
    if (!opts.abi || !opts.functionName)
      return { ok: false, code: "bad_fn", reason: "Need an ABI + function name." };
    const found = (opts.abi as Abi).find(
      (x) =>
        x &&
        x.type === "function" &&
        typeof x.name === "string" &&
        x.name === opts.functionName
    ) as AbiFunction | undefined;
    if (!found) return { ok: false, code: "bad_fn", reason: `Function "${opts.functionName}" not in ABI.` };
    fn = found;
    abi = opts.abi as Abi;
  }

  const inputs = fn.inputs || [];
  if (opts.args.length !== inputs.length)
    return {
      ok: false,
      code: "arity",
      reason: `${fn.name} expects ${inputs.length} arg${inputs.length === 1 ? "" : "s"}, got ${opts.args.length}.`
    };

  let coerced: unknown[];
  try {
    coerced = inputs.map((input, i) =>
      coerceOne((input as { type?: string }).type ?? "", opts.args[i]!)
    );
  } catch {
    return { ok: false, code: "arg", reason: "One or more args failed type coercion." };
  }

  let data: `0x${string}`;
  try {
    data = encodeFunctionData({ abi, functionName: fn.name, args: coerced });
  } catch {
    return { ok: false, code: "arg", reason: `Could not encode ${fn.name}(${opts.args.join(", ")}).` };
  }

  return {
    ok: true,
    data,
    to,
    fnName: fn.name,
    argsSummary: opts.args.join(", "),
    fn
  };
}

/** Same coercion rules as dig/encode.ts but referenced here to avoid a dependency cycle. */
function coerceOne(type: string, token: string): unknown {
  const v = parseDigValue(token);
  if (type.endsWith("[]")) {
    if (!Array.isArray(v)) throw new Error("arr");
    const inner = type.slice(0, -2);
    return v.map((item) =>
      coerceOne(inner, typeof item === "string" ? item : String(item))
    );
  }
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
  if (type === "string") return String(v);
  if (type.startsWith("bytes")) {
    if (typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v)) return v;
    throw new Error("bytes");
  }
  return v;
}
