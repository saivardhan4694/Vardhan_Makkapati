# Portfolio agent API

A Cloudflare Worker that powers the `>_ ask` terminal on the portfolio site. It answers questions
about Sai's work using **only** the site's own content, can move the site's camera, filter or open
projects, and can pass a visitor's message on by email after the visitor confirms it.

- Model: Google Gemini Flash (free tier) via REST `streamGenerateContent` (SSE). Model id is a var (`GEMINI_MODEL`).
- Text only. No RAG: the whole knowledge base (~6k tokens) goes into the system prompt.
- Runs on the Workers **Free** plan.

## Architecture

```
site/src/data/*.ts ──(scripts/build-knowledge.ts)──▶ src/knowledge.json ──▶ system prompt + tool enums
                                                                      │
browser (site/src/components/agent/)                                  ▼
  POST /chat {message, history} ──▶ Worker: origin check → validate → [Turnstile] → kill switch
                                      → Durable Object limits (per-IP + global daily budget)
                                      → Gemini stream → output guards + tool whitelist
  ◀── SSE: text | reset | tool | contact_pending | notice | error | done
  executes `tool` events (camera / BUILDS filter / open repo)
  POST /contact/confirm {id} ──▶ Worker: re-check limits → Resend email to CONTACT_TO
```

| File | Role |
| --- | --- |
| `scripts/build-knowledge.ts` | Compiles the site's data modules into `src/knowledge.json`. Template placeholders (`[YOUR_COMPANY]`, `20XX`) are dropped so the bot never states them. |
| `src/index.ts` | Routes, CORS, request flow, SSE, anonymised logging. |
| `src/pipeline.ts` | One chat turn: streams text, enforces the tool whitelist, prompt-leak tripwire, output cap, fallbacks. |
| `src/guard.ts` | Input validation/sanitising, turn limit, history window, delimiter wrapping, injection heuristics, IP hashing. |
| `src/tools.ts` | Tool declarations + server-side argument validation (ids checked against knowledge). |
| `src/prompt.ts` | System prompt (scope, grounding, security, tool and citation rules). |
| `src/limits.ts` / `src/limiter-do.ts` | Fixed-window counters (pure logic) and the Durable Object that stores them + pending contact drafts. |
| `src/gemini.ts` / `src/mock.ts` | Gemini REST/SSE client, and the `MOCK_LLM=1` canned model. |
| `src/contact.ts` | Resend email (plain text, `reply_to` = visitor). |

The single source of truth is `site/src/data/` (`projects.ts`, `profile.ts`, `highlights.ts`, `graph.ts`).
The section components render from those same modules. `knowledge.json` is committed, and
`npm test` (also run in CI by `.github/workflows/agent-tests.yml`) fails if it no longer matches the
site data. `npm run deploy` regenerates it first, so a deploy always uses what the site shows.

### Tools

| Tool | Executed by | Validation |
| --- | --- | --- |
| `navigate_to(section)` | browser (camera jump, or scroll on the linear layout) | section id or on-screen label from knowledge |
| `filter_projects(category)` | browser (BUILDS filter) | `all` or a known category |
| `open_project(id)` | browser (BUILDS selection) | exact repo id from knowledge |
| `get_contact()` | browser (jump to PING) + server prints the channels | no args |
| `send_contact_message(name,email,message)` | **server**, in two steps | name ≤80 plain text, valid email, message 10–1000 chars, no extra fields |

