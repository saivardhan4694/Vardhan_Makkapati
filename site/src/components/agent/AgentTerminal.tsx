// The portfolio agent's UI: a terminal docked bottom-left in the same
// PORTFOLIO_OS style as the boot loader — not a chat bubble. Opens from the
// `>_ ask` trigger or the "/" hotkey, streams answers from the Worker, and
// executes the tool calls it returns against the live scene.
//
// Renders nothing at all unless VITE_AGENT_API_URL is set at build time, so
// the site can ship this code before the Worker exists.

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import "../../styles/agent.css";
import AgentText from "./AgentText";
import { runTool } from "./actions";
import {
  AGENT_API_URL,
  AgentHttpError,
  confirmContact,
  getTurnstileToken,
  streamChat,
  type AgentEvent,
  type HistoryItem,
} from "./agentApi";

const MAX_INPUT = 500;
const MAX_TURNS = 12;
const HISTORY_SENT = 6;

const SUGGESTIONS = [
  "What has he built with agents?",
  "What's his tech stack?",
  "How do I get in touch?",
];

interface ToolLine {
  name: string;
  args: Record<string, unknown>;
  result: string | null;
}

interface ContactDraft {
  id: string;
  name: string;
  email: string;
  message: string;
  expiresAt: number;
}

type Entry =
  | { kind: "user"; id: number; text: string }
  | { kind: "agent"; id: number; text: string; streaming: boolean; tools: ToolLine[] }
  | { kind: "notice"; id: number; text: string }
  | { kind: "error"; id: number; text: string }
  | { kind: "system"; id: number; text: string }
  | {
      kind: "contact";
      id: number;
      draft: ContactDraft;
      status: "pending" | "sending" | "sent" | "cancelled" | "failed";
      note?: string;
    };

// Omit that distributes over the union, so each variant keeps its own fields.
type NewEntry = Entry extends infer E ? (E extends Entry ? Omit<E, "id"> : never) : never;

const HELP_TEXT =
  "Ask anything about Sai's work: projects, stack, experience, education, or how to reach him.\n" +
  "Commands: help · clear · exit   Keys: / open · Esc close";

const deadline = (sec: number) => Date.now() + sec * 1000;

function readDebugPref(): boolean {
  try {
    return localStorage.getItem("agent-debug") === "1";
  } catch {
    return false;
  }
}

function formatArgs(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
}

export default function AgentTerminal() {
  if (!AGENT_API_URL) return null;
  return <AgentTerminalInner />;
}

