/**
 * @file SwapPanel.tsx
 * @description INVEST Swap tool panel — amount/from/to/slippage/fee → SwapWidget (#119)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemeConfig } from "../types";

export const SWAP_FEE_TIERS = [100, 500, 3000, 10000] as const;
export const DEFAULT_SWAP_FEE = 3000;
export const DEFAULT_SWAP_SLIPPAGE = 0.5;
export const SWAP_SLIPPAGE_QUICK = [0.1, 0.5, 1, 3] as const;

const QUICK_TOKENS = ["ETH", "WETH", "USDC", "USDT", "DAI"] as const;

export type SwapRunArgs = {
  amount: string;
  fromToken: string;
  toToken: string;
  slippage: number;
  feeTier: number;
};

export type SwapRunResult =
  | { ok: true; component: ReactNode }
  | { ok: false; error: string };

/**
 * Build the equivalent CLI line for preview / dispatch.
 * Always includes slippage + fee (panel defaults are explicit so RUN is
 * deterministic and never hits bare Usage).
 */
export function buildSwapCli(args: {
  amount: string;
  fromToken: string;
  toToken: string;
  slippage: number;
  feeTier: number;
}): string {
  return [
    "swap",
    args.amount.trim() || "…",
    args.fromToken.trim() || "…",
    args.toToken.trim() || "…",
    String(args.slippage),
    String(args.feeTier)
  ].join(" ");
}

/** True when slippage is a finite number in (0, 100]. */
export function isValidSlippage(slippage: number): boolean {
  return Number.isFinite(slippage) && slippage > 0 && slippage <= 100;
}

