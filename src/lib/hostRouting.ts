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

/** Classify a hostname into apex / app / local (dev dual-surface). */
export function classifyHost(hostname: string): HostKind {
  const h = (hostname || "").toLowerCase().replace(/\.$/, "");
  if (h === APP_HOST) return "app";
  if (APEX_HOSTS.has(h)) return "apex";
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

/** On `app.0xterm.xyz`, root boots the terminal (no landing). */
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
