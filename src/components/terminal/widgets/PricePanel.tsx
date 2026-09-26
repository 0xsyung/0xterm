/**
 * @file PricePanel.tsx
 * @description INVEST Price tool panel — base/quote/SOURCE ON-CHAIN|API + DEX/fee → PriceCard (#117/#121)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DexProtocol, ThemeConfig } from "../types";
import PriceCard, { type PriceCardData } from "./PriceCard";
import PinButton from "./PinButton";

/** Internal CLI source token — UI label is ON-CHAIN for "pool". */
export type PriceSource = "pool" | "api";

export const PRICE_FEE_TIERS = [100, 500, 3000, 10000] as const;
export const DEFAULT_PRICE_FEE = 3000;

/**
 * Fallback when no chain/DEX — API is zero-config. Prefer
 * `resolveDefaultPriceSource` when activeChainId + DEX are known (#121).
 */
export const DEFAULT_PRICE_SOURCE: PriceSource = "api";

const QUICK_BASE = ["ETH", "WETH", "USDC", "USDT", "DAI"] as const;
const QUICK_QUOTE = ["USDC", "USDT", "DAI", "WETH"] as const;

export type PriceRunArgs = {
  base: string;
  quote: string;
  source: PriceSource;
  feeTier: number;
  /** When V2, CLI omits fee tier (not used by getPair). */
  dexType?: "V2" | "V3";
};

export type PriceRunResult =
  | { ok: true; data: PriceCardData }
  | { ok: false; error: string };

/** Default SOURCE: ON-CHAIN when chain set and DEX available; else API (#121). */
export function resolveDefaultPriceSource(opts: {
  activeChainId?: number | null;
  activeDexId?: string | null;
  dexCount?: number;
}): PriceSource {
  if (
    opts.activeChainId != null &&
    ((opts.dexCount ?? 0) >= 1 || !!opts.activeDexId)
  ) {
    return "pool";
  }
  return "api";
}

/**
 * Build the equivalent CLI line for preview / dispatch.
 * Fee tier is only appended when QUOTE is present and DEX is not V2 —
 * otherwise the CLI parses the fee number as tokenB (`price ETH 3000 pool`).
 */
export function buildPriceCli(args: PriceRunArgs): string {
  const parts = ["price", args.base.trim()];
  const quote = args.quote.trim();
  if (quote) parts.push(quote);
  if (args.source === "pool") {
    if (quote && args.dexType !== "V2") parts.push(String(args.feeTier));
    parts.push("pool");
  } else {
    parts.push("api");
  }
  return parts.join(" ");
}