`send_contact_message` never sends anything by itself. The server stores a draft (10 min TTL, bound to
the visitor's hashed IP) and the UI shows it with **[ y ] send / [ n ] cancel** buttons. The email
only goes out when the visitor presses confirm (`POST /contact/confirm`). So a prompt injection can't
send mail.

Every reply uses one model call. When the model calls a tool without writing text, the Worker writes
a short deterministic line instead of making a second call. That keeps quota use at one request per
message.

## Guardrails

- **Scope:** the prompt allows only Sai, his work, contact and site navigation. Anything else gets a
  one-line refusal, so the bot can't be used as a free general-purpose LLM proxy.
- **Grounding:** the prompt allows facts from `<knowledge>` only. Otherwise the bot says the fact is
  not in its data and points to contact.
- **Prompt injection:** visitor text is wrapped in `<visitor_message>` and treated as data. Forged
  delimiter tags are neutralised. Known jailbreak phrasings add a reminder and are counted in logs.
  Tool args are untrusted and checked server-side.
- **Leak tripwire:** the prompt carries a canary token and marker phrases. If either shows up in the
  output, the stream is cut and replaced. Trailing characters are held back so a marker split across
  chunks never reaches the browser.
- **Input:** JSON body ≤32 KB, message ≤`MAX_INPUT_CHARS`, control/bidi/zero-width characters
  stripped, NFKC-normalised. Gemini safety settings are set to `BLOCK_MEDIUM_AND_ABOVE`.
- **Output:** `maxOutputTokens` = `MAX_OUTPUT_TOKENS` + `THINKING_TOKEN_HEADROOM` (Gemini 3 counts
  thinking tokens against the limit). There is also a hard character cap. The browser renders text
  only, with no HTML. Only citation markers that match the site's data and URLs on an allowlist of
  Sai's profiles become clickable.
- **CORS / origin:** only `ALLOWED_ORIGINS` (GitHub Pages + localhost dev). Requests without an
  allowed `Origin` get a 403.
- **Turnstile (optional):** set `TURNSTILE_SECRET` on the Worker and `VITE_TURNSTILE_SITE_KEY` on the site.
- **Privacy:** IPs are only used as `sha256(IP_HASH_SALT|ip)` keys for rate limits. Logs hold one JSON
  line per request (outcome, latency, tool names, token counts) and no IP, hash or message text.
  Contact details exist only in the short-lived draft and the email itself.
- **Graceful fallback:** if the daily budget is spent, the kill switch is off, the key is missing or
  Gemini fails, the visitor gets a friendly note pointing to BUILDS and the email address instead of
  an error.

## Limits (all `vars` in `wrangler.jsonc`)

| Var | Default | Meaning |
| --- | --- | --- |
| `RATE_SHORT_LIMIT` / `RATE_SHORT_WINDOW_SEC` | 8 / 600 | messages per IP per 10 min |
| `RATE_DAILY_LIMIT` | 30 | messages per IP per UTC day |
| `GLOBAL_DAILY_CAP` | 400 | all visitors combined per UTC day (keep it **below** your Gemini free-tier RPD) |
| `CONTACT_DAILY_LIMIT` / `CONTACT_GLOBAL_DAILY_CAP` | 3 / 40 | confirmed emails per IP / overall per day |
| `MAX_INPUT_CHARS` | 500 | max visitor message length |
| `MAX_OUTPUT_TOKENS` / `THINKING_TOKEN_HEADROOM` | 400 / 600 | answer budget / extra budget for thinking |
| `MAX_TURNS` / `HISTORY_WINDOW` | 12 / 6 | turns per conversation / past messages sent to the model |
| `AGENT_ENABLED` | 1 | kill switch. Set to `0` and redeploy to serve only the fallback |
| `GEMINI_MODEL` / `THINKING_LEVEL` | `gemini-3.5-flash-lite` / `minimal` | model id; `off` omits `thinkingConfig` |
| `UPSTREAM_TIMEOUT_MS` | 20000 | Gemini request timeout |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.1-flash-lite` | retried once if the primary returns 429/5xx or sends nothing within `FIRST_BYTE_TIMEOUT_MS`; never switches mid-answer. Separate free-tier quota, so it also adds capacity. `off` disables |
| `FIRST_BYTE_TIMEOUT_MS` | 3500 | how long to wait for the primary's first chunk before falling back |

Free-tier quotas differ by model and change over time. Check yours at
https://aistudio.google.com/rate-limit and set `GLOBAL_DAILY_CAP` to about 80% of that model's
requests-per-day. If the model is rate-limited anyway, visitors get the fallback note.
Default is `gemini-3.5-flash-lite` (free tier: 15 RPM, 250K TPM, 500 RPD at time of writing). Gemma 4 has a higher RPD but only 16K TPM, and every request carries ~7K tokens of knowledge, so it fits only ~2 requests per minute.

### Why a Durable Object (not KV or the Rate Limiting binding)

- **KV** is eventually consistent, so counters race. The Free plan also caps KV at about 1,000
  writes per day, and one write per message would use that up.
- The **Workers Rate Limiting binding** only supports 10s or 60s periods. It can't express "30 per
  day" or a global daily budget.
- **One SQLite-backed Durable Object** is strongly consistent (requests are serialised), available on
  the Free plan, and handles a portfolio's traffic easily. It also holds the pending contact drafts.
  An alarm cleans up expired keys every 6 hours.

## Owner setup (one time)

You need Node ≥ 22.18 and a free Cloudflare account. Run all commands from `agent-api/`.

1. **Get a Gemini key:** https://aistudio.google.com/apikey → *Create API key* (free tier).
2. **Get a Resend key** (optional, only for the contact handoff): sign up at https://resend.com
   **with makkapatimrk@gmail.com** (the test sender `onboarding@resend.dev` can only deliver to the
   account owner's address), then *API Keys → Create*.
3. Install and log in:
   ```sh
   cd agent-api
   npm install
   npx wrangler login
   ```
4. Add the secrets (each command prompts for the value):
   ```sh
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put RESEND_API_KEY      # optional
   npx wrangler secret put IP_HASH_SALT        # optional: any random string
   ```
   No KV namespace or other resources need to be created. The Durable Object is created by the
   migration in `wrangler.jsonc` on first deploy.
5. Deploy: `npm run deploy`. This regenerates knowledge, typechecks, runs the tests, then runs
   `wrangler deploy`. Note the URL it prints, e.g. `https://portfolio-agent-api.<you>.workers.dev`.
   Check it with `curl https://portfolio-agent-api.<you>.workers.dev/health`.
6. Connect the site: GitHub repo → *Settings → Secrets and variables → Actions → Variables → New
   repository variable*: `VITE_AGENT_API_URL` = the Worker URL (no trailing slash).
7. Merge the `claude/portfolio-agent` branch into `main`. The Pages deploy builds with the variable,
   and the `>_ ask` button appears.

Optional Turnstile: create a widget at Cloudflare dashboard → Turnstile (hostname
`saivardhan4694.github.io`). Then run `npx wrangler secret put TURNSTILE_SECRET` and add the Actions
variable `VITE_TURNSTILE_SITE_KEY`.

When you change site content, run `npm run deploy` here again so the bot's knowledge matches (CI
reminds you if `knowledge.json` is stale).

