// Input validation, sanitisation and prompt-injection hygiene. Pure
// functions only — unit tested without any network or Workers runtime.

import type { Config } from "./config.ts";

export interface HistoryItem {
  role: "user" | "model";
  text: string;
}

export interface ChatRequest {
  message: string;
  history: HistoryItem[];
  turnstileToken?: string;
}

export type ValidationError =
  | { code: "bad_request"; message: string }
  | { code: "empty"; message: string }
  | { code: "too_long"; message: string }
  | { code: "turn_limit"; message: string };

export const MAX_BODY_BYTES = 32 * 1024;
const MAX_MODEL_TURN_CHARS = 4000;

/** Strips control/format characters (keeps \n and \t), NFKC-normalises, trims. */
export function cleanText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    // C0/C1 controls except tab/newline, zero-width + bidi override chars
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{4,}/g, "   ")
    .trim();
}

export function validateChatRequest(
  body: unknown,
  cfg: Pick<Config, "maxInputChars" | "maxTurns" | "historyWindow">
): { ok: true; req: ChatRequest; userTurns: number } | { ok: false; error: ValidationError } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: { code: "bad_request", message: "Expected a JSON object." } };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string") {
    return { ok: false, error: { code: "bad_request", message: "`message` must be a string." } };
  }
  // Length is checked on the raw string too, so a huge payload of stripped
  // characters can't sneak past the cap.
  if (b.message.length > cfg.maxInputChars * 2) {
    return { ok: false, error: tooLong(cfg.maxInputChars) };
  }
  const message = cleanText(b.message);
  if (!message) return { ok: false, error: { code: "empty", message: "Type a question first." } };
  if (message.length > cfg.maxInputChars) return { ok: false, error: tooLong(cfg.maxInputChars) };

  let history: HistoryItem[] = [];
  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) {
      return { ok: false, error: { code: "bad_request", message: "`history` must be an array." } };
    }
    if (b.history.length > cfg.maxTurns * 2) {
      return { ok: false, error: turnLimit() };
    }
    for (const item of b.history) {
      if (!item || typeof item !== "object") {
        return { ok: false, error: { code: "bad_request", message: "Bad history item." } };
      }
      const { role, text } = item as Record<string, unknown>;
      if ((role !== "user" && role !== "model") || typeof text !== "string") {
        return { ok: false, error: { code: "bad_request", message: "Bad history item." } };
      }
      const limit = role === "user" ? cfg.maxInputChars : MAX_MODEL_TURN_CHARS;
      const t = cleanText(text).slice(0, limit);
      if (t) history.push({ role, text: t });
    }
  }

  const userTurns = history.filter((h) => h.role === "user").length + 1;
  if (userTurns > cfg.maxTurns) return { ok: false, error: turnLimit() };

  // Short window: only the most recent turns reach the model, and the window
  // must open on a user turn.
  history = cfg.historyWindow > 0 ? history.slice(-cfg.historyWindow) : [];
  while (history.length && history[0].role !== "user") history.shift();

  const token = typeof b.turnstileToken === "string" ? b.turnstileToken.slice(0, 2048) : undefined;
  return { ok: true, req: { message, history, turnstileToken: token }, userTurns };
}

const tooLong = (n: number): ValidationError => ({
  code: "too_long",
  message: `Keep it under ${n} characters.`,
});
const turnLimit = (): ValidationError => ({
  code: "turn_limit",
  message: "This session hit its turn limit. Clear it (type `clear`) to start fresh.",
});

// Common jailbreak / injection phrasings. Matching does NOT block the
// request (false positives are cheap to answer, a refusal is the model's
// job) — it adds an extra reminder to the turn and tags the log line.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts?|messages)/i,
  /disregard\s+(all\s+|your\s+|the\s+)?(instructions|rules|guidelines|system)/i,
  /(reveal|print|show|repeat|output|leak)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions|rules)/i,
  /\bsystem\s*prompt\b/i,
  /you\s+are\s+(now|no\s+longer)\b/i,
  /\b(developer|god|dan|jailbreak|unfiltered)\s+mode\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /\bact\s+as\s+(an?\s+)?(different|unrestricted|unfiltered|evil)/i,
  /<\/?\s*(system|visitor_message|knowledge|rules)\b/i,
  /\[\s*(system|inst)\s*\]/i,
  /\bnew\s+instructions?\s*:/i,
];

export function injectionFlags(text: string): string[] {
  return INJECTION_PATTERNS.filter((re) => re.test(text)).map((re) => re.source.slice(0, 24));
}

/**
 * Wraps visitor text in the delimiter the system prompt describes. Any
 * attempt to forge the delimiter (or the other structural tags) is
 * neutralised so the visitor can't "close" their block early.
 */
export function wrapVisitorText(text: string): string {
  const neutral = text.replace(/<\s*\/?\s*(visitor_message|system|knowledge|rules|tools)[^>]*>/gi, "[tag removed]");
  return `<visitor_message>\n${neutral}\n</visitor_message>`;
}

/**
 * Prompt-leak tripwire. The system prompt carries a canary token and a few
 * distinctive phrases; if any of them shows up in streamed output the
 * response is cut and replaced.
 */
export function leaksPrompt(output: string, canary: string, markers: string[]): boolean {
  if (output.includes(canary)) return true;
  const lower = output.toLowerCase();
  return markers.some((m) => lower.includes(m.toLowerCase()));
}

export async function hashSubject(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
