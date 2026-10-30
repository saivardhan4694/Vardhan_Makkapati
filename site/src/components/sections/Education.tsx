import { memo } from "react";
import {
  CERTIFICATIONS,
  TIMELINE,
  TRAINING_INTRO,
  TRAINING_STATUS as STATUS_ITEMS,
} from "../../data/profile";

function Education() {
  return (
    <div className="panel panel--education">
      <div className="panel-kicker">&gt; TRAINING — LOG.ACADEMIC</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">TRAINING_LOG</div>
          <p>{TRAINING_INTRO}</p>
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

      <div className="box edu-combo">
        <div className="edu-combo-col">
          <div className="term-prompt term-prompt--sm">
            <span className="term-user">visitor@portfolio</span>
            <span className="term-path">:~/training$</span> cat timeline.log
          </div>
          <div className="edu-timeline">
            {TIMELINE.map((t) => (
              <div className="edu-t-row" key={t.stage}>
                <div className="edu-t-year">{t.year}</div>
                <div className="edu-t-body">
                  <div className="edu-t-head">
                    <span className="edu-t-stage">{t.stage}</span>
                    <span className="edu-t-title">{t.title}</span>
                  </div>
                  <div className="edu-t-org">
                    <span className="accent">{t.org}</span> — {t.place}
                  </div>
                  <div className="edu-t-score">{t.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="edu-combo-col">
          <div className="term-prompt term-prompt--sm">
            <span className="term-user">visitor@portfolio</span>
            <span className="term-path">:~/training$</span> ls certifications/
          </div>
          {/* Scrolls inside itself; overscroll is contained so the wheel
              never leaks out and drags the camera to another section. */}
          <div className="edu-certs">
            {CERTIFICATIONS.map((c) => (
              <div className="edu-cert-row" key={c.name}>
                <span className="edu-cert-name">{c.name}</span>
                <span className="edu-cert-issuer">{c.issuer}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="box box--status-line">
        <div className="status-line-item">
          <span>DEGREES</span>
          <span className="status-line-dots" />
          <span className="accent">01</span>
        </div>
        <div className="status-line-item">
          <span>CERTIFICATIONS</span>
          <span className="status-line-dots" />
          <span className="accent">{String(CERTIFICATIONS.length).padStart(2, "0")}</span>
        </div>
        <div className="status-line-item">
          <span>STATUS</span>
          <span className="status-line-dots" />
          <span className="accent">STILL_TRAINING</span>
        </div>
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(Education);
