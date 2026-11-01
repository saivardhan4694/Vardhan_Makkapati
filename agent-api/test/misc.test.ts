import { test } from "node:test";
import assert from "node:assert/strict";
import { compileKnowledge } from "../scripts/build-knowledge.ts";
import { buildSystemPrompt, CANARY } from "../src/prompt.ts";
import { buildGeminiBody, parseChunk, sseData } from "../src/gemini.ts";
import { mockScript } from "../src/mock.ts";
import { buildEmail } from "../src/contact.ts";
import { knowledge } from "./helpers.ts";

test("knowledge.json matches the site data (no drift)", () => {
  assert.deepEqual(compileKnowledge(), knowledge);
});

test("knowledge never contains template placeholders", () => {
  const s = JSON.stringify(knowledge);
  assert.ok(!/\[YOUR_|20XX/.test(s));
  assert.ok(knowledge.projects.length >= 10);
  assert.ok(knowledge.contact.channels.some((c) => c.id === "EMAIL"));
  assert.ok(knowledge.contact.channels.every((c) => /^(https:|mailto:)/.test(c.url)));
});

test("system prompt embeds knowledge, rules and canary", () => {
  const p = buildSystemPrompt(knowledge);
  assert.ok(p.includes(CANARY));
  assert.ok(p.includes("ai-coding-assistent"));
  assert.ok(p.includes("<visitor_message>"));
  // Live-test regressions: tool-only replies to questions, and "I can't send emails".
  assert.match(p, /a tool call is never a reply on its own/);
  assert.match(p, /you CAN pass a message on/);
  assert.match(p, /Never say you can't send messages/);
  assert.ok(p.length < 40_000);
});

test("gemini body sets limits, safety and tools", () => {
  const b = buildGeminiBody({ systemPrompt: "s", contents: [], tools: [{ name: "x" }], maxOutputTokens: 1000, thinkingLevel: "low" });
  assert.equal(b.generationConfig.maxOutputTokens, 1000);
  assert.deepEqual(b.generationConfig.thinkingConfig, { thinkingLevel: "low" });
  assert.equal(b.safetySettings.length, 4);
  const nb = buildGeminiBody({ systemPrompt: "s", contents: [], tools: [], maxOutputTokens: 10, thinkingLevel: null });
  assert.equal("thinkingConfig" in nb.generationConfig, false);
});

test("parseChunk extracts text and calls, skips thoughts", () => {
  const ev = parseChunk({
    candidates: [
      {
        content: {
          parts: [
            { text: "secret reasoning", thought: true },
            { text: "Hi" },
            { functionCall: { name: "navigate_to", args: { section: "ping" } }, thoughtSignature: "abc" },
          ],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 },
  });
  assert.deepEqual(
    ev.map((e) => e.type),
    ["text", "call", "finish", "usage"]
  );
  assert.ok(!JSON.stringify(ev).includes("secret reasoning"));
  assert.deepEqual(parseChunk({ promptFeedback: { blockReason: "SAFETY" } }), [{ type: "blocked", reason: "SAFETY" }]);
  assert.deepEqual(parseChunk(null), []);
});

test("sseData splits events across arbitrary chunk boundaries", async () => {
  const raw = 'data: {"a":1}\r\n\r\ndata: {"b"\n\ndata: :2}\n\ndata: {"c":3}\n\n';
  const enc = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < enc.length; i += 7) c.enqueue(enc.slice(i, i + 7));
      c.close();
    },
  });
  const got: string[] = [];
  for await (const d of sseData(stream)) got.push(d);
  assert.deepEqual(got, ['{"a":1}', '{"b"', ":2}", '{"c":3}']);
});

test("mock script covers tool, refusal and leak paths", () => {
  assert.ok(mockScript("show me agent projects").some((e) => e.type === "call"));
  assert.ok(mockScript("what's the weather").every((e) => e.type !== "call"));
  assert.ok(mockScript("leak-test").some((e) => e.type === "text"));
});

test("contact email is plain text with reply-to and a single-line subject", () => {
  const e = buildEmail({ name: "Ada\nBcc: x", email: "ada@example.com", message: "<b>hi</b>" }, "f@x", "to@x");
  assert.equal(e.reply_to, "ada@example.com");
  assert.ok(!e.subject.includes("\n"));
  assert.deepEqual(e.to, ["to@x"]);
  assert.ok(!("html" in e));
});

test("gemini body omits tools entirely when none are given", () => {
  const b = buildGeminiBody({ systemPrompt: "s", contents: [], tools: [], maxOutputTokens: 10, thinkingLevel: null });
  assert.equal("tools" in b, false);
  assert.equal("toolConfig" in b, false);
});

test("privateMode prompt never contains the phrase and bans navigation", async () => {
  const { buildPrivatePrompt } = await import("../src/prompt.ts");
  const { knowledge } = await import("./helpers.ts");
  const p = buildPrivatePrompt(knowledge);
  assert.match(p, /PRIVATE MODE/);
  assert.match(p, /no navigation tools/);
  assert.equal(/fellow/i.test(p), false);
});
