import { memo } from "react";

const STATUS_ITEMS = [
  { label: "STATUS", value: "● ONLINE", accent: true },
  { label: "AVAILABILITY", value: "OPEN_TO_WORK", accent: true },
  { label: "LOOKING_FOR", value: "AGENTIC AI / ML ROLES" },
  { label: "RESPONSE_TIME", value: "< 24H" },
];

interface Channel {
  id: string;
  host: string;
  href: string | null;
  verb: string;
  latency: string;
}

// `href: null` renders the row as a placeholder — visible, in-theme, but not
// a live link — the same convention the other pages use for unfilled details
// like [YOUR_COMPANY]. Only entries with a real destination are clickable.
const CHANNELS: Channel[] = [
  {
    id: "EMAIL",
    host: "makkapatimrk@gmail.com",
    href: "mailto:makkapatimrk@gmail.com",
    verb: "SEND",
    latency: "0.2ms",
  },
  {
    id: "GITHUB",
    host: "github.com/saivardhan4694",
    href: "https://github.com/saivardhan4694",
    verb: "OPEN",
    latency: "0.4ms",
  },
  {
    id: "LINKEDIN",
    host: "linkedin.com/in/makkapatisaivardhan",
    href: "https://www.linkedin.com/in/makkapatisaivardhan/",
    verb: "OPEN",
    latency: "0.6ms",
  },
  // Served straight from site/public/ — Vite exposes that directory at the
  // site root, so this path needs no build step of its own.
  { id: "RESUME", host: "resume.pdf", href: "./resume.pdf", verb: "GET", latency: "0.8ms" },
];

const LIVE_COUNT = CHANNELS.filter((c) => c.href).length;

function Ping() {
  return (
    <div className="panel panel--ping">
      <div className="panel-kicker">&gt; PING — CONTACT.SYS</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">REACH_OUT</div>
          <p>
            Open to agentic AI and ML engineering roles — building the systems
            around the model, not just calling one. If that's what you're
            hiring for, the channels below all reach me.
          </p>
          <p>Pick whichever one you'd actually use.</p>
        </div>

        <div className="box screen-id">
          {STATUS_ITEMS.map((s) => (
            <div className="screen-id-row" key={s.label}>
              <span className="screen-id-key">{s.label}</span>
              <span className={s.accent ? "screen-id-val accent" : "screen-id-val"}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="box ping-out">
        <div className="term-prompt term-prompt--sm">
          <span className="term-user">visitor@portfolio</span>
          <span className="term-path">:~$</span> ping saivardhan.dev -c {CHANNELS.length}
        </div>

        <div className="ping-rows">
          {CHANNELS.map((c, i) => {
            const live = Boolean(c.href);
            const row = (
              <>
                <span className="ping-seq">seq={i}</span>
                <span className="ping-host">{c.host}</span>
                <span className="ping-latency">time={c.latency}</span>
                <span className="ping-ttl">ttl=64</span>
                <span className="ping-verb">{live ? `[ ${c.verb} → ]` : "[ unset ]"}</span>
              </>
            );
            const style = { animationDelay: `${i * 110}ms` };
            return live ? (
              <a
                key={c.id}
                className="ping-row ping-row--live"
                style={style}
                href={c.href!}
                target={c.id === "GITHUB" ? "_blank" : undefined}
                rel={c.id === "GITHUB" ? "noopener noreferrer" : undefined}
              >
                {row}
              </a>
            ) : (
              <div key={c.id} className="ping-row ping-row--placeholder" style={style}>
                {row}
              </div>
            );
          })}
        </div>

        <div className="ping-summary">
          <span className="term-path">--- saivardhan.dev ping statistics ---</span>
          <br />
          {CHANNELS.length} packets transmitted, {LIVE_COUNT} received,{" "}
          {Math.round(((CHANNELS.length - LIVE_COUNT) / CHANNELS.length) * 100)}% packet loss
          <span className="cursor" />
        </div>
      </div>

      <div className="box box--status-line">
        <div className="status-line-item">
          <span>PACKETS_SENT</span>
          <span className="status-line-dots" />
          <span className="accent">{String(CHANNELS.length).padStart(2, "0")}</span>
        </div>
        <div className="status-line-item">
          <span>CHANNELS_LIVE</span>
          <span className="status-line-dots" />
          <span className="accent">{String(LIVE_COUNT).padStart(2, "0")}</span>
        </div>
        <div className="status-line-item">
          <span>LINK</span>
          <span className="status-line-dots" />
          <span className="accent">STABLE</span>
        </div>
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(Ping);