## Local development

```sh
cd agent-api
npm run dev:mock          # worker on :8787 with MOCK_LLM=1 (no key, canned streamed replies + tool calls)
# or: cp .dev.vars.example .dev.vars, put a real GEMINI_API_KEY in it, then: npm run dev

cd ../site
VITE_AGENT_API_URL=http://127.0.0.1:8787 npm run dev     # open http://localhost:5173 and press "/"
```

Mock trigger words: "agent/project" (filter tool + citations), "stack" (navigate), "contact/email"
(get_contact), "send ... @" (contact draft), "weather" (refusal), "system prompt" (injection refusal),
"leak-test" (tripwire), "bad tool" (rejected tools), "fail-test" (upstream fallback).

### Phones and tablets

On the site's linear layout (phones, tablets, small windows) the terminal is a full-width bottom
sheet. It sizes itself with `dvh` and `visualViewport`, so the prompt stays above the on-screen keyboard.
It respects the safe-area insets and locks page scroll while open. The launcher sits bottom-right.
Tools run through the same `nav-node` / `builds-cmd` events in both layouts. The BUILDS accordion
filters and expands the repo, then scrolls it into view. When a tool or citation moves the page, the
sheet shrinks to a "peek" strip so the visitor can see the result. Tap ▴ or the prompt to expand it
again. The desktop camera panel is unchanged.

In both layouts, navigating to the section that is already on screen does not travel (no camera
zoom-out, no scroll). The section gets a short "focus ping" instead. A BUILDS filter or open on
BUILDS flashes the chip or row that changed. The browser decides this on its own, and the
"under the hood" tool line says `already on <SECTION>`.

`site/scripts/agent-check.mjs` (`npm run test:agent` in `site/`) is an opt-in Playwright check of
the panel at 4 mobile sizes and 1440x900. It needs this mock worker running with raised limits and a
site build that has `VITE_AGENT_API_URL` set. See the header of that file. CI does not run it. It
uses Chromium emulation, so the real iOS Safari keyboard still needs a check on a device.

## Tests and evals

- `npm test`: deterministic unit tests (`node:test`, no network). Covers validation, the tool
  whitelist and argument abuse, rate-limit windows and caps, the pipeline (leaks, truncation,
  fallbacks, contact flow), SSE parsing and knowledge drift. Runs in CI.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run eval`: **live** eval with 39 golden Q&As (grounding) and 26 red-team prompts (jailbreaks,
  injection, prompt leaks, off-topic, made-up facts, tool-argument abuse, harmful). It reports
  grounding and refusal pass rates and uses about 65 model requests, so run it by hand against a dev
  worker with high limits:
  ```sh
  npx wrangler dev --var RATE_SHORT_LIMIT:1000 --var RATE_DAILY_LIMIT:1000 --var GLOBAL_DAILY_CAP:1000
  npm run eval                   # EVAL_DELAY_MS=7000 by default to stay under free-tier RPM
  ```