/** True when amount is a non-empty parseable positive number. */
export function isValidAmount(amount: string): boolean {
  const t = amount.trim();
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

/**
 * Gate for RUN — required fields filled, slippage valid, FROM≠TO, not running.
 */
export function canRunSwap(args: {
  amount: string;
  fromToken: string;
  toToken: string;
  slippage: number;
  running?: boolean;
}): boolean {
  const from = args.fromToken.trim();
  const to = args.toToken.trim();
  return (
    isValidAmount(args.amount) &&
    from.length > 0 &&
    to.length > 0 &&
    from.toUpperCase() !== to.toUpperCase() &&
    isValidSlippage(args.slippage) &&
    !args.running
  );
}

export default function SwapPanel({
  theme,
  commonTokens,
  onClose,
  onRun
}: {
  theme: ThemeConfig;
  /** Symbol list from COMMON_TOKENS for the active chain (fallback = builtins). */
  commonTokens?: string[];
  onClose: () => void;
  onRun: (args: SwapRunArgs) => Promise<SwapRunResult>;
}) {
  const [amount, setAmount] = useState("");
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [slippage, setSlippage] = useState<number>(DEFAULT_SWAP_SLIPPAGE);
  const [slippageInput, setSlippageInput] = useState(String(DEFAULT_SWAP_SLIPPAGE));
  const [feeTier, setFeeTier] = useState<number>(DEFAULT_SWAP_FEE);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReactNode | null>(null);

  const tokenQuick = useMemo(() => {
    const avail = new Set((commonTokens || []).map((s) => s.toUpperCase()));
    const fromCommon = QUICK_TOKENS.filter((s) => avail.size === 0 || avail.has(s));
    return fromCommon.length > 0 ? fromCommon : [...QUICK_TOKENS];
  }, [commonTokens]);

  const fromSameAsTo =
    fromToken.trim().length > 0 &&
    toToken.trim().length > 0 &&
    fromToken.trim().toUpperCase() === toToken.trim().toUpperCase();
  const slippageOk = isValidSlippage(slippage);
  const canRun = canRunSwap({
    amount,
    fromToken,
    toToken,
    slippage,
    running
  });
  const preview = buildSwapCli({
    amount,
    fromToken,
    toToken,
    slippage: slippageOk ? slippage : DEFAULT_SWAP_SLIPPAGE,
    feeTier
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applySlippage = (raw: string) => {
    setSlippageInput(raw);
    const n = Number(raw);
    if (Number.isFinite(n)) setSlippage(n);
    else setSlippage(NaN);
  };

  const run = async () => {
    if (!canRunSwap({ amount, fromToken, toToken, slippage })) return;
    setError(null);
    setRunning(true);
    try {
      const res = await onRun({
        amount: amount.trim(),
        fromToken: fromToken.trim(),
        toToken: toToken.trim(),
        slippage,
        feeTier
      });
      if (res.ok) {
        setResult(res.component);
      } else {
        setResult(null);
        setError(res.error);
      }
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const touch =
    "pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px]";
  const pill = (active: boolean) =>
    `inline-flex items-center justify-center px-2.5 uppercase tracking-widest text-[10px] cursor-pointer border ${touch} ${
      active
        ? "border-transparent font-bold"
        : `${theme.border} ${theme.muted} bg-transparent`
    }`;

  const tokenChips = (
    rowTestId: string,
    value: string,
    setValue: (s: string) => void
  ) => (
    <div className="flex flex-wrap gap-1" data-testid={rowTestId}>
      {tokenQuick.map((s) => {
        const active = value.toUpperCase() === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className={pill(active)}
            style={
              active
                ? { background: theme.phosphor, color: "#000000" }
                : undefined
            }
          >
            {s}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`w-full max-w-[390px] flex flex-col gap-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded}`}
      data-testid="swap-panel"
      role="dialog"
      aria-label="Swap"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`uppercase text-[10px] tracking-widest font-bold ${theme.primary}`}
        >
          SWAP
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close swap panel"
          className={`cursor-pointer bg-transparent border-0 p-0 text-[14px] leading-none ${theme.muted} ${touch}`}
          data-testid="swap-panel-close"
        >
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>AMOUNT</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className={`w-full px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
          data-testid="swap-amount"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>FROM</span>
        <input
          type="text"
          value={fromToken}
          onChange={(e) => setFromToken(e.target.value)}
          placeholder="symbol or 0x…"
          className={`w-full px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
          data-testid="swap-from"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {tokenChips("swap-from-quick", fromToken, setFromToken)}

      <label className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>TO</span>
        <input
          type="text"
          value={toToken}
          onChange={(e) => setToToken(e.target.value)}
          placeholder="symbol or 0x…"
          className={`w-full px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
          data-testid="swap-to"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {tokenChips("swap-to-quick", toToken, setToToken)}

      <div className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>SLIPPAGE %</span>
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={slippageInput}
            onChange={(e) => applySlippage(e.target.value)}
            className={`w-[72px] px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
            data-testid="swap-slippage"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-1" data-testid="swap-slippage-quick">
            {SWAP_SLIPPAGE_QUICK.map((s) => {
              const active = slippage === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSlippage(s);
                    setSlippageInput(String(s));
                  }}
                  className={pill(active)}
                  style={
                    active
                      ? { background: theme.phosphor, color: "#000000" }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1" data-testid="swap-fee">
        <span className={`uppercase text-[9px] ${theme.muted}`}>FEE TIER</span>
        <div className="flex flex-wrap gap-1">
          {SWAP_FEE_TIERS.map((f) => {
            const active = feeTier === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFeeTier(f)}
                className={pill(active)}
                style={
                  active
                    ? { background: theme.phosphor, color: "#000000" }
                    : undefined
                }
                aria-pressed={active}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={!canRun}
        className={`w-full uppercase tracking-widest text-[10px] font-bold border border-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${touch}`}
        style={{ background: theme.phosphor, color: "#000000" }}
        data-testid="swap-run"
      >
        {running ? "…" : "RUN"}
      </button>
      <div className={`text-[9px] ${theme.muted} font-mono`} data-testid="swap-preview">
        {preview}
      </div>
      {fromSameAsTo && (
        <div
          className={`text-[10px] ${theme.warn || theme.muted}`}
          data-testid="swap-warn-same"
          role="alert"
        >
          FROM and TO must differ.
        </div>
      )}
      {!slippageOk && (
        <div
          className={`text-[10px] ${theme.warn || theme.muted}`}
          data-testid="swap-warn-slippage"
          role="alert"
        >
          Slippage must be &gt; 0 and ≤ 100.
        </div>
      )}
      {error && (
        <div
          className={`text-[10px] ${theme.warn || theme.muted}`}
          data-testid="swap-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {result && (
        <div data-testid="swap-result" className="relative">
          {result}
        </div>
      )}
    </div>
  );
}
