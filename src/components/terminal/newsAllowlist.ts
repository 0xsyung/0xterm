/**
 * @file newsAllowlist.ts
 * @description Frozen RSS allowlist for news (#14). CryptoPanic out of v1.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

export type NewsSourceId =
  | "cointelegraph"
  | "decrypt"
  | "coindesk"
  | "defiant";

export type NewsAllowItem = {
  id: NewsSourceId;
  name: string;
  rssUrl: string;
};

/**
 * Publisher-origin RSS only. Optional later: `news set cryptopanic <token>`
 * is out of v1 (paid) — leave this comment, not a command.
 */
export const NEWS_ALLOWLIST: readonly NewsAllowItem[] = [
  {
    id: "cointelegraph",
    name: "Cointelegraph",
    rssUrl: "https://cointelegraph.com/rss"
  },
  {
    id: "decrypt",
    name: "Decrypt",
    rssUrl: "https://decrypt.co/feed"
  },
  {
    id: "coindesk",
    name: "CoinDesk",
    // Frozen 2026-09-13: HTTP 200 application/xml (no trailing slash needed)
    rssUrl: "https://www.coindesk.com/arc/outboundfeeds/rss"
  },
  {
    id: "defiant",
    name: "The Defiant",
    // Frozen 2026-09-13: /feed → 301 → /api/feed (final)
    rssUrl: "https://thedefiant.io/api/feed"
  }
] as const;

export const NEWS_ALLOWLIST_BY_URL: ReadonlyMap<string, NewsAllowItem> = new Map(
  NEWS_ALLOWLIST.map((a) => [a.rssUrl, a])
);

export const NEWS_ALLOWLIST_BY_ID: ReadonlyMap<NewsSourceId, NewsAllowItem> =
  new Map(NEWS_ALLOWLIST.map((a) => [a.id, a]));

export const NEWS_FOOTER_BASE =
  "Headlines: Cointelegraph · Decrypt · CoinDesk · The Defiant. Titles only. Not investment advice.";

export const NEWS_FOOTER_RSS2JSON =
  " via rss2json (allowlisted feeds only).";

export const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json";
