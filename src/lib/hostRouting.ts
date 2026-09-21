/**
 * @file hostRouting.ts
 * @description Host-aware routing helpers for apex vs app.0xterm.xyz (#78)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

/** Production apex hosts that serve marketing only. */
export const APEX_HOSTS = new Set(["0xterm.xyz", "www.0xterm.xyz"]);

/** Production terminal host. */
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
  // Normalize repeated slashes except leave as-is for matching
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

/**
 * Silent redirect target for host/path pairs, or null when the current
 * URL should render as-is.
 *
 * - apex `/app/...` → `https://app.0xterm.xyz/...` (preserve query)
 * - app  `/app/...` → `/...` on the same host (preserve query)
 * - local: never redirects (landing + `/app` dual surface)
 */
export function resolveHostRedirect(opts: {
  hostname: string;
  pathname: string;
  search?: string;
}): RedirectDecision | null {
  const kind = classifyHost(opts.hostname);
  if (kind === "local") return null;

  const rest = stripAppPrefix(opts.pathname);
  if (rest === null) return null;

  const search = opts.search ?? "";
  // Spec examples omit forcing trailing slash on the destination.
  const path = rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";

  if (kind === "apex") {
    return { href: `${APP_ORIGIN}${path === "/" ? "/" : path}${search}` };
  }

  // app host: strip /app → same-origin path
  return { href: `${path}${search}` };
}

/** On `app.0xterm.xyz`, root boots the terminal (no landing). */
export function shouldBootTerminalAtRoot(hostname: string): boolean {
  return classifyHost(hostname) === "app";
}

/**
 * `/app` still serves the terminal only on local/dev hosts.
 * Production hosts redirect away via `resolveHostRedirect`.
 */
export function shouldRenderTerminalAtAppPath(hostname: string): boolean {
  return classifyHost(hostname) === "local";
}

/**
 * Landing CTA target: production apex → app subdomain; local → `/app`;
 * app host → `/`.
 */
export function terminalLaunchHref(hostname: string): string {
  const kind = classifyHost(hostname);
  if (kind === "apex") return `${APP_ORIGIN}/`;
  if (kind === "app") return "/";
  return "/app";
}

/** Default site URL for metadataBase when env is unset. */
export function defaultSiteUrl(): string {
  return (
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
    "https://0xterm.xyz"
  );
}
