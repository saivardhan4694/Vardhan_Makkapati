// Minimal Gemini REST client: streamGenerateContent over SSE, yielding
// normalized events. No SDK — keeps the Worker bundle tiny.

export type ModelEvent =
  | { type: "text"; text: string }
  | { type: "call"; name: string; args: unknown }
  | { type: "blocked"; reason: string }
  | { type: "finish"; reason: string }
  | { type: "usage"; promptTokens: number; outputTokens: number };

export interface Content {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  contents: Content[];
  tools: unknown[];
  maxOutputTokens: number;
  thinkingLevel: string | null;
  timeoutMs: number;
  /** Abort if no SSE data arrives within this many ms (status -2). */
  firstByteMs?: number;
  /** Teasing trips the harassment filter at the default level; private mode relaxes that one category. */
  relaxHarassment?: boolean;
}

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SAFETY = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" }));

export function buildGeminiBody(r: Omit<GeminiRequest, "apiKey" | "model" | "timeoutMs">) {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: r.maxOutputTokens,
  };
  if (r.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: r.thinkingLevel };
  return {
    systemInstruction: { parts: [{ text: r.systemPrompt }] },
    contents: r.contents,
    ...(r.tools.length
      ? { tools: [{ functionDeclarations: r.tools }], toolConfig: { functionCallingConfig: { mode: "AUTO" } } }
      : {}),
    generationConfig,
    safetySettings: r.relaxHarassment
      ? SAFETY.map((s) => (s.category === "HARM_CATEGORY_HARASSMENT" ? { ...s, threshold: "BLOCK_ONLY_HIGH" } : s))
      : SAFETY,
  };
}

/** Parses one SSE `data:` JSON chunk from streamGenerateContent. */
export function parseChunk(json: unknown): ModelEvent[] {
  const out: ModelEvent[] = [];
  const c = json as {
    promptFeedback?: { blockReason?: string };
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean; functionCall?: { name?: string; args?: unknown } }[] };
      finishReason?: string;
    }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  if (c?.promptFeedback?.blockReason) out.push({ type: "blocked", reason: c.promptFeedback.blockReason });
  const cand = c?.candidates?.[0];
  for (const p of cand?.content?.parts ?? []) {
    if (p.thought) continue; // never forward thought summaries
    if (typeof p.text === "string" && p.text) out.push({ type: "text", text: p.text });
    if (p.functionCall?.name) out.push({ type: "call", name: p.functionCall.name, args: p.functionCall.args ?? {} });
  }
  if (cand?.finishReason) out.push({ type: "finish", reason: cand.finishReason });
  if (c?.usageMetadata) {
    out.push({
      type: "usage",
      promptTokens: c.usageMetadata.promptTokenCount ?? 0,
      outputTokens: c.usageMetadata.candidatesTokenCount ?? 0,
    });
  }
  return out;
}

/** Splits an SSE byte stream into `data:` payloads. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    // JSON escapes \r inside strings, so a raw CR is only ever a line ending
    // (and a CRLF can be split across two network chunks).
    if (value) buf += value.replace(/\r/g, "");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield data;
    }
    if (done) break;
  }
  if (buf.trim().startsWith("data:")) yield buf.trim().slice(5).trimStart();
}

export async function* streamGemini(r: GeminiRequest): AsyncGenerator<ModelEvent> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(r.model)}:streamGenerateContent?alt=sse`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), r.timeoutMs);
  const firstTimer = r.firstByteMs ? setTimeout(() => ctrl.abort("slow"), r.firstByteMs) : undefined;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": r.apiKey },
      body: JSON.stringify(buildGeminiBody(r)),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      // Body may describe the error; log only its status line, never echo it.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new UpstreamError(res.status, detail);
    }
    for await (const data of sseData(res.body)) {
      clearTimeout(firstTimer);
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      yield* parseChunk(json);
    }
  } catch (e) {
    if (ctrl.signal.reason === "slow") throw new UpstreamError(-2, "no first chunk in time");
    throw e;
  } finally {
    clearTimeout(timer);
    clearTimeout(firstTimer);
  }
}

// Overloaded / rate-limited / slow-to-start primaries are worth one retry on
// another model (separate free-tier quota). Anything else is a real error.
const RETRYABLE = new Set([-2, 429, 500, 502, 503, 504]);

/**
 * Streams from the primary model; if it fails BEFORE producing anything with
 * a retryable error, streams the whole answer from the fallback instead.
 * Never switches mid-answer.
 */
export async function* streamWithFallback(
  r: GeminiRequest,
  fallbackModel: string | null,
  onFallback?: (status: number, model: string) => void
): AsyncGenerator<ModelEvent> {
  let started = false;
  try {
    for await (const ev of streamGemini(r)) {
      started = true;
      yield ev;
    }
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : undefined;
    if (started || !fallbackModel || fallbackModel === r.model || status === undefined || !RETRYABLE.has(status)) {
      throw e;
    }
    onFallback?.(status, fallbackModel);
    yield* streamGemini({ ...r, model: fallbackModel, firstByteMs: undefined });
  }
}
