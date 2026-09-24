/**
 * @file ScanWidget.tsx
 * @description 3-venue arb scan card (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { ThemeConfig } from "../../types";
import PinButton from "../../widgets/PinButton";

export default function ScanWidget({
  venueA,
  venueB,
  venueC,
  sizeLabel,
  grossLabel,
  gasLabel,
  netLabel,
  netNegative,
  theme,
  onPin,
  pinned
}: {
  venueA: string;
  venueB: string;
  venueC: string;
  sizeLabel: string;
  grossLabel: string;
  gasLabel: string;
  netLabel: string;
  netNegative: boolean;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
}) {
  return (
    <div
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} w-full max-w-md text-[10px] ${theme.text} tabular-nums`}
    >
      <div className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary}`}>
        ARB SCAN
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className={theme.muted}>VENUE A</span>
          <span className="font-mono">{venueA}</span>
        </div>
        <div className="flex justify-between">
          <span className={theme.muted}>VENUE B</span>
          <span className="font-mono">{venueB}</span>
        </div>
        <div className="flex justify-between">
          <span className={theme.muted}>FLASH</span>
          <span className="font-mono">{venueC}</span>
        </div>
        <div className="flex justify-between">
          <span className={theme.muted}>SIZE</span>
          <span>{sizeLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className={theme.muted}>GROSS</span>
          <span>{grossLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className={theme.muted}>GAS</span>
          <span>{gasLabel}</span>
        </div>
        <div className={`flex justify-between ${netNegative ? theme.warn : theme.primary}`}>
          <span className={theme.muted}>NET</span>
          <span className="font-bold">{netLabel}</span>
        </div>
      </div>
      <div className={`mt-2 ${theme.muted} text-[9px]`}>
        display only · inclusion not guaranteed
      </div>
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}
