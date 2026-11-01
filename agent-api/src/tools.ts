// Tool whitelist: declarations sent to Gemini and the server-side validator
// every model-proposed call must pass before anything happens. The model's
// arguments are treated as untrusted input — exactly like visitor text.

import type { Knowledge } from "./knowledge-types.ts";

export type ToolName =
  | "navigate_to"
  | "filter_projects"
  | "open_project"
  | "get_contact"
  | "send_contact_message";

/** Tools the browser executes (camera/filter moves). */
export const CLIENT_TOOLS: ReadonlySet<ToolName> = new Set([
  "navigate_to",
  "filter_projects",
  "open_project",
  "get_contact",
]);

export type ValidCall =
  | { name: "navigate_to"; args: { section: string } }
  | { name: "filter_projects"; args: { category: string } }
  | { name: "open_project"; args: { id: string } }
  | { name: "get_contact"; args: Record<string, never> }
  | { name: "send_contact_message"; args: ContactArgs };

export interface ContactArgs {
  name: string;
  email: string;
  message: string;
}

export function toolDeclarations(k: Knowledge) {
  const sections = k.sections.map((s) => s.id);
  return [
    {
      name: "navigate_to",
      description:
        "Move the site's camera to a section. Sections: " +
        k.sections.map((s) => `${s.id} (${s.label})`).join(", ") +
        ".",
      parameters: {
        type: "object",
        properties: { section: { type: "string", enum: sections } },
        required: ["section"],
      },
    },
    {
      name: "filter_projects",
      description: "Show the BUILDS section filtered to one project category ('all' clears the filter).",
      parameters: {
        type: "object",
        properties: { category: { type: "string", enum: ["all", ...k.projectCategories] } },
        required: ["category"],
      },
    },
    {
      name: "open_project",
      description: "Open one project in the BUILDS section by its exact repo id from the knowledge base.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", enum: k.projects.map((p) => p.id) } },
        required: ["id"],
      },
    },
    {
      name: "get_contact",
      description: "Show the owner's public contact channels (email, GitHub, LinkedIn, resume) and move to the PING section. Takes no arguments.",
      // No `parameters`: Gemini rejects an OBJECT schema with no properties.
    },
    {
      name: "send_contact_message",
      description:
        "Queue a message to the owner from the visitor. Call it once the visitor wants a message passed on and has given their name, a valid email and the message (ask for any that are missing; never invent them). This only creates a draft: the visitor reviews it and presses a confirm button before anything is sent.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Visitor's name" },
          email: { type: "string", description: "Visitor's reply-to email" },
          message: { type: "string", description: "The visitor's message to the owner, written in the first person as the visitor speaking directly to him (e.g. \"Hi Sai, I have a role I'd like to discuss…\"). Keep every detail they gave and their meaning; only fix typos and grammar. Never turn it into instructions about him (\"Tell him…\")." },
        },
        required: ["name", "email", "message"],
      },
    },
  ];
}

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CTRL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮]/;
const URLISH = /(https?:\/\/|www\.)/i;

export const CONTACT_LIMITS = { name: 80, email: 254, messageMin: 10, messageMax: 1000 };

export function validateContactArgs(raw: unknown): { ok: true; args: ContactArgs } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "missing fields" };
  const a = raw as Record<string, unknown>;
  const extra = Object.keys(a).filter((key) => !["name", "email", "message"].includes(key));
  if (extra.length) return { ok: false, reason: "unexpected fields" };
  const name = typeof a.name === "string" ? a.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof a.email === "string" ? a.email.trim() : "";
  const message = typeof a.message === "string" ? a.message.trim() : "";
  if (!name || name.length > CONTACT_LIMITS.name || CTRL.test(name) || URLISH.test(name) || /[<>]/.test(name)) {
    return { ok: false, reason: "a name (plain text, up to 80 characters)" };
  }
  if (!email || email.length > CONTACT_LIMITS.email || !EMAIL.test(email)) {
    return { ok: false, reason: "a valid email address" };
  }
  if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax || CTRL.test(message)) {
    return { ok: false, reason: `a message between ${CONTACT_LIMITS.messageMin} and ${CONTACT_LIMITS.messageMax} characters` };
  }
  return { ok: true, args: { name, email, message } };
}

function onlyKeys(a: Record<string, unknown>, keys: string[]) {
  return Object.keys(a).every((k) => keys.includes(k));
}

/** Validates a model-proposed call against the whitelist + knowledge. */
export function validateToolCall(
  name: unknown,
  rawArgs: unknown,
  k: Knowledge
): { ok: true; call: ValidCall } | { ok: false; reason: string } {
  const args = (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {}) as Record<
    string,
    unknown
  >;
  switch (name) {
    case "navigate_to": {
      if (!onlyKeys(args, ["section"])) return { ok: false, reason: "unexpected args" };
      const v = typeof args.section === "string" ? args.section.trim().toLowerCase() : "";
      // Accept the id or the on-screen label (BUILDS -> projects).
      const s = k.sections.find((x) => x.id === v || x.label.toLowerCase() === v);
      return s ? { ok: true, call: { name, args: { section: s.id } } } : { ok: false, reason: "unknown section" };
    }
    case "filter_projects": {
      if (!onlyKeys(args, ["category"])) return { ok: false, reason: "unexpected args" };
      const v = typeof args.category === "string" ? args.category.trim().toLowerCase().replace(/\/$/, "") : "";
      return v === "all" || k.projectCategories.includes(v)
        ? { ok: true, call: { name, args: { category: v } } }
        : { ok: false, reason: "unknown category" };
    }
    case "open_project": {
      if (!onlyKeys(args, ["id"])) return { ok: false, reason: "unexpected args" };
      const v = typeof args.id === "string" ? args.id.trim() : "";
      const p = k.projects.find((x) => x.id === v) ?? k.projects.find((x) => x.id.toLowerCase() === v.toLowerCase());
      return p ? { ok: true, call: { name, args: { id: p.id } } } : { ok: false, reason: "unknown project id" };
    }
    case "get_contact":
      return onlyKeys(args, []) ? { ok: true, call: { name, args: {} } } : { ok: false, reason: "unexpected args" };
    case "send_contact_message": {
      const r = validateContactArgs(args);
      return r.ok ? { ok: true, call: { name, args: r.args } } : { ok: false, reason: r.reason };
    }
    default:
      return { ok: false, reason: "tool not allowed" };
  }
}

/** Deterministic text used when the model calls a tool without saying anything. */
export function describeCall(call: ValidCall, k: Knowledge): string {
  switch (call.name) {
    case "navigate_to": {
      const s = k.sections.find((x) => x.id === call.args.section);
      return `Taking you to ${s?.label ?? call.args.section}. [→ ${s?.label ?? "WHOAMI"}]`;
    }
    case "filter_projects":
      return call.args.category === "all"
        ? "Showing every build. [→ BUILDS]"
        : `Filtered BUILDS to ${call.args.category}/. [→ BUILDS]`;
    case "open_project": {
      const p = k.projects.find((x) => x.id === call.args.id);
      return `Opened ${p?.title ?? call.args.id} in BUILDS. [→ BUILDS/${call.args.id}]`;
    }
    case "get_contact":
      return contactText(k);
    case "send_contact_message":
      return "Here's the message I'd send — confirm below to deliver it.";
  }
}

export function contactText(k: Knowledge): string {
  const lines = k.contact.channels.map((c) => `- ${c.id}: ${c.id === "EMAIL" ? c.label : c.url}`);
  return `You can reach ${k.owner.name.split(" ")[0]} here:\n${lines.join("\n")}\n[→ PING]`;
}
