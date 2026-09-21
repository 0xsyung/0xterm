/**
 * @file hostRouting.test.ts
 * @description Unit tests for host / redirect helpers (#78)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  APP_HOST,
  APP_ORIGIN,
  classifyHost,
  resolveHostRedirect,
  shouldBootTerminalAtRoot,
  shouldRenderTerminalAtAppPath,
  stripAppPrefix,
  terminalLaunchHref,
  defaultSiteUrl
} from "./hostRouting";

describe("classifyHost", () => {
  it("classifies apex and www", () => {
    expect(classifyHost("0xterm.xyz")).toBe("apex");
    expect(classifyHost("www.0xterm.xyz")).toBe("apex");
    expect(classifyHost("0xterm.xyz.")).toBe("apex");
  });

  it("classifies app subdomain", () => {
    expect(classifyHost(APP_HOST)).toBe("app");
    expect(classifyHost("APP.0xterm.xyz")).toBe("app");
  });

  it("treats localhost and unknowns as local", () => {
    expect(classifyHost("localhost")).toBe("local");
    expect(classifyHost("127.0.0.1")).toBe("local");
    expect(classifyHost("preview.bore.pub")).toBe("local");
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
  it("apex /app → app origin root, preserves query", () => {
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
  });

  it("app host /app/... → strip prefix silently", () => {
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

  it("does not redirect landing or local dual-surface", () => {
    expect(
      resolveHostRedirect({
        hostname: "0xterm.xyz",
        pathname: "/",
        search: ""
      })
    ).toBeNull();

    expect(
      resolveHostRedirect({
        hostname: APP_HOST,
        pathname: "/",
        search: ""
      })
    ).toBeNull();

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
  });
});

describe("surface helpers", () => {
  it("boots terminal at root only on app host", () => {
    expect(shouldBootTerminalAtRoot(APP_HOST)).toBe(true);
    expect(shouldBootTerminalAtRoot("0xterm.xyz")).toBe(false);
    expect(shouldBootTerminalAtRoot("localhost")).toBe(false);
  });

  it("keeps /app terminal only on local", () => {
    expect(shouldRenderTerminalAtAppPath("localhost")).toBe(true);
    expect(shouldRenderTerminalAtAppPath(APP_HOST)).toBe(false);
    expect(shouldRenderTerminalAtAppPath("0xterm.xyz")).toBe(false);
  });

  it("launch href points at app subdomain on apex", () => {
    expect(terminalLaunchHref("0xterm.xyz")).toBe(`${APP_ORIGIN}/`);
    expect(terminalLaunchHref("localhost")).toBe("/app");
    expect(terminalLaunchHref(APP_HOST)).toBe("/");
  });
});

describe("defaultSiteUrl", () => {
  it("defaults to apex origin", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(defaultSiteUrl()).toBe("https://0xterm.xyz");
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
