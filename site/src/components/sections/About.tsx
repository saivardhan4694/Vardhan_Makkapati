import { memo } from "react";

const STATUS_ITEMS = [
  { label: "ROLE", value: "AGENTIC AI DEVELOPER" },
  { label: "PRIMARY_DOMAIN", value: "AI / ML SYSTEMS" },
  { label: "CURRENT_MODE", value: "BUILDING" },
  { label: "CURRENT_STATE", value: "● ONLINE", accent: true },
  { label: "AVAILABILITY", value: "● OPEN_TO_WORK", accent: true },
];

const FOCUS_AREAS = [
  {
    num: "01",
    title: "AGENTIC SYSTEMS",
    body: "AI systems that can reason, use tools, and execute tasks.",
  },
  {
    num: "02",
    title: "LLM SYSTEMS",
    body: "Building useful systems around LLMs, not treating the model as the product.",
  },
  {
    num: "03",
    title: "INTELLIGENT SOFTWARE",
    body: "Connecting AI capabilities to real applications and backend systems.",
  },
  {
    num: "04",
    title: "SYSTEM DESIGN",
    body: "How models, agents, tools, memory, and infra work together.",
  },
];

const PHILOSOPHY = [
  { num: "01", title: "BUILD FIRST", body: "Theory matters. Working systems matter more." },
  { num: "02", title: "MODELS ARE COMPONENTS", body: "The system around it is where the engineering happens." },
  { num: "03", title: "AUTOMATE THE LOOP", body: "Perception → Reasoning → Action → Feedback." },
  { num: "04", title: "MEASURE EVERYTHING", body: "If you can't evaluate it, you don't know it works." },
];

const BUILD_LOOP = ["INPUT", "PERCEPTION", "REASONING", "TOOLS / MEMORY", "ACTION", "FEEDBACK"];

const STATUS_LINE = [
  { label: "PROFILE_LOAD", value: "COMPLETE" },
  { label: "AGENT_RUNTIME", value: "ACTIVE" },
  { label: "BUILD_MODE", value: "ON" },
  { label: "SYSTEM_STATUS", value: "OPTIMAL" },
];

function About() {
  return (
    <div className="panel panel--about">
      <div className="panel-kicker">&gt; PROFILE — USER.SYS</div>

      <div className="box box--status-bar">
        {STATUS_ITEMS.map((s) => (
          <div className="status-bar-item" key={s.label}>
            <div className="status-bar-key">{s.label}</div>
            <div className={s.accent ? "status-bar-val accent" : "status-bar-val"}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="about-section">
        <div className="about-section-head">&gt; CURRENT_FOCUS</div>
        <div className="box-grid box-grid--4">
          {FOCUS_AREAS.map((f) => (
            <div className="box" key={f.num}>
              <div className="box-num">{f.num}</div>
              <div className="box-title">{f.title}</div>
              <div className="box-body">{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-section combo-grid">
        <div className="combo-col">
          <div className="about-section-head">&gt; WHY_AI?</div>
          <div className="box box--why">
            <p>
              Traditional software waits for instructions. I'm interested in
              software that can understand a goal, figure out the steps, interact
              with its environment, and complete the task.
            </p>
            <p className="why-emph">That's the part of AI engineering I find interesting.</p>
          </div>
        </div>

        <div className="combo-col">
          <div className="about-section-head">&gt; HOW_I_BUILD</div>
          <div className="box box--build">
            {BUILD_LOOP.map((step, i) => (
              <div className="build-step" key={step}>
                <span className="build-step-label">{step}</span>
                {i < BUILD_LOOP.length - 1 && <span className="build-step-arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="about-section-head">&gt; ENGINEERING_PHILOSOPHY</div>
        <div className="box-grid box-grid--4">
          {PHILOSOPHY.map((p) => (
            <div className="box" key={p.num}>
              <div className="box-num">{p.num}</div>
              <div className="box-title">{p.title}</div>
              <div className="box-body">{p.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="box box--status-line">
        {STATUS_LINE.map((s) => (
          <div className="status-line-item" key={s.label}>
            <span>{s.label}</span>
            <span className="status-line-dots" />
            <span className="accent">{s.value}</span>
          </div>
        ))}
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(About);
