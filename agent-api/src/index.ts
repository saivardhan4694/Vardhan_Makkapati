// Portfolio agent API (Cloudflare Worker).
//
//   POST /chat             -> text/event-stream (see pipeline.ClientEvent)
//   POST /contact/confirm  -> JSON, delivers a handoff the visitor confirmed
//   GET  /health           -> JSON, no secrets
//
// Request flow: CORS/origin -> body validation -> (Turnstile) -> kill switch
// -> rate limits + global budget -> model stream -> output guards + tool
// whitelist -> SSE. Logs are one anonymised JSON line per request.

import knowledgeJson from "./knowledge.json";
import type { Knowledge } from "./knowledge-types.ts";
import { loadConfig, type Config, type Env } from "./config.ts";
import { MAX_BODY_BYTES, hashSubject, injectionFlags, validateChatRequest, wrapVisitorText } from "./guard.ts";
import type { Rule } from "./limits.ts";
import type { Limiter } from "./limiter-do.ts";
import { buildSystemPrompt, INJECTION_REMINDER } from "./prompt.ts";
import { streamWithFallback, UpstreamError, type Content, type ModelEvent } from "./gemini.ts";
import { streamMock } from "./mock.ts";
import { toolDeclarations, type ContactArgs } from "./tools.ts";
import { fallbackText, runTurn, type ClientEvent } from "./pipeline.ts";
import { sendViaResend } from "./contact.ts";
import { verifyTurnstile } from "./turnstile.ts";

export { Limiter } from "./limiter-do.ts";

const knowledge = knowledgeJson as Knowledge;
const SYSTEM_PROMPT = buildSystemPrompt(knowledge);
const TOOLS = toolDeclarations(knowledge);
const PENDING_TTL_SEC = 10 * 60;
const DAY = 86400;

// ---- helpers -----------------------------------------------------------

function corsHeaders(origin: string | null, cfg: Config): Record<string, string> {
  const h: Record<string, string> = { vary: "Origin" };
  if (origin && cfg.allowedOrigins.includes(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-methods"] = "POST, GET, OPTIONS";
    h["access-control-allow-headers"] = "content-type";
    h["access-control-max-age"] = "86400";
  }
  return h;
}

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors, ...extra },
  });
}

function log(evt: Record<string, unknown>) {
  // Anonymised by construction: callers never pass IPs, hashes, or text.
  console.log(JSON.stringify({ t: new Date().toISOString(), ...evt }));
}

async function readJson(req: Request): Promise<unknown | undefined> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return undefined;
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function limiter(env: Env): DurableObjectStub<Limiter> {
  const ns = env.LIMITER as unknown as DurableObjectNamespace<Limiter>;
  return ns.get(ns.idFromName("global"));
}

function chatRules(cfg: Config, subject: string): Rule[] {
  return [
    { name: "ip-short", subject, limit: cfg.rateShortLimit, windowSec: cfg.rateShortWindowSec },
    { name: "ip-day", subject, limit: cfg.rateDailyLimit, windowSec: DAY },
    { name: "global-day", subject: "*", limit: cfg.globalDailyCap, windowSec: DAY },
  ];
}

function contactRules(cfg: Config, subject: string): Rule[] {
  return [
    { name: "contact-ip-day", subject, limit: cfg.contactDailyLimit, windowSec: DAY },
    { name: "contact-global-day", subject: "*", limit: cfg.contactGlobalDailyCap, windowSec: DAY },
  ];
}

