/**
 * @file hostRouting.ts
 * @description Host-aware routing for the two-repo split (#78).
 *
 * Production (two Pages sites):
 * - `0xsyung/0xterm` → `app.0xterm.xyz` — terminal at `/` (this artifact)
 * - `0xsyung/0xterm-dot-xyz` → `0xterm.xyz` — landing (+ optional static `/app/` redirect)
 *
 * This repo does **not** serve production apex marketing. Localhost keeps
 * dual-surface (landing + `/app`) for dev ergonomics.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/**
 * Apex hostnames. Production marketing lives on `0xterm-dot-xyz`, not this
 * artifact. Kept so a mis-pointed DNS still classifies and bounces to app.
 */
export const APEX_HOSTS = new Set(["0xterm.xyz", "www.0xterm.xyz"]);

/** Production terminal host (this repo's Pages custom domain). */
export const APP_HOST = "app.0xterm.xyz";

/** Canonical origin for the terminal subdomain. */
export const APP_ORIGIN = "https://app.0xterm.xyz";

export type HostKind = "apex" | "app" | "local";

/** Lowercase, strip trailing DNS dot and `:port` (defensive). */
export function normalizeHostname(hostname: string): string {
  let h = (hostname || "").trim().toLowerCase();
  // Strip brackets from IPv6 literals before port split.
  if (h.startsWith("[") && h.includes("]")) {
    const end = h.indexOf("]");
    const hostPart = h.slice(1, end);
    const rest = h.slice(end + 1);
    h = rest.startsWith(":") ? hostPart : hostPart + rest;
  } else {
    // hostname:port (IPv4 / DNS) — window.location.hostname omits port, but
    // callers sometimes pass host headers.
    const colon = h.lastIndexOf(":");
    if (colon > -1 && /^\d+$/.test(h.slice(colon + 1))) {
      h = h.slice(0, colon);
    }
  }
  return h.replace(/\.$/, "");
}

function isApexHost(h: string): boolean {
  return APEX_HOSTS.has(h);
}

/** Exact app host, www.app, or any subdomain of the app host. */
function isAppHostName(h: string): boolean {
  if (!h) return false;
  if (h === APP_HOST) return true;
  if (h === `www.${APP_HOST}`) return true;
  if (h.endsWith(`.${APP_HOST}`)) return true;
  return false;
}

/**
 * Explicit local / preview hosts that keep the dual-surface (landing + `/app`).
 * Everything else on this Pages artifact defaults to terminal-at-root.
 */
export function isLocalDevHost(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") {
    return true;
  }
  if (h.endsWith(".localhost") || h.endsWith(".local")) return true;
  // Common tunnel / preview hosts used for local QA
  if (
    h.endsWith(".trycloudflare.com") ||
    h.endsWith(".loca.lt") ||
    h.endsWith(".bore.pub") ||
    h === "bore.pub" ||
    h.endsWith(".ngrok-free.app") ||
    h.endsWith(".ngrok.io")
  ) {
    return true;
  }
  // Private IPv4 (dev servers bound to LAN)
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/**
 * This package's production artifact is the app subdomain. When
 * NEXT_PUBLIC_SITE_URL points at the app origin (or is unset → APP_ORIGIN),
 * unknown non-apex hosts must boot terminal — never marketing.
 */
export function isAppPagesArtifact(): boolean {
  try {
    const raw =
      (typeof process !== "undefined" &&
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
      APP_ORIGIN;
    const host = normalizeHostname(new URL(raw).hostname);
    return isAppHostName(host) || host === "" || raw === APP_ORIGIN;
  } catch {
    return true;
  }
}

/** Classify a hostname into apex / app / local (dev dual-surface). */
export function classifyHost(hostname: string): HostKind {
  const h = normalizeHostname(hostname);
  if (isApexHost(h)) return "apex";
  if (isAppHostName(h)) return "app";
  if (isLocalDevHost(h)) return "local";
  // Empty / CDN / github.io / unknown on the app artifact → terminal.
  if (isAppPagesArtifact()) return "app";
  return "local";
}

/**
 * If pathname is under `/app`, return the path after the prefix
 * (`/` for bare `/app`). Otherwise null.
 * Handles optional trailing slash (Pages `trailingSlash: true`).
 */
export function stripAppPrefix(pathname: string): string | null {
  let p = pathname || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p === "/app" || p === "/app/") return "/";
  if (p.startsWith("/app/")) {
    const rest = p.slice("/app".length); // begins with /
    return rest.length > 0 ? rest : "/";
  }
  return null;
}

export type RedirectDecision = {
  /** Absolute or same-origin URL to pass to location.replace */
  href: string;
};

function normalizePath(rest: string): string {
  return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
}

/**
 * Silent redirect target for host/path pairs, or null when the current
 * URL should render as-is.
 *
 * Production story for **this** artifact (app host):
 * - app `/app/...` → `/...` on the same host (preserve query) — bookmark strip
 *
 * Defensive only (apex is owned by `0xterm-dot-xyz` in production):
 * - apex any path → `https://app.0xterm.xyz/...` (strip `/app` when present)
 *
 * - local: never redirects (landing + `/app` dual surface)
 */
export function resolveHostRedirect(opts: {
  hostname: string;
  pathname: string;
  search?: string;
}): RedirectDecision | null {
  const kind = classifyHost(opts.hostname);
  if (kind === "local") return null;

  const search = opts.search ?? "";
  const stripped = stripAppPrefix(opts.pathname);

  if (kind === "app") {
    // Primary production redirect for this Pages site: silent /app → /
    if (stripped === null) return null;
    const path = normalizePath(stripped);
    return { href: `${path}${search}` };
  }

  // apex — defensive bounce to app host. Production `/app` redirect on apex
  // belongs on the landing repo (`0xterm-dot-xyz` static `/app/`).
  const raw = stripped ?? (opts.pathname || "/");
  const path = normalizePath(raw.startsWith("/") ? raw : `/${raw}`);
  return { href: `${APP_ORIGIN}${path === "/" ? "/" : path}${search}` };
}

/** On app host (and app-artifact unknowns), root boots the terminal. */
export function shouldBootTerminalAtRoot(hostname: string): boolean {
  return classifyHost(hostname) === "app";
}

/**
 * Marketing landing is **localhost/dev only** on this artifact.
 * Production apex marketing ships from `0xterm-dot-xyz`.
 */
export function shouldShowLanding(hostname: string): boolean {
  return classifyHost(hostname) === "local";
}

/**
 * `/app` still serves the terminal only on local/dev hosts.
 * App host strips via `resolveHostRedirect`; apex bounces to app (defensive).
 */
export function shouldRenderTerminalAtAppPath(hostname: string): boolean {
  return classifyHost(hostname) === "local";
}

/**
 * Landing CTA target (dev dual-surface): local → `/app`; app → `/`;
 * apex (defensive) → app subdomain.
 */
export function terminalLaunchHref(hostname: string): string {
  const kind = classifyHost(hostname);
  if (kind === "apex") return `${APP_ORIGIN}/`;
  if (kind === "app") return "/";
  return "/app";
}

/**
 * Default site URL for metadataBase when env is unset.
 * This repo's Pages host is the app subdomain.
 */
export function defaultSiteUrl(): string {
  return (
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
    APP_ORIGIN
  );
}
