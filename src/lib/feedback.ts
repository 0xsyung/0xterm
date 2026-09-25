/**
 * @file feedback.ts
 * @description Feedback command grammar (#19). Feedback is an encrypted chat
 *   message to a fixed operator address — no backend, no URL.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
export const FB_USAGE = "Usage: feedback [--no-address] [--email <addr>] [text]";
export const FB_EMAIL =
  "email looks unusable (need one @). omit --email or fix it.";

export type FeedbackArgsError = "FB_USAGE" | "FB_EMAIL";

export type ParsedFeedbackArgs =
  | { error: FeedbackArgsError }
  | { noAddress: boolean; email: string | null; text: string };

/**
 * Parse `feedback` arguments: flags first, then the rest is free text
 * (never split on spaces). `--no-address` forces the address out of the
 * context; `--email <addr>` adds a contact line.
 */
export function parseFeedbackArgs(argv: string[]): ParsedFeedbackArgs {
  let noAddress = false;
  let email: string | null = null;
  const rest: string[] = [];
  let i = 1; // argv[0] is "feedback"/"fb"
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--no-address") {
      noAddress = true;
    } else if (a === "--email") {
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) return { error: "FB_USAGE" };
      if (val.split("@").length !== 2 || val.trim() === "") return { error: "FB_EMAIL" };
      email = val;
      i++;
    } else if (a.startsWith("--")) {
      return { error: "FB_USAGE" };
    } else {
      // First non-flag token starts the free text; keep it verbatim incl. spaces.
      rest.push(argv.slice(i).join(" "));
      break;
    }
  }
  return { noAddress, email, text: rest.join(" ").trim() };
}
