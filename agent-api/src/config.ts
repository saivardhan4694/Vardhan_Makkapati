// Runtime configuration. Every limit is an env var (wrangler.jsonc `vars`)
// with a conservative default, so the free tier can't be exhausted by a
// misconfiguration — an unset or garbage value falls back to the default.

export interface Env {
  LIMITER: DurableObjectNamespace;

  // Secrets (wrangler secret put ...)
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  IP_HASH_SALT?: string;

  // Vars
  GEMINI_MODEL?: string;
  THINKING_LEVEL?: string;
  ALLOWED_ORIGINS?: string;
  MOCK_LLM?: string;
  AGENT_ENABLED?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  MAX_INPUT_CHARS?: string;
  MAX_OUTPUT_TOKENS?: string;
  THINKING_TOKEN_HEADROOM?: string;
  MAX_TURNS?: string;
  HISTORY_WINDOW?: string;
  RATE_SHORT_LIMIT?: string;
  RATE_SHORT_WINDOW_SEC?: string;
  RATE_DAILY_LIMIT?: string;
  GLOBAL_DAILY_CAP?: string;
  CONTACT_DAILY_LIMIT?: string;
  CONTACT_GLOBAL_DAILY_CAP?: string;
  UPSTREAM_TIMEOUT_MS?: string;
}

export interface Config {
  model: string;
  thinkingLevel: string | null;
  allowedOrigins: string[];
  mock: boolean;
  enabled: boolean;
  contactTo: string;
  contactFrom: string;
  maxInputChars: number;
  maxOutputTokens: number;
  thinkingHeadroom: number;
  maxTurns: number;
  historyWindow: number;
  rateShortLimit: number;
  rateShortWindowSec: number;
  rateDailyLimit: number;
  globalDailyCap: number;
  contactDailyLimit: number;
  contactGlobalDailyCap: number;
  upstreamTimeoutMs: number;
  turnstileEnabled: boolean;
}

export const DEFAULT_ORIGINS = [
  "https://saivardhan4694.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function int(v: string | undefined, def: number, min: number, max: number): number {
  if (v === undefined || v.trim() === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const truthy = (v: string | undefined) => !!v && /^(1|true|yes|on)$/i.test(v.trim());

export function loadConfig(env: Env): Config {
  const origins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const thinking = (env.THINKING_LEVEL ?? "low").trim().toLowerCase();
  return {
    model: (env.GEMINI_MODEL ?? "").trim() || "gemini-3.8-flash",
    thinkingLevel: thinking === "" || thinking === "off" || thinking === "default" ? null : thinking,
    allowedOrigins: origins.length ? origins : DEFAULT_ORIGINS,
    mock: truthy(env.MOCK_LLM),
    // Kill-switch: AGENT_ENABLED=0 makes every chat return the fallback.
    enabled: env.AGENT_ENABLED === undefined ? true : truthy(env.AGENT_ENABLED),
    contactTo: (env.CONTACT_TO ?? "").trim() || "makkapatimrk@gmail.com",
    contactFrom: (env.CONTACT_FROM ?? "").trim() || "Portfolio Agent <onboarding@resend.dev>",
    maxInputChars: int(env.MAX_INPUT_CHARS, 500, 20, 4000),
    maxOutputTokens: int(env.MAX_OUTPUT_TOKENS, 400, 50, 4000),
    thinkingHeadroom: int(env.THINKING_TOKEN_HEADROOM, 600, 0, 8000),
    maxTurns: int(env.MAX_TURNS, 12, 1, 100),
    historyWindow: int(env.HISTORY_WINDOW, 6, 0, 40),
    rateShortLimit: int(env.RATE_SHORT_LIMIT, 8, 1, 1000),
    rateShortWindowSec: int(env.RATE_SHORT_WINDOW_SEC, 600, 10, 86400),
    rateDailyLimit: int(env.RATE_DAILY_LIMIT, 30, 1, 10000),
    globalDailyCap: int(env.GLOBAL_DAILY_CAP, 100, 0, 100000),
    contactDailyLimit: int(env.CONTACT_DAILY_LIMIT, 3, 0, 100),
    contactGlobalDailyCap: int(env.CONTACT_GLOBAL_DAILY_CAP, 40, 0, 1000),
    upstreamTimeoutMs: int(env.UPSTREAM_TIMEOUT_MS, 20000, 2000, 60000),
    turnstileEnabled: !!env.TURNSTILE_SECRET,
  };
}
