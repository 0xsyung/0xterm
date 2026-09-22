/**
 * @file VerifyWidget.tsx
 * @description Source-verification status widget for the `verify` command (#105)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type VerifyWidgetData = {
  kind: "verify";
  /** submitting | pending | verified | failed */
  state: "submitting" | "pending" | "verified" | "failed";
  name: string;
  address: string;
  chainName: string;
  explorerUrl?: string;
  message?: string;
};

export default function VerifyWidget({
  data,
  theme
}: {
  data: VerifyWidgetData;
  theme: any;
}) {
  const shell = `my-3 p-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-[10px] space-y-1 w-full`;
  const header = `flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`;

  const stateLabel =
    data.state === "submitting"
      ? "SUBMITTING"
      : data.state === "pending"
        ? "PENDING"
        : data.state === "verified"
          ? "VERIFIED"
          : "FAILED";
  const stateColor =
    data.state === "verified" ? theme.primary : data.state === "failed" ? theme.warn : theme.text;

  return (
    <div className={shell}>
      <div className={header}>
        <span className="font-bold truncate">ETHERSCAN SOURCE VERIFY</span>
        <span className="uppercase shrink-0">{data.chainName}</span>
      </div>
      <div className={`flex justify-between items-center ${theme.text}`}>
        <span className="truncate">{data.name}</span>
        <span className={`font-bold shrink-0 ${stateColor}`}>{stateLabel}</span>
      </div>
      <div className={`text-[9px] ${theme.text}/40 break-all tabular-nums`}>
        {data.address}
      </div>
      {data.state === "verified" && data.explorerUrl && (
        <a
          href={`${data.explorerUrl}/address/${data.address}#code`}
          target="_blank"
          rel="noreferrer"
          className={`text-[9px] ${theme.primary} underline break-all inline-block`}
        >
          VIEW CONTRACT SOURCE →
        </a>
      )}
      {data.state === "failed" && data.message && (
        <div className={`text-[9px] ${theme.warn} break-all`}>{data.message}</div>
      )}
    </div>
  );
}
