/**
 * @file hostRouting.test.ts
 * @description Unit tests for host / redirect helpers — two-repo model (#78)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  APP_HOST,
  APP_ORIGIN,
  classifyHost,
  isLocalDevHost,
  normalizeHostname,
  resolveHostRedirect,
  shouldBootTerminalAtRoot,
  shouldRenderTerminalAtAppPath,
  shouldShowLanding,
  stripAppPrefix,
  terminalLaunchHref,
  defaultSiteUrl
} from "./hostRouting";

describe("normalizeHostname", () => {
  it("lowercases, strips trailing dot and port", () => {
    expect(normalizeHostname("APP.0xterm.xyz.")).toBe("app.0xterm.xyz");
    expect(normalizeHostname("app.0xterm.xyz:443")).toBe("app.0xterm.xyz");
    expect(normalizeHostname("  App.0xterm.xyz ")).toBe("app.0xterm.xyz");
  });
});

describe("classifyHost", () => {
  it("classifies apex and www", () => {
    expect(classifyHost("0xterm.xyz")).toBe("apex");
    expect(classifyHost("www.0xterm.xyz")).toBe("apex");
    expect(classifyHost("0xterm.xyz.")).toBe("apex");
  });

  it("classifies app subdomain variants", () => {
    expect(classifyHost(APP_HOST)).toBe("app");
    expect(classifyHost("APP.0xterm.xyz")).toBe("app");
    expect(classifyHost("www.app.0xterm.xyz")).toBe("app");
    expect(classifyHost("app.0xterm.xyz:443")).toBe("app");
  });

  it("treats localhost-family as local (dev dual-surface)", () => {
    expect(classifyHost("localhost")).toBe("local");
    expect(classifyHost("127.0.0.1")).toBe("local");
    expect(classifyHost("preview.bore.pub")).toBe("local");
    expect(classifyHost("foo.trycloudflare.com")).toBe("local");
    expect(isLocalDevHost("192.168.1.10")).toBe(true);
  });

  it("defaults empty / unknown hosts to app on this Pages artifact", () => {
    // Empty hostname previously fell through to local → marketing. Bad.
    expect(classifyHost("")).toBe("app");
    expect(classifyHost("0xsyung.github.io")).toBe("app");
    expect(classifyHost("weird-cdn.example")).toBe("app");
  });
});

describe("stripAppPrefix", () => {
  it("strips bare /app", () => {
    expect(stripAppPrefix("/app")).toBe("/");
    expect(stripAppPrefix("/app/")).toBe("/");
  });

  it("strips nested paths", () => {
    expect(stripAppPrefix("/app/foo")).toBe("/foo");
    expect(stripAppPrefix("/app/foo/")).toBe("/foo/");
    expect(stripAppPrefix("/app/foo/bar")).toBe("/foo/bar");
  });

  it("returns null outside /app", () => {
    expect(stripAppPrefix("/")).toBeNull();
    expect(stripAppPrefix("/apple")).toBeNull();
    expect(stripAppPrefix("/settings")).toBeNull();
  });
});

describe("resolveHostRedirect", () => {
  it("app host /app/... → strip prefix silently (primary production story)", () => {
    expect(
      resolveHostRedirect({
        hostname: APP_HOST,
        pathname: "/app",
        search: ""
      })
    ).toEqual({ href: "/" });

    expect(
      resolveHostRedirect({
        hostname: APP_HOST,
        pathname: "/app/foo",
        search: "?q=1"
      })
    ).toEqual({ href: "/foo?q=1" });
  });

  it("app host root and non-/app paths do not redirect", () => {
    expect(
      resolveHostRedirect({
        hostname: APP_HOST,
        pathname: "/",
        search: ""
      })
    ).toBeNull();

    expect(
      resolveHostRedirect({
        hostname: APP_HOST,
        pathname: "/settings",
        search: ""
      })
    ).toBeNull();
  });

  it("apex → app origin (defensive; production apex is 0xterm-dot-xyz)", () => {
    expect(
      resolveHostRedirect({
        hostname: "0xterm.xyz",
        pathname: "/",
        search: ""
      })
    ).toEqual({ href: `${APP_ORIGIN}/` });

    expect(
      resolveHostRedirect({
        hostname: "0xterm.xyz",
        pathname: "/app",
        search: ""
      })
    ).toEqual({ href: `${APP_ORIGIN}/` });

    expect(
      resolveHostRedirect({
        hostname: "0xterm.xyz",
        pathname: "/app/",
        search: "?x=1"
      })
    ).toEqual({ href: `${APP_ORIGIN}/?x=1` });

    expect(
      resolveHostRedirect({
        hostname: "www.0xterm.xyz",
        pathname: "/app/foo",
        search: "?x=1"
      })
    ).toEqual({ href: `${APP_ORIGIN}/foo?x=1` });

    expect(
      resolveHostRedirect({
        hostname: "0xterm.xyz",
        pathname: "/docs",
        search: ""
      })
    ).toEqual({ href: `${APP_ORIGIN}/docs` });
  });

  it("local dual-surface never redirects", () => {
    expect(
      resolveHostRedirect({
        hostname: "localhost",
        pathname: "/app",
        search: ""
      })
    ).toBeNull();

    expect(
      resolveHostRedirect({
        hostname: "localhost",
        pathname: "/app/foo",
        search: "?x=1"
      })
    ).toBeNull();

    expect(
      resolveHostRedirect({
        hostname: "localhost",
        pathname: "/",
        search: ""
      })
    ).toBeNull();
  });

  it("unknown app-artifact host strips /app like app host", () => {
    expect(
      resolveHostRedirect({
        hostname: "0xsyung.github.io",
        pathname: "/app/foo",
        search: "?x=1"
      })
    ).toEqual({ href: "/foo?x=1" });
  });
});

describe("surface helpers", () => {
  it("boots terminal at root on app host and artifact unknowns", () => {
    expect(shouldBootTerminalAtRoot(APP_HOST)).toBe(true);
    expect(shouldBootTerminalAtRoot("")).toBe(true);
    expect(shouldBootTerminalAtRoot("0xsyung.github.io")).toBe(true);
    expect(shouldBootTerminalAtRoot("0xterm.xyz")).toBe(false);
    expect(shouldBootTerminalAtRoot("localhost")).toBe(false);
  });

  it("shows landing only on local (dev dual-surface)", () => {
    expect(shouldShowLanding("localhost")).toBe(true);
    expect(shouldShowLanding(APP_HOST)).toBe(false);
    expect(shouldShowLanding("")).toBe(false);
    expect(shouldShowLanding("0xterm.xyz")).toBe(false);
  });

  it("keeps /app terminal only on local", () => {
    expect(shouldRenderTerminalAtAppPath("localhost")).toBe(true);
    expect(shouldRenderTerminalAtAppPath(APP_HOST)).toBe(false);
    expect(shouldRenderTerminalAtAppPath("0xterm.xyz")).toBe(false);
  });

  it("launch href: local /app, app /, apex → app origin", () => {
    expect(terminalLaunchHref("localhost")).toBe("/app");
    expect(terminalLaunchHref(APP_HOST)).toBe("/");
    expect(terminalLaunchHref("0xterm.xyz")).toBe(`${APP_ORIGIN}/`);
  });
});

describe("defaultSiteUrl", () => {
  it("defaults to app origin (this repo's Pages host)", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(defaultSiteUrl()).toBe(APP_ORIGIN);
    if (prev !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("reads NEXT_PUBLIC_SITE_URL and strips trailing slash", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.0xterm.xyz/";
    expect(defaultSiteUrl()).toBe("https://app.0xterm.xyz");
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });
});
