/**
 * @file CalldataWidget.tsx
 * @description calldata builder — contract + ABI source + fn + params → encoded hex (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useMemo, useState } from "react";
import { parseAbi, type Abi, type AbiFunction, type Address } from "viem";
import type { ThemeConfig } from "../../types";
import { truncateAddress } from "../../dig/encode";
import { encodeCalldata } from "../encode";
import { CALDATA_ERROR, KNOWN_ABIS } from "../constants";

type SimResult = { ok: boolean; label: string };

export default function CalldataWidget({
  theme,
  to: initialTo,
  fnName: initialFnName,
  argsSummary: initialArgsSummary,
  data: initialData,
  onSimulate,
  onCopied,
  simLabel: initialSimLabel,
  simOk: initialSimOk
}: {
  theme: ThemeConfig;
  to?: string;
  fnName?: string;
  argsSummary?: string;
  data?: `0x${string}`;
  onSimulate?: (opts: { to: Address; data: `0x${string}` }) => Promise<SimResult>;
  onCopied?: () => void;
  simLabel?: string;
  simOk?: boolean;
}) {
  const [to, setTo] = useState(initialTo || "");
  const [abiSource, setAbiSource] = useState<"fnSig" | "json" | "known">("known");
  const [knownId, setKnownId] = useState(KNOWN_ABIS[0]?.id || "");
  const [jsonText, setJsonText] = useState("");
  const [fnSigText, setFnSigText] = useState("");
  const [fnName, setFnName] = useState(initialFnName || "");
  const [argValues, setArgValues] = useState<string[]>([]);
  const [result, setResult] = useState<{
    data: `0x${string}`;
    to: Address;
    fnName: string;
    argsSummary: string;
  } | null>(initialData ? { data: initialData, to: initialTo as Address, fnName: initialFnName || "", argsSummary: initialArgsSummary || "" } : null);
  const [error, setError] = useState<string | null>(null);
  const [simLabel, setSimLabel] = useState<string | undefined>(initialSimLabel);
  const [simOk, setSimOk] = useState<boolean | undefined>(initialSimOk);
  const [simming, setSimming] = useState(false);
  const [ack, setAck] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const knownAbi = useMemo(
    () => KNOWN_ABIS.find((k) => k.id === knownId)?.abi,
    [knownId]
  );

  // Resolve the ABI + function list from the current source selection.
  const abiView = useMemo<{ abi: Abi | null; funcs: AbiFunction[]; sourceLabel: string }>(() => {
    if (abiSource === "fnSig") {
      try {
        // viem parseAbi needs the `function` keyword; user types a bare signature.
        const sig = fnSigText.trim().startsWith("function") ? fnSigText.trim() : `function ${fnSigText.trim()}`;
        const parsed = sig
          ? (parseAbi([sig] as unknown as readonly [string]) as Abi)
          : ([] as Abi);
        const funcs = parsed.filter((x): x is AbiFunction => x.type === "function");
        return { abi: parsed, funcs, sourceLabel: "fnSig" };
      } catch {
        return { abi: null, funcs: [], sourceLabel: "fnSig — invalid" };
      }
    }
    if (abiSource === "json") {
      try {
        const parsed = parseAbi(
          (jsonText.trim() || "[]") as unknown as readonly [string]
        ) as Abi;
        const funcs = parsed.filter((x): x is AbiFunction => x.type === "function");
        return { abi: parsed, funcs, sourceLabel: "JSON ABI" };
      } catch {
        return { abi: null, funcs: [], sourceLabel: "JSON ABI — invalid" };
      }
    }
    const funcs = (knownAbi || []).filter((x): x is AbiFunction => x.type === "function");
    return { abi: knownAbi || null, funcs, sourceLabel: KNOWN_ABIS.find((k) => k.id === knownId)?.label || "known ABI" };
  }, [abiSource, fnSigText, jsonText, knownAbi, knownId]);

  const selectedFn = useMemo(
    () => abiView.funcs.find((f) => f.name === fnName) || null,
    [abiView.funcs, fnName]
  );

  // When the function changes, reset the arg input values to empty strings.
  const handleFnChange = (name: string) => {
    setFnName(name);
    setArgValues([]);
    setResult(null);
    setError(null);
    setSimLabel(undefined);
    setSimOk(undefined);
  };

  const handleSourceChange = (source: "fnSig" | "json" | "known") => {
    setAbiSource(source);
    setFnName("");
    setArgValues([]);
    setResult(null);
    setError(null);
    setSimLabel(undefined);
    setSimOk(undefined);
  };

  const canEncode =
    !!to && !!selectedFn && argValues.length === selectedFn.inputs.length;

  const handleEncode = () => {
    setError(null);
    setSimLabel(undefined);
    setSimOk(undefined);
    const opts: {
      to: string;
      fnSig?: string;
      abi?: Abi;
      functionName?: string;
      args: string[];
    } = {
      to,
      args: argValues
    };
    if (abiSource === "fnSig") {
      opts.fnSig = fnSigText;
    } else {
      opts.abi = abiView.abi || undefined;
      opts.functionName = fnName;
    }
    const out = encodeCalldata(opts);
    if (!out.ok) {
      setError(
        out.code === "bad_to"
          ? CALDATA_ERROR.bad_to
          : out.code === "bad_sig"
            ? CALDATA_ERROR.bad_sig(out.reason)
            : out.code === "bad_fn"
              ? CALDATA_ERROR.bad_fn(fnName)
              : out.code === "arity"
                ? CALDATA_ERROR.arity(
                    selectedFn?.inputs.length ?? 0,
                    argValues.length,
                    fnName
                  )
                : `[!] calldata.arg — ${out.reason}`
      );
      return;
    }
    setResult({ data: out.data, to: out.to, fnName: out.fnName, argsSummary: out.argsSummary });
  };

  const handleSimulate = async () => {
    if (!result || !onSimulate) return;
    setSimming(true);
    try {
      const r = await onSimulate({ to: result.to, data: result.data });
      setSimLabel(r.label);
      setSimOk(r.ok);
    } finally {
      setSimming(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.data);
      setAck(true);
      onCopied?.();
      setTimeout(() => setAck(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const short = result ? `${result.data.slice(0, 34)}…${result.data.slice(-8)}` : "";

  const inputCls = `w-full min-w-0 px-1.5 py-0.5 text-[11px] outline-none border ${theme.border} ${theme.bg} ${theme.text} font-mono tabular-nums rounded-none`;
  const selectCls = `border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono px-1 py-0.5`;

  return (
    <div
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} w-full max-w-xl text-[10px] ${theme.text} tabular-nums`}
    >
      <div className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider flex items-center gap-2 ${theme.primary}`}>
        <span>CALDATA BUILDER</span>
        <span className={theme.muted}>arbitrary contract call encoder</span>
      </div>

      <div className="space-y-2">
        <div>
          <div className={theme.muted}>CONTRACT ADDRESS</div>
          <input
            type="text"
            value={to}
            placeholder="0x…"
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
            style={{ caretColor: theme.phosphor }}
          />
        </div>

        <div>
          <div className={theme.muted}>ABI SOURCE</div>
          <select
            value={abiSource}
            onChange={(e) => handleSourceChange(e.target.value as "fnSig" | "json" | "known")}
            className={selectCls}
          >
            <option value="known">Known ABI</option>
            <option value="fnSig">fnSig string</option>
            <option value="json">Paste JSON ABI</option>
          </select>
        </div>

        {abiSource === "known" && (
          <div>
            <div className={theme.muted}>KNOWN ABI</div>
            <select
              value={knownId}
              onChange={(e) => {
                setKnownId(e.target.value);
                handleSourceChange("known");
              }}
              className={selectCls}
            >
              {KNOWN_ABIS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {abiSource === "fnSig" && (
          <div>
            <div className={theme.muted}>FUNCTION SIGNATURE</div>
            <input
              type="text"
              value={fnSigText}
              placeholder="transfer(address,uint256)"
              onChange={(e) => setFnSigText(e.target.value)}
              className={inputCls}
              style={{ caretColor: theme.phosphor }}
            />
          </div>
        )}

        {abiSource === "json" && (
          <div>
            <div className={theme.muted}>JSON ABI</div>
            <textarea
              value={jsonText}
              placeholder='[{"type":"function","name":"approve","inputs":[...]}]'
              onChange={(e) => setJsonText(e.target.value)}
              className={`${inputCls} min-h-[60px] resize-y`}
              style={{ caretColor: theme.phosphor }}
            />
          </div>
        )}

        <div>
          <div className={theme.muted}>FUNCTION ({abiView.funcs.length})</div>
          <select
            value={fnName}
            onChange={(e) => handleFnChange(e.target.value)}
            className={selectCls}
            disabled={abiView.funcs.length === 0}
          >
            {abiView.funcs.length === 0 && <option value="">—</option>}
            {abiView.funcs.map((f) => (
              <option key={`${f.name}(${f.inputs.map((i) => i.type).join(",")})`} value={f.name}>
                {f.name}({f.inputs.map((i) => i.type).join(", ")})
              </option>
            ))}
          </select>
        </div>

        {selectedFn && (
          <div className="space-y-1">
            <div className={theme.muted}>ARGS</div>
            {selectedFn.inputs.map((input, i) => {
              const t = (input as { type?: string }).type ?? "";
              return (
                <div key={`${fnName}-${i}`} className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-1 items-center">
                  <span className={`${theme.muted} font-mono`}>{t}</span>
                  <input
                    type="text"
                    value={argValues[i] || ""}
                    placeholder={(input as { name?: string }).name || `arg${i + 1}`}
                    onChange={(e) => {
                      const next = [...argValues];
                      next[i] = e.target.value;
                      setArgValues(next);
                      setResult(null);
                      setError(null);
                      setSimLabel(undefined);
                      setSimOk(undefined);
                    }}
                    className={inputCls}
                    style={{ caretColor: theme.phosphor }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleEncode}
          disabled={!canEncode}
          className={`uppercase text-[10px] px-2 border ${theme.border} ${theme.primary} min-h-[44px] min-w-[44px] cursor-pointer ${canEncode ? "" : "opacity-40 cursor-default"}`}
        >
          ENCODE
        </button>

        {error && <div className={`${theme.warn} text-[10px]`}>{error}</div>}

        {result && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className={theme.muted}>TO</span>
              <span className="font-mono break-all">{truncateAddress(result.to)}</span>
            </div>
            <div className="flex justify-between">
              <span className={theme.muted}>FN</span>
              <span className="font-mono">{result.fnName}</span>
            </div>
            <div className="flex justify-between">
              <span className={theme.muted}>ARGS</span>
              <span className="font-mono break-words text-left ml-2">{result.argsSummary}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className={theme.muted}>DATA</span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`font-mono break-all text-left ml-2 cursor-pointer ${expanded ? "" : theme.muted}`}
              >
                {expanded ? result.data : short}
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => void copy()}
                className={`uppercase text-[10px] px-2 border ${theme.border} ${theme.primary} cursor-pointer min-h-[44px] min-w-[44px]`}
              >
                {ack ? "[✓]" : "COPY"}
              </button>
              {onSimulate && (
                <button
                  type="button"
                  onClick={() => void handleSimulate()}
                  disabled={simming}
                  className={`uppercase text-[10px] px-2 border ${theme.border} ${theme.primary} cursor-pointer min-h-[44px] min-w-[44px] ${simming ? "opacity-40 cursor-default" : ""}`}
                >
                  {simming ? "SIM…" : "SIMULATE"}
                </button>
              )}
            </div>
            {simLabel && (
              <div className={`text-[9px] ${simOk ? theme.primary : theme.warn}`}>
                {simLabel}
              </div>
            )}
            <div className={`${theme.muted} text-[9px]`}>
              hex calldata · verify before broadcast
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
