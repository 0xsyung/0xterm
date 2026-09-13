/**
 * @file DigArtifactWidget.tsx
 * @description Dig compile artifact card — pinnable dig-artifact (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "../types";
import type { DigContractArtifact } from "../dig/artifact";
import {
  abiFunctionCount,
  bytecodeByteLength
} from "../dig/artifact";
import PinButton from "./PinButton";

export default function DigArtifactWidget({
  artifact,
  theme,
  onPin,
  pinned,
  compact
}: {
  artifact: DigContractArtifact;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
  compact?: boolean;
}) {
  const nB = bytecodeByteLength(
    artifact.runtimeBytecode || artifact.creationBytecode
  );
  const nFn = abiFunctionCount(artifact.abi || []);

  if (compact) {
    return (
      <div className={`text-[10px] font-bold ${theme.primary} tabular-nums`}>
        {artifact.name} · {nB}B · {nFn} fn
      </div>
    );
  }

  return (
    <div
      className={`relative group my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md ${theme.text}`}
    >
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary}`}
      >
        ARTIFACT
      </div>
      <div className="space-y-1 text-[10px] tabular-nums">
        <div>
          <span className={theme.muted}>name </span>
          <span className={`font-bold ${theme.text}`}>{artifact.name}</span>
        </div>
        <div>
          <span className={theme.muted}>solc </span>
          <span>{artifact.solcVersion}</span>
        </div>
        <div>
          <span className={theme.muted}>bytecode </span>
          <span>{nB}B</span>
        </div>
        <div>
          <span className={theme.muted}>fns </span>
          <span>{nFn}</span>
        </div>
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
