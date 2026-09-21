/**
 * @file HostRedirect.tsx
 * @description Silent client redirect / surface gate for #78 two-repo host split
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  resolveHostRedirect,
  shouldBootTerminalAtRoot,
  shouldRenderTerminalAtAppPath,
  shouldShowLanding
} from "@/lib/hostRouting";

type RootSurface = "pending" | "landing" | "terminal" | "redirecting";
type AppSurface = "pending" | "terminal" | "redirecting" | "blank";

/** Black hold while we decide host surface — avoids landing flash on app host. */
function Hold() {
  return <div className="w-full min-h-screen h-full bg-black" aria-hidden />;
}

/**
 * Root (`/`) gate:
 * - app host → terminal
 * - local → landing (dev dual-surface)
 * - apex → defensive redirect to app (production apex is 0xterm-dot-xyz)
 */
export function RootHostGate({
  landing,
  terminal
}: {
  landing: ReactNode;
  terminal: ReactNode;
}) {
  const [surface, setSurface] = useState<RootSurface>("pending");

  useEffect(() => {
    const { hostname, pathname, search } = window.location;
    const redirect = resolveHostRedirect({ hostname, pathname, search });
    if (redirect) {
      setSurface("redirecting");
      window.location.replace(redirect.href);
      return;
    }
    if (shouldBootTerminalAtRoot(hostname)) {
      setSurface("terminal");
      return;
    }
    if (shouldShowLanding(hostname)) {
      setSurface("landing");
      return;
    }
    // Unexpected production host without redirect — blank hold
    setSurface("redirecting");
  }, []);

  if (surface === "pending" || surface === "redirecting") return <Hold />;
  if (surface === "terminal") return <>{terminal}</>;
  return <>{landing}</>;
}

/**
 * `/app` gate:
 * - app host → silent strip `/app` → `/`
 * - local → terminal (dev dual-surface)
 * - apex → defensive bounce to app (production apex `/app` is landing-repo static)
 */
export function AppPathHostGate({ terminal }: { terminal: ReactNode }) {
  const [surface, setSurface] = useState<AppSurface>("pending");

  useEffect(() => {
    const { hostname, pathname, search } = window.location;
    const redirect = resolveHostRedirect({ hostname, pathname, search });
    if (redirect) {
      setSurface("redirecting");
      window.location.replace(redirect.href);
      return;
    }
    if (shouldRenderTerminalAtAppPath(hostname)) {
      setSurface("terminal");
      return;
    }
    // Unexpected: production host without redirect — blank hold
    setSurface("blank");
  }, []);

  if (surface === "terminal") return <>{terminal}</>;
  return <Hold />;
}