function sseResponse(cors: Record<string, string>, run: (emit: (e: ClientEvent) => Promise<void>) => Promise<void>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const emit = async (e: ClientEvent) => {
    await writer.write(enc.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
  };
  const done = (async () => {
    try {
      await run(emit);
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  return {
    response: new Response(readable, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
        ...cors,
      },
    }),
    done,
  };
}

/** A one-shot notice stream (fallbacks reuse the normal SSE contract). */
function noticeStream(cors: Record<string, string>, code: string, text: string) {
  return sseResponse(cors, async (emit) => {
    await emit({ event: "notice", data: { code, text } });
    await emit({ event: "done", data: { outcome: "ok" } });
  }).response;
}

// ---- routes ------------------------------------------------------------

async function handleChat(req: Request, env: Env, cfg: Config, cors: Record<string, string>, ctx: ExecutionContext) {
  const started = Date.now();
  const body = await readJson(req);
  if (body === undefined) return json({ error: "bad_request", message: "Invalid JSON body." }, 400, cors);
  const v = validateChatRequest(body, cfg);
  if (!v.ok) {
    log({ evt: "chat", outcome: `rejected_${v.error.code}` });
    return json({ error: v.error.code, message: v.error.message }, v.error.code === "turn_limit" ? 409 : 400, cors);
  }
  const { req: chat } = v;

  const ip = req.headers.get("cf-connecting-ip");
  if (cfg.turnstileEnabled && !(await verifyTurnstile(env.TURNSTILE_SECRET!, chat.turnstileToken, ip))) {
    log({ evt: "chat", outcome: "turnstile_failed" });
    return json({ error: "challenge", message: "Verification failed — reload the page and try again." }, 403, cors);
  }

  if (!cfg.enabled || (!cfg.mock && !env.GEMINI_API_KEY)) {
    log({ evt: "chat", outcome: "disabled" });
    return noticeStream(cors, "disabled", fallbackText(knowledge, "disabled"));
  }

  const subject = await hashSubject(ip ?? "unknown", env.IP_HASH_SALT ?? "portfolio-agent");
  const stub = limiter(env);
  const rl = await stub.hit(chatRules(cfg, subject));
  if (!rl.ok) {
    log({ evt: "chat", outcome: `limited_${rl.blockedBy}` });
    if (rl.blockedBy === "global-day") return noticeStream(cors, "budget", fallbackText(knowledge, "budget"));
    const mins = Math.ceil((rl.retryAfterSec ?? 60) / 60);
    return json(
      {
        error: "rate_limited",
        message: `Easy there — you've hit the message limit. Try again in ~${mins} min.`,
        retryAfterSec: rl.retryAfterSec,
      },
      429,
      cors,
      { "retry-after": String(rl.retryAfterSec ?? 60) }
    );
  }

  const flags = injectionFlags(chat.message);
  const contents: Content[] = [
    ...chat.history.map((h) => ({
      role: h.role,
      parts: [{ text: h.role === "user" ? wrapVisitorText(h.text) : h.text }],
    })),
    {
      role: "user" as const,
      parts: [{ text: wrapVisitorText(chat.message) + (flags.length ? `\n${INJECTION_REMINDER}` : "") }],
    },
  ];

  let fallback: { status: number; model: string } | undefined;
  const events: AsyncIterable<ModelEvent> = cfg.mock
    ? streamMock(chat.message)
    : streamWithFallback({
        apiKey: env.GEMINI_API_KEY!,
        model: cfg.model,
        systemPrompt: SYSTEM_PROMPT,
        contents,
        tools: TOOLS,
        maxOutputTokens: cfg.maxOutputTokens + cfg.thinkingHeadroom,
        thinkingLevel: cfg.thinkingLevel,
        timeoutMs: cfg.upstreamTimeoutMs,
        firstByteMs: cfg.fallbackModel ? cfg.firstByteTimeoutMs : undefined,
      }, cfg.fallbackModel, (status, model) => {
        fallback = { status, model };
      });

  let upstreamStatus: number | undefined;
  const tracked = (async function* () {
    try {
      yield* events;
    } catch (e) {
      upstreamStatus = e instanceof UpstreamError ? e.status : -1;
      throw e;
    }
  })();

  const { response, done } = sseResponse(cors, async (emit) => {
    const summary = await runTurn({
      events: tracked,
      knowledge,
      maxOutputChars: cfg.maxOutputTokens * 5,
      emit,
      queueContact: async (a: ContactArgs) => {
        // Peek the handoff budget now so the visitor isn't asked to confirm
        // something that would be refused; it is consumed on confirm.
        const left = await stub.left(contactRules(cfg, subject)[0]);
        if (left <= 0) return { ok: false, reason: "The message limit for today is reached — please use the email on PING instead. [→ PING]" };
        const id = crypto.randomUUID();
        await stub.putPending(id, { ...a, subject, exp: Date.now() + PENDING_TTL_SEC * 1000 });
        return { ok: true, id, expiresInSec: PENDING_TTL_SEC };
      },
    });
    await emit({ event: "done", data: { outcome: summary.outcome } });
    log({
      evt: "chat",
      outcome: summary.outcome,
      ms: Date.now() - started,
      model: cfg.mock ? "mock" : (fallback?.model ?? cfg.model),
      fallbackFrom: fallback ? { model: cfg.model, status: fallback.status } : undefined,
      turn: v.userTurns,
      inChars: chat.message.length,
      outChars: summary.outChars,
      tools: summary.tools,
      rejectedTools: summary.rejected,
      flags: flags.length,
      finish: summary.finish,
      promptTokens: summary.promptTokens,
      outputTokens: summary.outputTokens,
      upstreamStatus,
    });
  });
  ctx.waitUntil(done);
  return response;
}

async function handleConfirm(req: Request, env: Env, cfg: Config, cors: Record<string, string>) {
  const body = (await readJson(req)) as { id?: unknown; turnstileToken?: unknown } | undefined;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return json({ error: "bad_request", message: "Missing handoff id." }, 400, cors);

  const ip = req.headers.get("cf-connecting-ip");
  if (
    cfg.turnstileEnabled &&
    !(await verifyTurnstile(env.TURNSTILE_SECRET!, typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined, ip))
  ) {
    return json({ error: "challenge", message: "Verification failed — reload and try again." }, 403, cors);
  }

  const subject = await hashSubject(ip ?? "unknown", env.IP_HASH_SALT ?? "portfolio-agent");
  const stub = limiter(env);
  const pending = await stub.takePending(id, subject);
  if (!pending) {
    log({ evt: "contact", outcome: "expired" });
    return json({ error: "expired", message: "That draft expired — ask me to prepare it again." }, 410, cors);
  }
  const rl = await stub.hit(contactRules(cfg, subject));
  if (!rl.ok) {
    log({ evt: "contact", outcome: `limited_${rl.blockedBy}` });
    return json({ error: "rate_limited", message: "Message limit reached for today — please email directly." }, 429, cors);
  }

  const args = { name: pending.name, email: pending.email, message: pending.message };
  if (cfg.mock && !env.RESEND_API_KEY) {
    log({ evt: "contact", outcome: "mock_sent" });
    return json({ ok: true, mock: true, message: "Sent (mock mode — no email was actually delivered)." }, 200, cors);
  }
  if (!env.RESEND_API_KEY) {
    log({ evt: "contact", outcome: "not_configured" });
    return json({ error: "unavailable", message: "Messaging isn't set up yet — please use the email on PING." }, 503, cors);
  }
  try {
    const r = await sendViaResend(env.RESEND_API_KEY, args, cfg.contactFrom, cfg.contactTo);
    log({ evt: "contact", outcome: r.ok ? "sent" : "send_failed", status: r.status });
    return r.ok
      ? json({ ok: true, message: "Sent. Expect a reply at the email you gave." }, 200, cors)
      : json({ error: "send_failed", message: "Couldn't send right now — please use the email on PING." }, 502, cors);
  } catch {
    log({ evt: "contact", outcome: "send_failed" });
    return json({ error: "send_failed", message: "Couldn't send right now — please use the email on PING." }, 502, cors);
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cfg = loadConfig(env);
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    const cors = corsHeaders(origin, cfg);

    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, enabled: cfg.enabled, mock: cfg.mock, knowledge: knowledge.hash }, 200, cors);
    }

    // Browsers always send Origin on these cross-origin POSTs; anything
    // without an allowed one is not our frontend.
    if (!origin || !cfg.allowedOrigins.includes(origin)) {
      return json({ error: "forbidden_origin" }, 403, {});
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
      return json({ error: "unsupported_media_type" }, 415, cors);
    }

    try {
      if (url.pathname === "/chat") return await handleChat(req, env, cfg, cors, ctx);
      if (url.pathname === "/contact/confirm") return await handleConfirm(req, env, cfg, cors);
    } catch {
      log({ evt: "error", path: url.pathname });
      return json({ error: "internal", message: "Something went wrong." }, 500, cors);
    }
    return json({ error: "not_found" }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
