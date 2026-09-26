/**
 * @file news.ts
 * @description Allowlisted RSS headlines: sanitize, parse, fetch, filter, pin (#14)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All Rights Reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import {
  NEWS_ALLOWLIST,
  NEWS_ALLOWLIST_BY_ID,
  NEWS_ALLOWLIST_BY_URL,
  NEWS_FOOTER_BASE,
  NEWS_FOOTER_RSS2JSON,
  RSS2JSON_ENDPOINT,
  type NewsAllowItem,
  type NewsCategory,
  type NewsSourceId
} from "./newsAllowlist";
import { formatLocalHm, formatLocalHms } from "./localTime";

export {
  NEWS_ALLOWLIST,
  NEWS_FOOTER_BASE,
  NEWS_FOOTER_RSS2JSON,
  type NewsAllowItem,
  type NewsCategory,
  type NewsSourceId
} from "./newsAllowlist";

export const NEWS_PAGE_SIZE = 20;
export const NEWS_MEMORY_CAP = 100;
export const NEWS_RATE_MS = 30_000;
export const NEWS_REFRESH_SEC = 60;
export const NEWS_TITLE_CAP = 180;

export type NewsItem = {
  id: string;
  sourceId: NewsSourceId;
  title: string;
  url: string;
  publishedAt: number | null;
};

export type NewsPrefs = {
  lastTag?: string;
};

export type NewsSession = {
  fetchedAt: number;
  items: NewsItem[];
  tag: string;
  page: number;
  usedRss2json: boolean;
  missing: NewsSourceId[];
};

export type NewsFetchResult = {
  items: NewsItem[];
  usedRss2json: boolean;
  missing: NewsSourceId[];
  error?: "NEWS_TRANSPORT" | "NEWS_EMPTY";
};

export const NEWS_ERROR = {
  NEWS_EMPTY: "No headlines right now.",
  NEWS_TRANSPORT: "Could not fetch news (CORS or source down).",
  NEWS_NO_PAGE: "No news page. Run 'news' first."
} as const;

export type NewsCommand =
  | { op: "show"; tag: string }
  | { op: "more" }
  | { op: "pin" };

/** Stable pin identity: news:${tag||"all"} */
export const newsPinKey = (tag?: string | null): string => {
  const t = (tag || "").trim().toLowerCase();
  return `news:${t || "all"}`;
};

export const parseNewsCommand = (args: string[]): NewsCommand => {
  // args[0] is "news"
  const sub = (args[1] || "").trim();
  if (!sub) return { op: "show", tag: "" };
  const lower = sub.toLowerCase();
  if (lower === "more") return { op: "more" };
  if (lower === "pin") return { op: "pin" };
  // Unknown extras after a tag: ignore; filter on args[1]
  return { op: "show", tag: sub };
};

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

/** Strip tags, decode entities, collapse whitespace, cap 180. */
export const sanitizeHeadline = (raw: string): string => {
  let s = String(raw ?? "");
  // strip tags
  s = s.replace(/<[^>]*>/g, "");
  // numeric entities
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
  // named entities (common)
  s = s.replace(/&([a-zA-Z]+);/g, (m, name) => ENTITY_MAP[name.toLowerCase()] ?? m);
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > NEWS_TITLE_CAP) s = s.slice(0, NEWS_TITLE_CAP);
  return s;
};

export const isAllowedNewsUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // exact match against frozen allowlist (no trailing-slash variants invent)
    const normalized = u.href.replace(/\/$/, "");
    for (const a of NEWS_ALLOWLIST) {
      if (a.rssUrl === url || a.rssUrl.replace(/\/$/, "") === normalized) {
        return true;
      }
    }
    return NEWS_ALLOWLIST_BY_URL.has(url);
  } catch {
    return false;
  }
};

/** https-only article links; reject javascript:/data:/http: */
export const isSafeArticleUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    if (/^(127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
};

export const filterByTag = (items: NewsItem[], tag: string): NewsItem[] => {
  const t = tag.trim().toLowerCase();
  if (!t) return items;
  return items.filter((it) => {
    const src = NEWS_ALLOWLIST.find((a) => a.id === it.sourceId);
    const hay = `${it.title} ${src?.name || ""} ${it.sourceId}`.toLowerCase();
    return hay.includes(t);
  });
};

export const normalizeArticleUrl = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = "";
    // drop trailing slash for dedup (except root)
    let href = u.href;
    if (href.endsWith("/") && u.pathname !== "/") href = href.slice(0, -1);
    return href;
  } catch {
    return url;
  }
};

export const dedupByUrl = (items: NewsItem[]): NewsItem[] => {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = normalizeArticleUrl(it.url).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
};

