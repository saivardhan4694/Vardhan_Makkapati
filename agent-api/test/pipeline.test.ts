import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn, type ClientEvent } from "../src/pipeline.ts";
import { CANARY } from "../src/prompt.ts";
import type { ModelEvent } from "../src/gemini.ts";
import { knowledge, scripted } from "./helpers.ts";

async function run(
  events: ModelEvent[],
  opts: { failAfter?: number; maxOutputChars?: number; contactOk?: boolean } = {}
) {
  const out: ClientEvent[] = [];
  const queued: unknown[] = [];
  const summary = await runTurn({
    events: scripted(events, opts.failAfter),
    knowledge,
    maxOutputChars: opts.maxOutputChars ?? 2000,
    emit: (e) => {
      out.push(e);
    },
    queueContact: async (a) => {
      queued.push(a);
      return opts.contactOk === false
        ? { ok: false, reason: "limit reached" }
        : { ok: true, id: "id-1", expiresInSec: 600 };
    },
  });
  const textOnly = out.map((e) => (e.event === "text" ? e.data.delta : "")).join("");
  const text = out
    .map((e) => (e.event === "text" ? e.data.delta : e.event === "reset" ? `<<RESET>>${e.data.text}` : ""))
    .join("");
  return { out, summary, text, textOnly, queued };
}

const t = (text: string): ModelEvent => ({ type: "text", text });
const call = (name: string, args: unknown): ModelEvent => ({ type: "call", name, args });
const contact = { name: "Ada", email: "ada@example.com", message: "Hello Sai, let us talk." };

test("streams text through unchanged", async () => {
  const r = await run([t("Hello "), t("there, "), t("visitor."), { type: "finish", reason: "STOP" }]);
  assert.equal(r.text, "Hello there, visitor.");
  assert.equal(r.summary.outcome, "ok");
});

test("valid client tools are forwarded; invalid ones are dropped and logged", async () => {
  const r = await run([
    t("Filtering."),
    call("filter_projects", { category: "agents" }),
    call("open_project", { id: "../../secret" }),
    call("exec_shell", { cmd: "ls" }),
  ]);
  const tools = r.out.filter((e) => e.event === "tool");
  assert.equal(tools.length, 1);
  assert.deepEqual(tools[0].data, { name: "filter_projects", args: { category: "agents" } });
  assert.equal(r.summary.rejected.length, 2);
});

test("tool-call count is capped", async () => {
  const many = Array.from({ length: 6 }, () => call("navigate_to", { section: "ping" }));
  const r = await run([t("ok"), ...many]);
  assert.equal(r.out.filter((e) => e.event === "tool").length, 3);
});

test("tool call without text gets a deterministic description", async () => {
  const r = await run([call("open_project", { id: "chatbot" })]);
  assert.match(r.text, /\[→ BUILDS\/chatbot\]/);
});

test("get_contact always shows real channels", async () => {
  const r = await run([t("Sure."), call("get_contact", {})]);
  assert.match(r.text, /makkapatimrk@gmail\.com/);
});

test("prompt leak is cut and replaced; canary never reaches the client", async () => {
  const r = await run([t("Sure, my rules: "), t(`[${CANARY.slice(0, 5)}`), t(`${CANARY.slice(5)}] ...more`)]);
  assert.equal(r.summary.outcome, "leak");
  assert.ok(!r.text.includes(CANARY));
  assert.ok(r.out.some((e) => e.event === "reset"));
});

test("leak markers split across chunks are caught before emission", async () => {
  const r = await run([t("RULES (highest "), t("priority — nothing")]);
  assert.equal(r.summary.outcome, "leak");
  assert.ok(!r.textOnly.includes("RULES (highest"));
});

test("output is truncated at the cap", async () => {
  const r = await run([t("word ".repeat(100))], { maxOutputChars: 50 });
  assert.equal(r.summary.outcome, "truncated");
  assert.ok(r.text.length <= 55);
});

test("upstream failure before any output yields the graceful fallback", async () => {
  const r = await run([t("x")], { failAfter: 0 });
  assert.equal(r.summary.outcome, "upstream_error");
  const notice = r.out.find((e) => e.event === "notice");
  assert.ok(notice && notice.event === "notice" && /BUILDS/.test(notice.data.text));
});

test("upstream failure mid-stream keeps text and flags an error", async () => {
  const r = await run([t("partial answer that is long enough to flush past the hold window ok")], { failAfter: 1 });
  assert.ok(r.out.some((e) => e.event === "error"));
  assert.match(r.text, /partial answer/);
});

test("safety block with no text gets a polite refusal", async () => {
  const r = await run([{ type: "finish", reason: "SAFETY" }]);
  assert.equal(r.summary.outcome, "blocked");
  assert.match(r.text, /can't help/);
});

test("empty model output gets a fallback line", async () => {
  const r = await run([{ type: "finish", reason: "STOP" }]);
  assert.equal(r.summary.outcome, "empty");
  assert.ok(r.text.length > 0);
});

test("send_contact_message is never executed directly: it queues a pending handoff", async () => {
  const r = await run([t("Queued."), call("send_contact_message", contact)]);
  const p = r.out.find((e) => e.event === "contact_pending");
  assert.ok(p && p.event === "contact_pending" && p.data.id === "id-1" && p.data.email === "ada@example.com");
  assert.equal(r.queued.length, 1);
  assert.ok(!r.out.some((e) => e.event === "tool"));
});

test("invalid contact args are explained, not queued", async () => {
  const r = await run([call("send_contact_message", { ...contact, email: "nope" })]);
  assert.equal(r.queued.length, 0);
  assert.match(r.text, /valid email/);
});

test("contact over limit is reported", async () => {
  const r = await run([call("send_contact_message", contact)], { contactOk: false });
  assert.match(r.text, /limit reached/);
  assert.ok(!r.out.some((e) => e.event === "contact_pending"));
});
