/**
 * @file PinButton.tsx
 * @description Shared pin-to-right-panel button (price-widget style)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
export default function PinButton({
  onPin,
  theme,
  className = ""
}: {
  onPin?: () => void;
  theme: any;
  className?: string;
}) {
  if (!onPin) return null;
  return (
    <button
      type="button"
      onClick={onPin}
      title="Pin to right panel"
      className={`uppercase text-[9px] px-1 py-0.5 border ${theme.border} ${theme.cardBg} ${theme.primary} cursor-pointer ${className}`}
    >
      ▣
    </button>
  );
}