/** Simple stable id from source + link (no crypto dependency). */
export const newsItemId = (sourceId: string, url: string): string => {
  const s = `${sourceId}|${normalizeArticleUrl(url).toLowerCase()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `n_${(h >>> 0).toString(36)}`;
};

const textContentOf = (el: Element | null): string => {
  if (!el) return "";
  return el.textContent || "";
};

const firstChild = (parent: Element, local: string): Element | null => {
  for (const c of Array.from(parent.children)) {
    if (c.localName === local || c.tagName.toLowerCase() === local) return c;
  }
  // also try getElementsByTagName for namespaced feeds
  const list = parent.getElementsByTagName(local);
  return list[0] || null;
};


/**
 * Parse RSS / rss2json pubDates to epoch ms.
 * rss2json strips TZ and emits `YYYY-MM-DD HH:mm:ss` in UTC wall time; naive
 * `Date.parse` treats that as **local**, skewing TIME by the DST offset vs the
 * header clock (~1h in Europe). Timezone-less strings are forced to UTC.
 */
export const parseNewsDate = (raw: string | null | undefined): number | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // Explicit TZ: Z, ±HH:MM / ±HHMM, or GMT/UTC/UT token (RFC 822).
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s) || /\b(?:GMT|UTC|UT)\b/i.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  // ISO-like or rss2json "YYYY-MM-DD HH:mm:ss" without TZ → UTC.
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const withZ = /[zZ]$/.test(normalized) ? normalized : `${normalized}Z`;
  const t = Date.parse(withZ);
  return Number.isFinite(t) ? t : null;
};

/**
 * Parse RSS XML with DOMParser. Ignores description/content HTML.
 * Returns items for a known allowlist source.
 */
export const parseRss = (
  xml: string,
  sourceId: NewsSourceId
): NewsItem[] => {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  const nodes = Array.from(doc.querySelectorAll("item, entry"));
  const out: NewsItem[] = [];
  for (const node of nodes) {
    const titleRaw =
      textContentOf(firstChild(node, "title")) ||
      textContentOf(node.querySelector("title"));
    const title = sanitizeHeadline(titleRaw);
    if (!title) continue;

    let link = "";
    const linkEl = firstChild(node, "link") || node.querySelector("link");
    if (linkEl) {
      link =
        linkEl.getAttribute("href") ||
        textContentOf(linkEl) ||
        "";
    }
    if (!link) {
      const guid = firstChild(node, "guid") || node.querySelector("guid");
      link = textContentOf(guid);
    }
    link = link.trim();
    if (!isSafeArticleUrl(link)) continue;

    let publishedAt: number | null = null;
    const dateRaw =
      textContentOf(firstChild(node, "pubDate")) ||
      textContentOf(firstChild(node, "published")) ||
      textContentOf(firstChild(node, "updated")) ||
      textContentOf(node.querySelector("pubDate, published, updated"));
    if (dateRaw) {
      publishedAt = parseNewsDate(dateRaw);
    }

    out.push({
      id: newsItemId(sourceId, link),
      sourceId,
      title,
      url: link,
      publishedAt
    });
  }
  return out;
};

/**
 * Parse rss2json JSON. Take only title/link/pubDate/author — ignore description/content.
 */
export const parseRss2Json = (
  json: unknown,
  sourceId: NewsSourceId
): NewsItem[] => {
  if (!json || typeof json !== "object") return [];
  const root = json as { status?: string; items?: unknown[] };
  if (root.status && root.status !== "ok") return [];
  const items = Array.isArray(root.items) ? root.items : [];
  const out: NewsItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as {
      title?: unknown;
      link?: unknown;
      pubDate?: unknown;
    };
    const title = sanitizeHeadline(String(it.title ?? ""));
    if (!title) continue;
    const link = String(it.link ?? "").trim();
    if (!isSafeArticleUrl(link)) continue;
    let publishedAt: number | null = null;
    if (it.pubDate) {
      publishedAt = parseNewsDate(String(it.pubDate));
    }
    out.push({
      id: newsItemId(sourceId, link),
      sourceId,
      title,
      url: link,
      publishedAt
    });
  }
  return out;
};

export const buildNewsFooter = (
  usedRss2json: boolean,
  missing: NewsSourceId[] = []
): string => {
  let s = NEWS_FOOTER_BASE;
  if (usedRss2json) s += NEWS_FOOTER_RSS2JSON;
  if (missing.length) {
    s += ` missing: ${missing.join(", ")}`;
  }
  return s;
};

export const pageNewsItems = (
  items: NewsItem[],
  page: number,
  pageSize = NEWS_PAGE_SIZE
): NewsItem[] => {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
};

/** Row TIME — browser local TZ (same source as header clock / formatNewsAsOf). */
export const formatNewsTime = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms)) return "—";
  try {
    return formatLocalHm(ms);
  } catch {
    return "—";
  }
};

/** Widget "as of" — browser local TZ (aligned with header clock). */
export const formatNewsAsOf = (ms: number): string => {
  return formatLocalHms(ms);
};

export const sourceLabel = (id: NewsSourceId): string => id.toUpperCase();

/** Editorial taxonomy pills for NewsReader (#83). */
export const NEWS_READER_CATEGORIES = [
  "All",
  "News",
  "Insights",
  "Reports"
] as const;

export type NewsReaderCategoryFilter = (typeof NEWS_READER_CATEGORIES)[number];

/** Fallback source→category when allowlist omits `category`. */
const CATEGORY_FALLBACK: Record<NewsSourceId, NewsCategory> = {
  cointelegraph: "News",
  coindesk: "News",
  decrypt: "Insights",
  defiant: "Reports"
};

const THUMB_MONOGRAM: Record<NewsSourceId, string> = {
  cointelegraph: "CT",
  decrypt: "DC",
  coindesk: "CD",
  defiant: "DF"
};

/** Fixed hue offsets (degrees) per source — stable across themes. */
const THUMB_HUE_OFFSET: Record<NewsSourceId, number> = {
  cointelegraph: 0,
  decrypt: 48,
  coindesk: 200,
  defiant: 280
};

export const categoryOf = (sourceId: NewsSourceId | string): NewsCategory => {
  const id = sourceId as NewsSourceId;
  const fromList = NEWS_ALLOWLIST_BY_ID.get(id)?.category;
  if (fromList) return fromList;
  return CATEGORY_FALLBACK[id] ?? "News";
};

/**
 * Title-only read-time estimate (minutes). Deterministic; clamped 1–5.
 * `max(1, min(5, round(title.length / 90)))`
 */
export const estimateReadTime = (item: { title: string }): number => {
  const len = String(item?.title ?? "").length;
  return Math.max(1, Math.min(5, Math.round(len / 90)));
};

/**
 * Editorial date for NewsReader — browser-local, e.g. `Sep 14, 2026 · 9:35 AM`.
 * Null / invalid → `—`. Does not change widget TIME helpers.
 */
export const formatNewsEditorialDate = (
  publishedAt: number | null
): string => {
  if (publishedAt === null || !Number.isFinite(publishedAt)) return "—";
  try {
    const d = new Date(publishedAt);
    const datePart = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const timePart = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return "—";
  }
};

const parseHexRgb = (hex: string): [number, number, number] | null => {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].every(Number.isFinite)) return [r, g, b];
    return null;
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return [r, g, b];
};

const rgbToHsl = (
  r: number,
  g: number,
  b: number
): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
};

const hslToRgb = (
  h: number,
  s: number,
  l: number
): [number, number, number] => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255)
  ];
};

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
    .join("")}`;

export type NewsThumbStyle = {
  monogram: string;
  /** Solid fill color (hex). */
  fill: string;
  /** Diagonal depth overlay. */
  gradient: string;
  /** CSS background combining fill + gradient. */
  background: string;
  /** Inline color for monogram (contrasts light/dark skins). */
  monogramColor: string;
};

/**
 * Deterministic placeholder thumb styles — no remote images (#83).
 * Fill = theme.phosphor hue-shifted per source; monogram CT/DC/CD/DF.
 */
export const newsThumbStyle = (
  sourceId: NewsSourceId | string,
  theme: { phosphor: string; name?: string }
): NewsThumbStyle => {
  const id = (sourceId in THUMB_MONOGRAM
    ? sourceId
    : "cointelegraph") as NewsSourceId;
  const monogram = THUMB_MONOGRAM[id];
  const offset = THUMB_HUE_OFFSET[id] ?? 0;
  const rgb = parseHexRgb(theme.phosphor) || [0, 255, 102];
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  // Keep readable on light (teletype) skins via deeper luminance floor.
  const lightSkin = /teletype/i.test(theme.name || "");
  const fillL = lightSkin
    ? Math.min(42, Math.max(28, l))
    : Math.min(28, Math.max(12, l * 0.45));
  const [fr, fg, fb] = hslToRgb(h + offset, Math.max(40, s), fillL);
  const fill = toHex(fr, fg, fb);
  const gradient = lightSkin
    ? `linear-gradient(135deg, transparent 0%, ${fill}33 45%, #00000014 100%)`
    : `linear-gradient(135deg, transparent 0%, ${theme.phosphor}26 40%, #00000099 100%)`;
  const background = `${gradient}, ${fill}`;
  const monogramColor = lightSkin ? "#0a0a0a" : "#ffffff";
  return { monogram, fill, gradient, background, monogramColor };
};

export const filterByCategory = (
  items: NewsItem[],
  category: NewsReaderCategoryFilter
): NewsItem[] => {
  if (category === "All") return items;
  return items.filter((it) => categoryOf(it.sourceId) === category);
};


// —— rate-limited fetch cache (in-memory, per allowlist URL) ——
type CacheEntry = {
  at: number;
  items: NewsItem[];
  usedRss2json: boolean;
  ok: boolean;
};

const feedCache = new Map<string, CacheEntry>();

/** Test hook: clear rate cache. */
export const _resetNewsCache = (): void => {
  feedCache.clear();
};

const isCorsTypeError = (e: unknown): boolean => {
  if (e instanceof TypeError) return true;
  const msg = String((e as any)?.message || e || "");
  return /Failed to fetch|NetworkError|CORS|Load failed/i.test(msg);
};

async function fetchDirectRss(
  url: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const res = await fetchImpl(url, {
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchViaRss2json(
  allowlistedUrl: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  // Locked: only allowlisted URLs reach this hop (SSRF guard).
  if (!isAllowedNewsUrl(allowlistedUrl)) {
    throw new Error("NEWS_BAD_URL");
  }
  const withCount = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(allowlistedUrl)}&count=20`;
  let res = await fetchImpl(withCount, { mode: "cors", credentials: "omit" });
  let json: any = await res.json().catch(() => null);
  // Free tier may reject `count` without a key — retry without count (still our URL).
  if (
    json &&
    json.status === "error" &&
    /api key|count/i.test(String(json.message || ""))
  ) {
    const bare = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(allowlistedUrl)}`;
    res = await fetchImpl(bare, { mode: "cors", credentials: "omit" });
    json = await res.json().catch(() => null);
  }
  if (!json || json.status !== "ok") {
    throw new Error(String(json?.message || "rss2json failed"));
  }
  return json;
}

async function fetchOneFeed(
  item: NewsAllowItem,
  fetchImpl: typeof fetch,
  force: boolean
): Promise<{ items: NewsItem[]; usedRss2json: boolean; ok: boolean }> {
  const cached = feedCache.get(item.rssUrl);
  if (!force && cached && Date.now() - cached.at < NEWS_RATE_MS) {
    return {
      items: cached.items,
      usedRss2json: cached.usedRss2json,
      ok: cached.ok
    };
  }

  let usedRss2json = false;
  let items: NewsItem[] = [];
  let ok = false;

  try {
    const xml = await fetchDirectRss(item.rssUrl, fetchImpl);
    items = parseRss(xml, item.id);
    ok = true;
  } catch (e) {
    // Locked: rss2json hop only on TypeError / CORS fail for allowlisted URLs.
    if (isCorsTypeError(e)) {
      try {
        const json = await fetchViaRss2json(item.rssUrl, fetchImpl);
        items = parseRss2Json(json, item.id);
        usedRss2json = true;
        ok = true;
      } catch {
        ok = false;
        items = [];
        usedRss2json = false;
      }
    } else {
      ok = false;
      items = [];
    }
  }

  feedCache.set(item.rssUrl, {
    at: Date.now(),
    items,
    usedRss2json,
    ok
  });
  return { items, usedRss2json, ok };
}

/**
 * Fetch all allowlisted feeds, merge, sort by publishedAt desc, dedup.
 * Rate ≤1/30s per URL (NEWS_RATE). Pin refresh shares this cache.
 */
export const fetchNewsHeadlines = async (
  fetchImpl: typeof fetch = fetch,
  opts?: { force?: boolean }
): Promise<NewsFetchResult> => {
  const force = !!opts?.force;
  const results = await Promise.all(
    NEWS_ALLOWLIST.map((a) => fetchOneFeed(a, fetchImpl, force))
  );

  let usedRss2json = false;
  const missing: NewsSourceId[] = [];
  const merged: NewsItem[] = [];

  NEWS_ALLOWLIST.forEach((a, i) => {
    const r = results[i];
    if (r.usedRss2json) usedRss2json = true;
    if (!r.ok) missing.push(a.id);
    else merged.push(...r.items);
  });

  if (missing.length === NEWS_ALLOWLIST.length) {
    return {
      items: [],
      usedRss2json,
      missing,
      error: "NEWS_TRANSPORT"
    };
  }

  const deduped = dedupByUrl(merged).sort((a, b) => {
    const ta = a.publishedAt ?? 0;
    const tb = b.publishedAt ?? 0;
    return tb - ta;
  });

  const capped = deduped.slice(0, NEWS_MEMORY_CAP);

  if (capped.length === 0) {
    return { items: [], usedRss2json, missing, error: "NEWS_EMPTY" };
  }

  return { items: capped, usedRss2json, missing };
};

/**
 * Open article via a real <a target=_blank> click (user-gesture safe).
 * Does **not** call window.open — popup blockers treat bare open as suspect
 * once the keydown gesture unwinds (#89).
 * @returns false when URL is unsafe or DOM click could not run.
 */
export const openNewsArticle = (url: string): boolean => {
  if (!isSafeArticleUrl(url)) return false;
  if (typeof document === "undefined") return false;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
};
