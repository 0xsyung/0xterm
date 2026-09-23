/**
 * @file feedbackUrl.ts
 * @description Pure URL/builders for the feedback command (#19). v1 has no
 *   backend and no token — it opens a prefilled GitHub new-issue URL.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { APP_VERSION } from "./constants";

// The issue text says `0xsyung/0xterm`, but issues live on the app repo.
export const FEEDBACK_REPO = "0xsyung/0xterm-app";
export const FEEDBACK_LABEL = "feedback";

export const FEEDBACK_TITLE_FALLBACK = "feedback from 0xterm";
export const FEEDBACK_TITLE_MAX = 72;

// Conservative vs. browser ~8k limit; over this we fall back to clipboard.
export const FEEDBACK_URL_MAX = 6000;

export const FB_USAGE = "Usage: feedback [--no-address] [--email <addr>] [text]";
export const FB_EMPTY = "write a few words first.";
export const FB_POPUP =
  "popup blocked. copy the url below or allow popups for 0xterm.xyz.";
export const FB_SECRET =
  "this looks like a key / seed / token. it will be stripped. type YES to open the redacted github form.";
export const FB_LONG = "body copied to clipboard; paste it into the github form.";
export const FB_OPENED =
  "[✓] github issue form opened. submit it while logged in. label: feedback";
export const FB_EMAIL =
  "email looks unusable (need one @). omit --email or fix it.";

export type FeedbackArgsError = "FB_USAGE" | "FB_EMAIL";

export type ParsedFeedbackArgs =
  | { error: FeedbackArgsError }
  | { noAddress: boolean; email: string | null; text: string };

/**
 * Parse `feedback` arguments: flags first, then the rest is free text
 * (never split on spaces). `--no-address` forces the address out of the
 * context block; `--email <addr>` adds a contact line.
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

export type ContextInput = {
  theme?: string | null;
  chainLabel?: string | null;
  signer?: string | null; // full address (e.g. viem `address`); truncated here
  noAddress: boolean;
  email?: string | null;
  ua?: string;
};

const truncateAddress = (addr: string): string => {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

/**
 * Auto context block. Never reads rpcProviders, vault, IndexedDB, or AppKit
 * config — only theme / chain / signer label / version / UA.
 */
export function buildContextBlock(ctx: ContextInput): string {
  const lines: string[] = ["## Context (auto, from 0xterm)"];
  lines.push(`- theme: ${ctx.theme || "unknown"}`);
  lines.push(`- chain: ${ctx.chainLabel || "none"}`);
  if (ctx.noAddress) {
    lines.push("- signer: none");
  } else if (ctx.signer) {
    lines.push(`- signer: ${truncateAddress(ctx.signer)}`);
  } else {
    lines.push("- signer: none");
  }
  lines.push(`- 0xterm: v${APP_VERSION}`);
  const ua = (ctx.ua || "").slice(0, 120);
  lines.push(`- ua: ${ua || "unknown"}`);
  const block = lines.join("\n");
  if (ctx.email) {
    return `${block}\n\n## Contact\n\nemail: ${ctx.email}`;
  }
  return block;
}

export type BuildIssueUrlInput = { title: string; body: string };

/** Prefilled new-issue URL. Query params are fully encoded via encodeURIComponent. */
export function buildIssueUrl({ title, body }: BuildIssueUrlInput): string {
  const base = `https://github.com/${FEEDBACK_REPO}/issues/new`;
  const qs = [
    `labels=${FEEDBACK_LABEL}`,
    `title=${encodeURIComponent(title)}`,
    `body=${encodeURIComponent(body)}`
  ].join("&");
  return `${base}?${qs}`;
}

export type MakeFeedbackUrlInput = {
  title: string;
  body: string;
  context: string;
};

export type MakeFeedbackUrlResult =
  | { mode: "open"; url: string; clipboardText?: undefined }
  | {
      mode: "clipboard";
      url: string;
      clipboardText: string;
    };

/**
 * Build the open URL. When the full encoded URL would exceed the conservative
 * budget, switch to clipboard mode: short body in the URL, full markdown on
 * the clipboard.
 */
export function makeFeedbackUrl({
  title,
  body,
  context
}: MakeFeedbackUrlInput): MakeFeedbackUrlResult {
  const fullBody = `${body}\n\n${context}`;
  const url = buildIssueUrl({ title, body: fullBody });
  if (url.length <= FEEDBACK_URL_MAX) return { mode: "open", url };

  const shortBody =
    "## Feedback\n\n<body was too long for the URL. it is on your clipboard — paste below.>\n\n## Context (auto, from 0xterm)";
  return {
    mode: "clipboard",
    url: buildIssueUrl({ title, body: shortBody }),
    clipboardText: fullBody
  };
}

/** Issue title from redacted user text: first 72 chars, or the fallback. */
export const feedbackTitle = (text: string): string => {
  const t = text.trim();
  if (!t) return FEEDBACK_TITLE_FALLBACK;
  return t.slice(0, FEEDBACK_TITLE_MAX);
};
