import { test } from "node:test";
import assert from "node:assert/strict";
import { streamWithFallback, UpstreamError, type GeminiRequest, type ModelEvent } from "../src/gemini.ts";

const req: GeminiRequest = {
  apiKey: "test",
  model: "primary",
  systemPrompt: "s",
  contents: [{ role: "user", parts: [{ text: "hi" }] }],
  tools: [],
  maxOutputTokens: 50,
  thinkingLevel: null,
  timeoutMs: 5000,
  firstByteMs: 100,
};

const sse = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

type Reply = { status?: number; chunks?: string[]; delayMs?: number; failAfterFirst?: boolean };

/** Fake fetch: each model id gets a scripted reply; records which models were called. */
function fakeFetch(replies: Record<string, Reply>, calls: string[]) {
  return (async (url: string, init: { signal: AbortSignal }) => {
    const model = decodeURIComponent(/models\/([^:]+):/.exec(url)![1]);
    calls.push(model);
    const r = replies[model];
    if (r.status && r.status !== 200) return new Response("busy", { status: r.status });
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const onAbort = () => ctrl.error(init.signal.reason);
        init.signal.addEventListener("abort", onAbort);
        if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
        if (init.signal.aborted) return;
        for (const [i, c] of (r.chunks ?? []).entries()) {
          ctrl.enqueue(enc.encode(sse(c)));
          if (r.failAfterFirst && i === 0) {
            // Let the first chunk be read, then fail with an error that WOULD
            // be retryable before any output.
            await new Promise((res) => setTimeout(res, 20));
            ctrl.error(new UpstreamError(503, "dropped"));
            return;
          }
        }
        ctrl.close();
      },
    });
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
}

async function run(replies: Record<string, Reply>, fallback: string | null = "backup") {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch(replies, calls);
  const text: string[] = [];
  let switched: number | undefined;
  let error: unknown;
  try {
    for await (const ev of streamWithFallback(req, fallback, (s) => (switched = s)) as AsyncIterable<ModelEvent>) {
      if (ev.type === "text") text.push(ev.text);
    }
  } catch (e) {
    error = e;
  } finally {
    globalThis.fetch = realFetch;
  }
  return { calls, text: text.join(""), switched, error };
}

test("fallback: healthy primary is used alone", async () => {
  const r = await run({ primary: { chunks: ["a", "b"] }, backup: { chunks: ["x"] } });
  assert.deepEqual(r.calls, ["primary"]);
  assert.equal(r.text, "ab");
  assert.equal(r.switched, undefined);
});

test("fallback: 503 / 429 from the primary retries on the backup", async () => {
  for (const status of [503, 429]) {
    const r = await run({ primary: { status }, backup: { chunks: ["ok"] } });
    assert.deepEqual(r.calls, ["primary", "backup"]);
    assert.equal(r.text, "ok");
    assert.equal(r.switched, status);
  }
});

test("fallback: primary silent past firstByteMs switches to the backup", async () => {
  const r = await run({ primary: { delayMs: 400, chunks: ["late"] }, backup: { chunks: ["fast"] } });
  assert.deepEqual(r.calls, ["primary", "backup"]);
  assert.equal(r.text, "fast");
  assert.equal(r.switched, -2);
});

test("fallback: never switches mid-answer", async () => {
  const r = await run({ primary: { chunks: ["part", "rest"], failAfterFirst: true }, backup: { chunks: ["x"] } });
  assert.deepEqual(r.calls, ["primary"]);
  assert.equal(r.text, "part");
  assert.ok(r.error);
});

test("fallback: non-retryable errors and disabled fallback surface as-is", async () => {
  const bad = await run({ primary: { status: 400 }, backup: { chunks: ["x"] } });
  assert.deepEqual(bad.calls, ["primary"]);
  assert.ok(bad.error instanceof UpstreamError && bad.error.status === 400);

  const off = await run({ primary: { status: 503 }, backup: { chunks: ["x"] } }, null);
  assert.deepEqual(off.calls, ["primary"]);
  assert.ok(off.error instanceof UpstreamError && off.error.status === 503);
});
