// One chat turn: consumes model events, applies output guards and the tool
// whitelist, and emits client events. Transport-agnostic so it can be unit
// tested with a scripted event stream.

import type { ModelEvent } from "./gemini.ts";
import type { Knowledge } from "./knowledge-types.ts";
import { leaksPrompt } from "./guard.ts";
import { CANARY, LEAK_MARKERS } from "./prompt.ts";
import { CLIENT_TOOLS, contactText, describeCall, validateToolCall, type ContactArgs, type ValidCall } from "./tools.ts";

export type ClientEvent =
  | { event: "text"; data: { delta: string } }
  | { event: "reset"; data: { text: string } }
  | { event: "tool"; data: { name: string; args: Record<string, unknown> } }
  | { event: "contact_pending"; data: { id: string; expiresInSec: number } & ContactArgs }
  | { event: "notice"; data: { code: string; text: string } }
  | { event: "error"; data: { code: string; text: string } }
  | { event: "done"; data: { outcome: TurnOutcome } };

export type TurnOutcome = "ok" | "leak" | "blocked" | "upstream_error" | "empty" | "truncated";

export interface TurnSummary {
  outcome: TurnOutcome;
  outChars: number;
  tools: string[];
  rejected: string[];
  finish?: string;
  promptTokens?: number;
  outputTokens?: number;
}

export interface TurnDeps {
  events: AsyncIterable<ModelEvent>;
  knowledge: Knowledge;
  maxOutputChars: number;
  maxToolCalls?: number;
  /** false = refuse every tool call (used by the private playful mode). */
  toolsAllowed?: boolean;
  emit: (e: ClientEvent) => void | Promise<void>;
  queueContact: (a: ContactArgs) => Promise<{ ok: true; id: string; expiresInSec: number } | { ok: false; reason: string }>;
}

// Longest tripwire marker; this many trailing chars are held back from the
// client until we know they don't complete a marker.
const HOLD = Math.max(CANARY.length, ...LEAK_MARKERS.map((m) => m.length));

export function fallbackText(k: Knowledge, code: "budget" | "upstream" | "disabled"): string {
  const email = k.contact.channels.find((c) => c.id === "EMAIL")?.label;
  const why =
    code === "budget"
      ? "The assistant has used up today's budget and is resting until tomorrow (UTC)."
      : code === "disabled"
        ? "The assistant is offline right now."
        : "The assistant couldn't reach its model just now — try again in a minute.";
  return `${why}\nMeanwhile: projects are in BUILDS [→ BUILDS], and you can reach ${k.owner.name.split(" ")[0]}${email ? ` at ${email}` : ""} [→ PING].`;
}

export const SAFE_REPLACEMENT =
  "I can't share that. Ask me about the projects, stack, experience or how to get in touch. [→ BUILDS]";

export async function runTurn(d: TurnDeps): Promise<TurnSummary> {
  const maxCalls = d.maxToolCalls ?? 3;
  const summary: TurnSummary = { outcome: "ok", outChars: 0, tools: [], rejected: [] };
  const valid: ValidCall[] = [];
  let acc = "";
  let emitted = 0;
  let anything = false;

  const flush = async (all: boolean) => {
    const upto = all ? acc.length : Math.max(emitted, acc.length - HOLD);
    if (upto > emitted) {
      await d.emit({ event: "text", data: { delta: acc.slice(emitted, upto) } });
      emitted = upto;
      anything = true;
    }
  };

  try {
    for await (const ev of d.events) {
      if (ev.type === "text") {
        acc += ev.text;
        if (leaksPrompt(acc, CANARY, LEAK_MARKERS)) {
          summary.outcome = "leak";
          await d.emit({ event: "reset", data: { text: SAFE_REPLACEMENT } });
          acc = SAFE_REPLACEMENT;
          emitted = acc.length;
          anything = true;
          break;
        }
        if (acc.length > d.maxOutputChars) {
          acc = acc.slice(0, d.maxOutputChars).replace(/\S*$/, "") + " …";
          summary.outcome = "truncated";
          await flush(true);
          break;
        }
        await flush(false);
      } else if (ev.type === "call") {
        if (d.toolsAllowed === false) {
          summary.rejected.push(`${String(ev.name).slice(0, 40)}:disabled`);
          continue;
        }
        if (valid.length >= maxCalls) {
          summary.rejected.push(`${String(ev.name).slice(0, 40)}:over_limit`);
          continue;
        }
        const v = validateToolCall(ev.name, ev.args, d.knowledge);
        if (!v.ok) {
          summary.rejected.push(`${String(ev.name).slice(0, 40)}:${v.reason}`);
          if (ev.name === "send_contact_message") {
            await flush(true);
            await d.emit({
              event: "text",
              data: { delta: `${acc ? "\n" : ""}To pass that on I need ${v.reason}.` },
            });
            anything = true;
          }
          continue;
        }
        valid.push(v.call);
        summary.tools.push(v.call.name);
        if (CLIENT_TOOLS.has(v.call.name)) {
          await d.emit({ event: "tool", data: { name: v.call.name, args: { ...v.call.args } } });
        } else if (v.call.name === "send_contact_message") {
          const q = await d.queueContact(v.call.args);
          if (q.ok) {
            await d.emit({ event: "contact_pending", data: { id: q.id, expiresInSec: q.expiresInSec, ...v.call.args } });
          } else {
            await flush(true);
            await d.emit({ event: "text", data: { delta: `${acc ? "\n" : ""}${q.reason}` } });
            anything = true;
          }
        }
      } else if (ev.type === "blocked") {
        summary.outcome = "blocked";
      } else if (ev.type === "finish") {
        summary.finish = ev.reason;
        if (ev.reason === "SAFETY" || ev.reason === "PROHIBITED_CONTENT" || ev.reason === "BLOCKLIST") {
          summary.outcome = "blocked";
        }
      } else if (ev.type === "usage") {
        summary.promptTokens = ev.promptTokens;
        summary.outputTokens = ev.outputTokens;
      }
    }
    if (summary.outcome !== "leak") await flush(true);
  } catch {
    summary.outcome = "upstream_error";
    await flush(true);
    if (!anything && valid.length === 0) {
      await d.emit({ event: "notice", data: { code: "upstream", text: fallbackText(d.knowledge, "upstream") } });
    } else {
      await d.emit({ event: "error", data: { code: "upstream", text: "(connection dropped — answer may be incomplete)" } });
    }
    summary.outChars = acc.length;
    return summary;
  }

  if (!acc.trim() && !anything) {
    if (summary.outcome === "blocked") {
      await d.emit({ event: "text", data: { delta: "I can't help with that one. Ask me about the portfolio instead." } });
    } else if (valid.length) {
      const first = valid.find((c) => c.name === "get_contact") ?? valid[0];
      await d.emit({ event: "text", data: { delta: describeCall(first, d.knowledge) } });
    } else {
      summary.outcome = "empty";
      await d.emit({
        event: "text",
        data: { delta: "I don't have an answer for that. Try asking about the projects, stack or experience." },
      });
    }
  } else if (valid.some((c) => c.name === "get_contact") && !/@/.test(acc)) {
    // Make sure the actual channels are shown even if the model only said "here you go".
    await d.emit({ event: "text", data: { delta: `\n${contactText(d.knowledge)}` } });
  }
  summary.outChars = acc.length;
  return summary;
}
