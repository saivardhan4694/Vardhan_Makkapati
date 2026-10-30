import { memo } from "react";
import { CHANNELS, PING_PARAGRAPHS, PING_STATUS as STATUS_ITEMS } from "../../data/profile";

const LIVE_COUNT = CHANNELS.filter((c) => c.href).length;

function Ping() {
  return (
    <div className="panel panel--ping">
      <div className="panel-kicker">&gt; PING — CONTACT.SYS</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">REACH_OUT</div>
          {PING_PARAGRAPHS.map((p) => (
            <p key={p}>{p}</p>
          ))}
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