function AgentTerminalInner() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(readDebugPref);

  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpen = useRef(false);

  const userTurns = entries.filter((e) => e.kind === "user").length;

  // Focus moves into the prompt on open and back to the trigger on close.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // "/" opens from anywhere that isn't a text field; Esc closes.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !open && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest output in view (output grows from the bottom, like the boot log).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  const push = useCallback((e: NewEntry) => {
    const id = nextId.current++;
    setEntries((list) => [...list, { ...e, id } as Entry]);
    return id;
  }, []);

  const patchAgent = (id: number, fn: (e: Extract<Entry, { kind: "agent" }>) => Partial<Entry>) =>
    setEntries((list) => list.map((e) => (e.id === id && e.kind === "agent" ? ({ ...e, ...fn(e) } as Entry) : e)));

  const patchContact = (id: number, patch: Partial<Extract<Entry, { kind: "contact" }>>) =>
    setEntries((list) => list.map((e) => (e.id === id && e.kind === "contact" ? ({ ...e, ...patch } as Entry) : e)));

  const toggleDebug = () => {
    setDebug((d) => {
      try {
        localStorage.setItem("agent-debug", d ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !d;
    });
  };

  const buildHistory = (): HistoryItem[] => {
    const h: HistoryItem[] = [];
    for (const e of entries) {
      if (e.kind === "user") h.push({ role: "user", text: e.text });
      else if (e.kind === "agent" && e.text.trim()) h.push({ role: "model", text: e.text.slice(0, 2000) });
    }
    return h.slice(-HISTORY_SENT);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");

    const cmd = text.toLowerCase();
    if (cmd === "clear") {
      abortRef.current?.abort();
      setEntries([]);
      return;
    }
    if (cmd === "exit") {
      setOpen(false);
      return;
    }
    if (cmd === "help") {
      push({ kind: "user", text });
      push({ kind: "system", text: HELP_TEXT });
      return;
    }
    if (userTurns >= MAX_TURNS) {
      push({ kind: "notice", text: "Session turn limit reached. Type `clear` to start a new one." });
      return;
    }

    const history = buildHistory();
    push({ kind: "user", text });
    const agentId = push({ kind: "agent", text: "", streaming: true, tools: [] });
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const onEvent = (ev: AgentEvent) => {
      switch (ev.event) {
        case "text":
          patchAgent(agentId, (e) => ({ text: e.text + ev.data.delta }));
          break;
        case "reset":
          patchAgent(agentId, () => ({ text: ev.data.text }));
          break;
        case "tool": {
          const result = runTool(ev.data.name, ev.data.args ?? {});
          patchAgent(agentId, (e) => ({ tools: [...e.tools, { name: ev.data.name, args: ev.data.args ?? {}, result }] }));
          break;
        }
        case "contact_pending":
          patchAgent(agentId, (e) => ({
            tools: [...e.tools, { name: "send_contact_message", args: { name: ev.data.name }, result: "awaiting confirm" }],
          }));
          push({
            kind: "contact",
            draft: {
              id: ev.data.id,
              name: ev.data.name,
              email: ev.data.email,
              message: ev.data.message,
              expiresAt: deadline(ev.data.expiresInSec),
            },
            status: "pending",
          });
          break;
        case "notice":
          patchAgent(agentId, (e) => ({ text: e.text ? `${e.text}\n${ev.data.text}` : ev.data.text }));
          break;
        case "error":
          push({ kind: "error", text: ev.data.text });
          break;
        case "done":
          break;
      }
    };

    try {
      const turnstileToken = await getTurnstileToken(turnstileRef.current);
      await streamChat({ message: text, history, turnstileToken }, onEvent, ctrl.signal);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const msg =
        err instanceof AgentHttpError ? err.message : "Can't reach the assistant right now. Check your connection.";
      push({ kind: "error", text: msg });
    } finally {
      patchAgent(agentId, () => ({ streaming: false }));
      // Drop an agent entry that ended up empty (e.g. request rejected).
      setEntries((list) => list.filter((e) => !(e.id === agentId && e.kind === "agent" && !e.text && !e.tools.length)));
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onConfirm = async (entry: Extract<Entry, { kind: "contact" }>) => {
    if (deadline(0) > entry.draft.expiresAt) {
      patchContact(entry.id, { status: "failed", note: "Draft expired — ask me to prepare it again." });
      return;
    }
    patchContact(entry.id, { status: "sending" });
    try {
      const token = await getTurnstileToken(turnstileRef.current);
      const note = await confirmContact(entry.draft.id, token);
      patchContact(entry.id, { status: "sent", note });
    } catch (err) {
      patchContact(entry.id, {
        status: "failed",
        note: err instanceof AgentHttpError ? err.message : "Couldn't send — please use the email on PING.",
      });
    }
  };

  const onPanelKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={open ? "agent-trigger agent-trigger--hidden" : "agent-trigger"}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="agent-panel"
        aria-keyshortcuts="/"
        tabIndex={open ? -1 : 0}
      >
        <span className="accent">&gt;_</span> ask
        <kbd className="agent-kbd">/</kbd>
      </button>

      <section
        id="agent-panel"
        className={open ? "agent-panel agent-panel--open" : "agent-panel"}
        role="dialog"
        aria-modal="false"
        aria-label="Ask the portfolio assistant"
        aria-hidden={!open}
        inert={!open}
        onKeyDown={onPanelKey}
      >
        <div className="agent-scan" aria-hidden="true" />
        <header className="agent-head">
          <span>
            <span className="accent">agent</span>@portfolio_os <span className="agent-dim">tty2</span>
          </span>
          <span className="agent-head-actions">
            <button
              type="button"
              className={debug ? "agent-chip agent-chip--on" : "agent-chip"}
              onClick={toggleDebug}
              aria-pressed={debug}
              title="Show the tool calls the assistant makes"
            >
              under the hood
            </button>
            <button type="button" className="agent-chip" onClick={() => void send("clear")} disabled={busy}>
              clear
            </button>
            <button type="button" className="agent-close" onClick={() => setOpen(false)} aria-label="Close assistant (Esc)">
              ×
            </button>
          </span>
        </header>

        <div className="agent-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
          {entries.length === 0 && (
            <div className="agent-intro">
              <div className="agent-dim">PORTFOLIO_AGENT v1 — answers come only from this site's data.</div>
              <div className="agent-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="agent-suggest-btn" onClick={() => void send(s)}>
                    <span className="accent">$</span> {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((e) => {
            switch (e.kind) {
              case "user":
                return (
                  <div key={e.id} className="agent-line agent-line--user">
                    <span className="agent-prompt">visitor@portfolio:~$</span> <span>{e.text}</span>
                  </div>
                );
              case "agent":
                return (
                  <div key={e.id} className="agent-line agent-line--agent">
                    {debug &&
                      e.tools.map((t, i) => (
                        <div key={i} className="agent-tool">
                          <span className={t.result ? "accent" : "agent-err"}>{t.result ? "[tool]" : "[skip]"}</span>{" "}
                          {t.name}({formatArgs(t.args)}){t.result ? ` → ${t.result}` : ""}
                        </div>
                      ))}
                    <div className="agent-out">
                      <AgentText text={e.text} />
                      {e.streaming && <span className="cursor" aria-hidden="true" />}
                    </div>
                  </div>
                );
              case "notice":
              case "system":
                return (
                  <div key={e.id} className="agent-line agent-dim agent-out">
                    {e.text}
                  </div>
                );
              case "error":
                return (
                  <div key={e.id} className="agent-line agent-out" role="alert">
                    <span className="agent-err">[ERR]</span> {e.text}
                  </div>
                );
              case "contact":
                return (
                  <div key={e.id} className="agent-line agent-contact">
                    <div className="agent-dim">--- outgoing message (not sent yet) ---</div>
                    <div>
                      <span className="agent-dim">from:</span> {e.draft.name} &lt;{e.draft.email}&gt;
                    </div>
                    <div className="agent-out">
                      <span className="agent-dim">body:</span> {e.draft.message}
                    </div>
                    {e.status === "pending" && (
                      <div className="agent-contact-actions">
                        <button type="button" className="agent-chip agent-chip--on" onClick={() => void onConfirm(e)}>
                          [ y ] send to Sai
                        </button>
                        <button type="button" className="agent-chip" onClick={() => patchContact(e.id, { status: "cancelled" })}>
                          [ n ] cancel
                        </button>
                      </div>
                    )}
                    {e.status === "sending" && <div className="agent-dim">sending…</div>}
                    {e.status === "cancelled" && <div className="agent-dim">cancelled — nothing was sent.</div>}
                    {e.status === "sent" && (
                      <div>
                        <span className="accent">[OK]</span> {e.note}
                      </div>
                    )}
                    {e.status === "failed" && (
                      <div>
                        <span className="agent-err">[ERR]</span> {e.note}
                      </div>
                    )}
                  </div>
                );
            }
          })}
        </div>

        <form className="agent-form" onSubmit={onSubmit}>
          <label htmlFor="agent-input" className="agent-prompt">
            ~$
          </label>
          <input
            id="agent-input"
            ref={inputRef}
            className="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
            maxLength={MAX_INPUT}
            placeholder={busy ? "thinking…" : "ask about projects, stack, contact…"}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-label="Message the portfolio assistant"
            disabled={busy}
          />
          <span className="agent-count" aria-hidden="true">
            {input.length > MAX_INPUT * 0.8 ? `${MAX_INPUT - input.length}` : ""}
          </span>
          <button type="submit" className="agent-send" disabled={busy || !input.trim()} aria-label="Send">
            ↵
          </button>
        </form>
        <div ref={turnstileRef} className="agent-turnstile" />
      </section>
    </>
  );
}
