/**
 * @file feedback.test.ts
 * @description Feedback command grammar (#19)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { FB_EMAIL, FB_USAGE, parseFeedbackArgs } from "./feedback";

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

describe("messages", () => {
  it("expose usage and email error text", () => {
    expect(FB_USAGE).toContain("feedback");
    expect(FB_EMAIL).toContain("@");
  });
});
