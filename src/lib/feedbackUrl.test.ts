/**
 * @file feedbackUrl.test.ts
 * @description Pure URL/builders for the feedback command (#19)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import {
  buildContextBlock,
  buildIssueUrl,
  feedbackTitle,
  FEEDBACK_REPO,
  FEEDBACK_TITLE_FALLBACK,
  makeFeedbackUrl,
  parseFeedbackArgs
} from "./feedbackUrl";

describe("parseFeedbackArgs", () => {
  it("parses bare feedback", () => {
    expect(parseFeedbackArgs(["feedback"])).toEqual({
      noAddress: false,
      email: null,
      text: ""
    });
  });

  it("parses free text (not split on spaces)", () => {
    expect(parseFeedbackArgs(["feedback", "the", "swap", "button", "broke"])).toEqual({
      noAddress: false,
      email: null,
      text: "the swap button broke"
    });
  });

  it("parses flags then text", () => {
    expect(
      parseFeedbackArgs(["feedback", "--no-address", "--email", "a@b.co", "hello", "world"])
    ).toEqual({
      noAddress: true,
      email: "a@b.co",
      text: "hello world"
    });
  });

  it("rejects --email without a value", () => {
    expect(parseFeedbackArgs(["feedback", "--email"])).toEqual({
      error: "FB_USAGE"
    });
  });

  it("rejects an email with zero or two @", () => {
    expect(parseFeedbackArgs(["feedback", "--email", "nope"])).toEqual({
      error: "FB_EMAIL"
    });
    expect(parseFeedbackArgs(["feedback", "--email", "a@b@c"])).toEqual({
      error: "FB_EMAIL"
    });
  });

  it("rejects an unknown flag", () => {
    expect(parseFeedbackArgs(["feedback", "--wat"])).toEqual({
      error: "FB_USAGE"
    });
  });
});

describe("buildIssueUrl", () => {
  it("points at the app repo new-issue page with labels=feedback", () => {
    const url = buildIssueUrl({ title: "t", body: "b" });
    expect(url).toContain(`https://github.com/${FEEDBACK_REPO}/issues/new`);
    expect(url).toContain("labels=feedback");
  });

  it("fully encodes title and body (no raw & or ?)", () => {
    const url = buildIssueUrl({ title: "a & b ?", body: "x=y&z=1" });
    expect(url).not.toContain("title=a & b");
    expect(decodeURIComponent(url)).toContain("a & b ?");
    expect(decodeURIComponent(url)).toContain("x=y&z=1");
  });
});

describe("makeFeedbackUrl", () => {
  it("returns open mode for short bodies", () => {
    const res = makeFeedbackUrl({
      title: "t",
      body: "short",
      context: "ctx"
    });
    expect(res.mode).toBe("open");
    if (res.mode === "open") expect(res.url).toContain("labels=feedback");
  });

  it("returns clipboard mode when the encoded URL exceeds the budget", () => {
    const long = "x".repeat(6000);
    const res = makeFeedbackUrl({
      title: "t",
      body: long,
      context: "ctx"
    });
    expect(res.mode).toBe("clipboard");
    if (res.mode === "clipboard") {
      expect(res.clipboardText).toContain(long);
      // Short body is in the URL — but encodeURIComponent'd.
      expect(res.url.length).toBeLessThan(600);
      expect(decodeURIComponent(res.url)).toContain("on your clipboard");
    }
  });
});

describe("buildContextBlock", () => {
  it("truncates the signer address and includes theme/chain/version/ua", () => {
    const ctx = buildContextBlock({
      theme: "matrix",
      chainLabel: "Base (8453)",
      signer: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      noAddress: false,
      email: null,
      ua: "Mozilla/5.0 test"
    });
    expect(ctx).toContain("theme: matrix");
    expect(ctx).toContain("chain: Base (8453)");
    expect(ctx).toContain("signer: 0xABCD…EF12");
    expect(ctx).not.toContain("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(ctx).toContain("0xterm: v1.5.0");
    expect(ctx).toContain("ua: Mozilla/5.0 test");
    expect(ctx).not.toContain("## Contact");
  });

  it("omits the signer when noAddress", () => {
    const ctx = buildContextBlock({
      theme: "matrix",
      chainLabel: null,
      signer: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      noAddress: true,
      email: null
    });
    expect(ctx).toContain("signer: none");
    expect(ctx).not.toContain("0xABCDEF123456");
  });

  it("appends a Contact section when email is present", () => {
    const ctx = buildContextBlock({
      theme: "matrix",
      chainLabel: null,
      signer: null,
      noAddress: true,
      email: "a@b.co"
    });
    expect(ctx).toContain("## Contact");
    expect(ctx).toContain("email: a@b.co");
  });

  it("never references rpcProviders, vault, or IndexedDB", () => {
    const ctx = buildContextBlock({
      theme: "matrix",
      chainLabel: null,
      signer: null,
      noAddress: true,
      email: null
    });
    expect(ctx.toLowerCase()).not.toContain("rpc");
    expect(ctx.toLowerCase()).not.toContain("vault");
    expect(ctx.toLowerCase()).not.toContain("indexeddb");
  });
});

describe("feedbackTitle", () => {
  it("uses the first 72 chars of the redacted text", () => {
    const long = "z".repeat(100);
    expect(feedbackTitle(long)).toBe("z".repeat(72));
  });

  it("falls back for empty text", () => {
    expect(feedbackTitle("")).toBe(FEEDBACK_TITLE_FALLBACK);
    expect(feedbackTitle("   ")).toBe(FEEDBACK_TITLE_FALLBACK);
  });
});
