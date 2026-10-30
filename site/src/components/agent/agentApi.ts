// Client for the portfolio agent Worker (agent-api/). Speaks the Worker's
// SSE contract: event: text|reset|tool|contact_pending|notice|error|done.

export const AGENT_API_URL: string = (import.meta.env.VITE_AGENT_API_URL ?? "").trim().replace(/\/+$/, "");
export const TURNSTILE_SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

export interface HistoryItem {
  role: "user" | "model";
  text: string;
}

export type AgentEvent =
  | { event: "text"; data: { delta: string } }
  | { event: "reset"; data: { text: string } }
  | { event: "tool"; data: { name: string; args: Record<string, unknown> } }
  | {
      event: "contact_pending";
      data: { id: string; name: string; email: string; message: string; expiresInSec: number };
    }
  | { event: "notice"; data: { code: string; text: string } }
  | { event: "error"; data: { code: string; text: string } }
  | { event: "done"; data: { outcome: string } };

export class AgentHttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function errorFrom(res: Response): Promise<AgentHttpError> {
  let code = "http_" + res.status;
  let message = "The assistant is unavailable right now.";
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    if (j.error) code = j.error;
    if (j.message) message = j.message;
  } catch {
    /* non-JSON error body */
  }
  return new AgentHttpError(res.status, code, message);
}

export async function streamChat(
  body: { message: string; history: HistoryItem[]; turnstileToken?: string },
  onEvent: (e: AgentEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(`${AGENT_API_URL}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += value.replace(/\r/g, "");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let name = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try {
        onEvent({ event: name, data: JSON.parse(data.join("\n")) } as AgentEvent);
      } catch {
        /* ignore malformed event */
      }
    }
    if (done) break;
  }
}

export async function confirmContact(id: string, turnstileToken?: string): Promise<string> {
  const res = await fetch(`${AGENT_API_URL}/contact/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, turnstileToken }),
  });
  if (!res.ok) throw await errorFrom(res);
  const j = (await res.json()) as { message?: string };
  return j.message ?? "Sent.";
}

// ---- optional Cloudflare Turnstile ---------------------------------------

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
}

let turnstileReady: Promise<TurnstileApi> | null = null;
let widgetId: string | null = null;
let pendingToken: ((t: string) => void) | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (turnstileReady) return turnstileReady;
  turnstileReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api) resolve(api);
      else reject(new Error("turnstile missing"));
    };
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  });
  return turnstileReady;
}

/** Returns a fresh single-use token, or undefined when Turnstile is off. */
export async function getTurnstileToken(container: HTMLElement | null): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY || !container) return undefined;
  const api = await loadTurnstile();
  return new Promise((resolve) => {
    pendingToken = resolve;
    if (widgetId === null) {
      widgetId = api.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        theme: "dark",
        callback: (t: string) => pendingToken?.(t),
        "error-callback": () => pendingToken?.(""),
      });
    } else {
      api.reset(widgetId);
    }
    api.execute(widgetId);
  });
}
