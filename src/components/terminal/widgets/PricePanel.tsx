/**
 * @file PricePanel.tsx
 * @description INVEST Price tool panel — base/quote/source/fee → PriceCard (#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThemeConfig } from "../types";
import PriceCard, { type PriceCardData } from "./PriceCard";
import PinButton from "./PinButton";

export type PriceSource = "pool" | "api";

export const PRICE_FEE_TIERS = [100, 500, 3000, 10000] as const;
export const DEFAULT_PRICE_FEE = 3000;

/**
 * Panel default SOURCE = API (safer zero-config on mainnets; no chain/DEX
 * required). CLI `price` still defaults to pool — documented in PR #117.
 */
export const DEFAULT_PRICE_SOURCE: PriceSource = "api";

const QUICK_BASE = ["ETH", "WETH", "USDC", "USDT", "DAI"] as const;
const QUICK_QUOTE = ["USDC", "USDT", "DAI", "WETH"] as const;

export type PriceRunArgs = {
  base: string;
  quote: string;
  source: PriceSource;
  feeTier: number;
};

export type PriceRunResult =
  | { ok: true; data: PriceCardData }
  | { ok: false; error: string };

/**
 * Build the equivalent CLI line for preview / dispatch.
 * Fee tier is only appended when QUOTE is present — otherwise the CLI
 * parses the fee number as tokenB (`price ETH 3000 pool`).
 */
export function buildPriceCli(args: PriceRunArgs): string {
  const parts = ["price", args.base.trim()];
  const quote = args.quote.trim();
  if (quote) parts.push(quote);
  if (args.source === "pool") {
    if (quote) parts.push(String(args.feeTier));
    parts.push("pool");
  } else {
    parts.push("api");
  }
  return parts.join(" ");
}

export default function PricePanel({
  theme,
  commonTokens,
  defaultSource = DEFAULT_PRICE_SOURCE,
  onClose,
  onRun,
  onPin,
  pinned = false
}: {
  theme: ThemeConfig;
  /** Symbol list from COMMON_TOKENS for the active chain (fallback = builtins). */
  commonTokens?: string[];
  defaultSource?: PriceSource;
  onClose: () => void;
  onRun: (args: PriceRunArgs) => Promise<PriceRunResult>;
  onPin?: (data: PriceCardData) => void;
  pinned?: boolean;
}) {
  const [base, setBase] = useState("");
  const [quote, setQuote] = useState("");
  const [source, setSource] = useState<PriceSource>(defaultSource);
  const [feeTier, setFeeTier] = useState<number>(DEFAULT_PRICE_FEE);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceCardData | null>(null);

  const baseQuick = useMemo(() => {
    const avail = new Set((commonTokens || []).map((s) => s.toUpperCase()));
    const fromCommon = QUICK_BASE.filter((s) => avail.size === 0 || avail.has(s));
    return fromCommon.length > 0 ? fromCommon : [...QUICK_BASE];
  }, [commonTokens]);

  const quoteQuick = useMemo(() => {
    const avail = new Set((commonTokens || []).map((s) => s.toUpperCase()));
    const fromCommon = QUICK_QUOTE.filter((s) => avail.size === 0 || avail.has(s));
    return fromCommon.length > 0 ? fromCommon : [...QUICK_QUOTE];
  }, [commonTokens]);

  // POOL needs a quote so fee is never mistaken for tokenB (#118 Alex QA).
  const canRun =
    base.trim().length > 0 &&
    (source !== "pool" || quote.trim().length > 0) &&
    !running;
  const preview = buildPriceCli({
    base: base.trim() || "…",
    quote: quote.trim(),
    source,
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

  const run = async () => {
    if (!base.trim()) return;
    if (source === "pool" && !quote.trim()) {
      setError("QUOTE required for POOL (fee must not be parsed as quote).");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const res = await onRun({
        base: base.trim(),
        quote: quote.trim(),
        source,
        feeTier
      });
      if (res.ok) {
        setResult(res.data);
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

  return (
    <div
      className={`w-full max-w-[390px] flex flex-col gap-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded}`}
      data-testid="price-panel"
      role="dialog"
      aria-label="Price"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`uppercase text-[10px] tracking-widest font-bold ${theme.primary}`}
        >
          PRICE
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close price panel"
          className={`cursor-pointer bg-transparent border-0 p-0 text-[14px] leading-none ${theme.muted} ${touch}`}
          data-testid="price-panel-close"
        >
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>BASE</span>
        <input
          type="text"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="symbol or 0x…"
          className={`w-full px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
          data-testid="price-base"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="flex flex-wrap gap-1" data-testid="price-base-quick">
        {baseQuick.map((s) => {
          const active = base.toUpperCase() === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setBase(s)}
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

      <label className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>QUOTE</span>
        <input
          type="text"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="symbol or 0x…"
          className={`w-full px-2 py-1.5 border ${theme.border} bg-transparent ${theme.text} font-mono text-[12px] outline-none ${touch}`}
          data-testid="price-quote"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="flex flex-wrap gap-1" data-testid="price-quote-quick">
        {quoteQuick.map((s) => {
          const active = quote.toUpperCase() === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setQuote(s)}
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

      <div className="flex flex-col gap-1">
        <span className={`uppercase text-[9px] ${theme.muted}`}>SOURCE</span>
        <div className="flex flex-wrap gap-1" data-testid="price-source">
          {(["pool", "api"] as const).map((s) => {
            const active = source === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={pill(active)}
                style={
                  active
                    ? { background: theme.phosphor, color: "#000000" }
                    : undefined
                }
                aria-pressed={active}
              >
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {source === "pool" && (
        <div className="flex flex-col gap-1" data-testid="price-fee">
          <span className={`uppercase text-[9px] ${theme.muted}`}>
            FEE TIER
          </span>
          <div className="flex flex-wrap gap-1">
            {PRICE_FEE_TIERS.map((f) => {
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
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={!canRun}
        className={`w-full uppercase tracking-widest text-[10px] font-bold border border-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${touch}`}
        style={{ background: theme.phosphor, color: "#000000" }}
        data-testid="price-run"
      >
        {running ? "…" : "RUN"}
      </button>
      <div className={`text-[9px] ${theme.muted} font-mono`}>{preview}</div>
      {error && (
        <div
          className={`text-[10px] ${theme.warn || theme.muted}`}
          data-testid="price-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {result && (
        <div data-testid="price-result" className="relative">
          <PriceCard data={result} theme={theme} />
          {onPin && !pinned && (
            <div className="absolute top-2 right-2">
              <PinButton onPin={() => onPin(result)} theme={theme} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
