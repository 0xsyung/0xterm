/**
 * @file analytics.ts
 * @description Google Analytics (GA4) event helper
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Fire a GA4 event. No-op on the server and when gtag isn't loaded (e.g. dev).
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", eventName, params);
}
