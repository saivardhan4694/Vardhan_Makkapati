import { memo } from "react";

const STATUS_ITEMS = [
  { label: "DEGREE", value: "B.TECH — AI & ML" },
  { label: "GRADUATING", value: "2025" },
  { label: "FOCUS", value: "GENERATIVE AI / AGENTS" },
  { label: "CERTS_LOGGED", value: "13", accent: true },
];

const TIMELINE = [
  {
    year: "2025",
    stage: "B.TECH",
    title: "Artificial Intelligence & Machine Learning",
    org: "M.S. Ramaiah University of Applied Sciences",
    place: "Bengaluru",
    score: "2021 — 2025",
  },
  {
    year: "2021",
    stage: "INTERMEDIATE",
    title: "MPC — Maths, Physics, Chemistry",
    org: "Sri Chaitanya Junior College, iCON Campus",
    place: "Lakshmipuram, Guntur",
    score: "92% · BIE Andhra Pradesh",
  },
  {
    year: "2019",
    stage: "SECONDARY",
    title: "10th Grade",
    org: "Dr. KKR Gowtham High School",
    place: "Guntur",
    score: "9.8 / 10 CGPA · AP State Board",
  },
];

const CERTIFICATIONS = [
  { name: "Introduction to Generative AI", issuer: "Google Cloud" },
  { name: "Large Language Models & Transformers", issuer: "Google Cloud" },
  { name: "AI Fluency Course", issuer: "Anthropic" },
  { name: "AI Fundamentals & Prompt Writing", issuer: "IBM SkillsBuild" },
  { name: "Career Essentials in Generative AI", issuer: "Microsoft / LinkedIn" },
  { name: "Generative AI Studio", issuer: "Simplilearn" },
  { name: "Generative AI for Beginners", issuer: "Great Learning" },
  { name: "LangChain Basics for Beginners", issuer: "Great Learning" },
  { name: "Retrieval-Augmented Generation (RAG)", issuer: "Great Learning" },
  { name: "Artificial Intelligence A-Z 2024", issuer: "Udemy — Hadelin de Ponteves" },
  { name: "Machine Learning A-Z 2024", issuer: "Udemy — Hadelin de Ponteves" },
  { name: "Python for Data Science & ML", issuer: "Udemy — Jose Portilla" },
  { name: "100 Days of Code", issuer: "Udemy — Angela Yu" },
];

function Education() {
  return (
    <div className="panel panel--education">
      <div className="panel-kicker">&gt; TRAINING — LOG.ACADEMIC</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">TRAINING_LOG</div>
          <p>
            The degree is the formal record. Most of what I actually use day
            to day — LangChain, agent frameworks, RAG, fine-tuning — came from
            deliberately training on it after: courses, labs, and building
            with it until it held up.
          </p>
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
