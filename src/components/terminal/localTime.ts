/**
 * @file localTime.ts
 * @description Browser-local clock formatting shared by header + news (#90)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/**
 * Format a Date/ms in the **browser local** timezone (same rules as the header
 * clock). Uses `toLocaleTimeString` so DST offsets match the OS timezone.
 */
export const formatLocalHms = (ms: number | Date): string => {
  const d = ms instanceof Date ? ms : new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

/** HH:MM in browser local timezone (news TIME column). */
export const formatLocalHm = (ms: number | Date): string => {
  const d = ms instanceof Date ? ms : new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
};