/** Strip CLI-only "omit api" advice from panel error surfaces (#121). */
export function sanitizePricePanelError(msg: string): string {
  if (/omit\s+['"]?api['"]?/i.test(msg)) {
    return "No DexScreener quote — try on-chain pool.";
  }
  return msg;
}

export default function PricePanel({
  theme,
  commonTokens,
  defaultSource,
  activeChainId = null,
  activeDexId = null,
  dexes,
  onDexChange,
  onClose,
  onRun,
  onPin,
  pinned = false
}: {
  theme: ThemeConfig;
  /** Symbol list from COMMON_TOKENS for the active chain (fallback = builtins). */
  commonTokens?: string[];
  /** Explicit override; when omitted, resolve from chain/DEX (#121). */
  defaultSource?: PriceSource;
  activeChainId?: number | null;
  activeDexId?: string | null;
  /** DEX_REGISTRY[activeChainId] entries. */
  dexes?: DexProtocol[];
  /** Sync global activeDexId when user picks a DEX. */
  onDexChange?: (dexId: string) => void;
  onClose: () => void;
  onRun: (args: PriceRunArgs) => Promise<PriceRunResult>;
  onPin?: (data: PriceCardData) => void;
  pinned?: boolean;
}) {
  const dexList = dexes ?? [];

  const [base, setBase] = useState("");
  const [quote, setQuote] = useState("");
  const [source, setSource] = useState<PriceSource>(() =>
    defaultSource !== undefined
      ? defaultSource
      : resolveDefaultPriceSource({
          activeChainId,
          activeDexId,
          dexCount: dexList.length
        })
  );
  const [feeTier, setFeeTier] = useState<number>(DEFAULT_PRICE_FEE);
  const [selectedDexId, setSelectedDexId] = useState<string | null>(() => {
    if (activeDexId && dexList.some((d) => d.id === activeDexId)) {
      return activeDexId;
    }
    return dexList[0]?.id ?? null;
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceCardData | null>(null);

  // Keep selected DEX aligned when NETWORK / activeDexId changes.
  const dexIdsKey = dexList.map((d) => d.id).join(",");
  useEffect(() => {
    const list = dexes ?? [];
    const next =
      activeDexId && list.some((d) => d.id === activeDexId)
        ? activeDexId
        : list[0]?.id ?? null;
    setSelectedDexId(next);
    // dexIdsKey stands in for dexes identity without array-ref churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChainId, activeDexId, dexIdsKey]);

  const selectedDex = dexList.find((d) => d.id === selectedDexId);
  const showFee = source === "pool" && selectedDex?.type === "V3";
  const emptyDex = source === "pool" && dexList.length === 0;

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

  // ON-CHAIN: BASE + QUOTE + DEX (+ fee shown only for V3). API: BASE only.
  const canRun =
    base.trim().length > 0 &&
    (source !== "pool" ||
      (quote.trim().length > 0 && !!selectedDexId && dexList.length > 0)) &&
    !running;

  const preview = buildPriceCli({
    base: base.trim() || "…",
    quote: quote.trim(),
    source,
    feeTier,
    dexType: selectedDex?.type
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

  const pickDex = (id: string) => {
    setSelectedDexId(id);
    onDexChange?.(id);
  };

  const useOnChain = () => {
    setSource("pool");
    setError(null);
  };

  const run = async () => {
    if (!base.trim()) return;
    if (source === "pool") {
      if (!quote.trim()) {
        setError("QUOTE required for ON-CHAIN (fee must not be parsed as quote).");
        return;
      }
      if (!selectedDexId || dexList.length === 0) {
        setError("No DEX on this network — change NETWORK.");
        return;
      }
      // Ensure global activeDexId matches selection before dispatch.
      if (selectedDexId !== activeDexId) onDexChange?.(selectedDexId);
    }
    setError(null);
    setRunning(true);
    try {
      const res = await onRun({
        base: base.trim(),
        quote: quote.trim(),
        source,
        feeTier,
        dexType: selectedDex?.type
      });
      if (res.ok) {
        setResult(res.data);
      } else {
        setResult(null);
        setError(sanitizePricePanelError(res.error));
      }
    } catch (err: unknown) {
      setResult(null);
      setError(
        sanitizePricePanelError(
          err instanceof Error ? err.message : String(err)
        )
      );
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

  const sourceLabel = (s: PriceSource) => (s === "pool" ? "ON-CHAIN" : "API");

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
                onClick={() => {
                  setSource(s);
                  if (s === "pool") setError(null);
                }}
                className={pill(active)}
                style={
                  active
                    ? { background: theme.phosphor, color: "#000000" }
                    : undefined
                }
                aria-pressed={active}
              >
                {sourceLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      {source === "pool" && (
        <div className="flex flex-col gap-1" data-testid="price-dex">
          <span className={`uppercase text-[9px] ${theme.muted}`}>DEX</span>
          {emptyDex ? (
            <div
              className={`text-[10px] ${theme.warn || theme.muted}`}
              data-testid="price-dex-empty"
              role="status"
            >
              No DEX on this network — change NETWORK.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {dexList.map((d) => {
                const active = selectedDexId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pickDex(d.id)}
                    className={pill(active)}
                    style={
                      active
                        ? { background: theme.phosphor, color: "#000000" }
                        : undefined
                    }
                    aria-pressed={active}
                    data-testid={`price-dex-option-${d.id}`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showFee && (
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
      {error && source === "api" && (
        <button
          type="button"
          onClick={useOnChain}
          className={`w-full uppercase tracking-widest text-[10px] font-bold border cursor-pointer ${theme.border} ${touch}`}
          style={{ background: theme.phosphor, color: "#000000" }}
          data-testid="price-use-on-chain"
        >
          USE ON-CHAIN
        </button>
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
