import { memo, useState } from "react";
import { goToNode } from "../../lib/navNode";
import { PROJECTS as ALL_PROJECTS } from "../../data/projects";

const STATUS_ITEMS = [
  { label: "ROLE", value: "AGENTIC AI DEVELOPER" },
  { label: "DOMAIN", value: "AI / ML SYSTEMS" },
  { label: "DEGREE", value: "B.TECH" },
  { label: "AVAILABILITY", value: "● OPEN_TO_WORK", accent: true },
];

const EXPERIENCE = [
  {
    period: "OCT 2024 — JAN 2025",
    role: "GenAI Engineer Intern",
    org: "Main Flow Services and Technologies",
    note: "Built and deployed an AWS-hosted autonomous LLM interview platform — resume/JD matching, a two-stage LLM screening pipeline, and rubric-driven candidate evaluation.",
    stack: ["AWS", "LangChain", "HuggingFace", "EC2 / Lambda"],
    current: false,
  },
  {
    period: "NOW",
    role: "Open to new roles",
    org: "OPEN_TO_WORK",
    note: "Building agentic AI systems independently while looking for the next full-time opportunity.",
    stack: [],
    current: true,
  },
];

const SKILL_GROUPS = [
  {
    label: "LANGUAGES",
    items: ["Python", "SQL", "Bash"],
  },
  {
    label: "LLM / AGENTS",
    items: ["LangChain", "LangGraph", "LlamaIndex", "HF Transformers"],
  },
  {
    label: "MODELS & TUNING",
    items: ["LLaMA 3 / Mistral", "GPT-4o / Gemini", "LoRA / QLoRA", "RLHF"],
  },
  {
    label: "INFRA & DATA",
    items: ["AWS (Bedrock, SageMaker)", "Docker / K8s", "PostgreSQL", "Vector DBs"],
  },
];

// A 3-project digest of the real BUILDS list, one per category flavour —
// pulled from the same data BUILDS renders so the two can't drift apart the
// way the old hard-coded placeholder list did.
const DIGEST_IDS = [
  "ai-coding-assistent",
  "FootBall-Analysis-system-using-Computer-Vision",
  "coustomer_churn_prediction_system",
];
const PROJECTS = DIGEST_IDS.map((id) => {
  const p = ALL_PROJECTS.find((x) => x.id === id)!;
  return { name: p.title, tags: p.stack.slice(0, 2), note: p.blurb };
});

const EDUCATION = {
  degree: "B.TECH — [YOUR_BRANCH]",
  school: "[YOUR_UNIVERSITY]",
  period: "20XX — 20XX",
  note: "Highest qualification — the systems, maths and programming foundation the AI work is built on.",
  capstone: "[Final-year project — one line on what you built and the result.]",
  coursework: [
    "Data Structures",
    "Machine Learning",
    "Operating Systems",
    "Databases",
    "Linear Algebra",
    "Computer Networks",
  ],
};

type TabId = "experience" | "skills" | "projects" | "education";

// `node` is the graph node the camera travels to when a tab's link is used —
// the full section this summary is a digest of. `cmd` is the command the
// terminal appears to have run to produce the tab's output.
const TABS: {
  id: TabId;
  label: string;
  cmd: string;
  node?: string;
  nodeLabel?: string;
}[] = [
  { id: "experience", label: "experience.log", cmd: "cat experience.log" },
  { id: "skills", label: "stack.json", cmd: "cat stack.json", node: "skills", nodeLabel: "STACK" },
  { id: "projects", label: "builds/", cmd: "ls -l builds/", node: "projects", nodeLabel: "BUILDS" },
  {
    id: "education",
    label: "training.log",
    cmd: "cat training.log",
    node: "education",
    nodeLabel: "TRAINING",
  },
];

const TAB_ORDER = TABS.map((t) => t.id);

function About() {
  // Terminal tabs: any of them can be closed, and `+` reopens the most
  // recently closed one — the same stack a real terminal keeps.
  const [openTabs, setOpenTabs] = useState<TabId[]>(TAB_ORDER);
  const [closedStack, setClosedStack] = useState<TabId[]>([]);
  const [tab, setTab] = useState<TabId | null>("experience");

  const active = TABS.find((t) => t.id === tab) ?? null;

  const closeTab = (id: TabId) => {
    const i = openTabs.indexOf(id);
    const next = openTabs.filter((t) => t !== id);
    setOpenTabs(next);
    setClosedStack([...closedStack, id]);
    // Focus falls to the neighbour on the right, then the left — and to
    // nothing at all once the last tab is gone.
    if (tab === id) setTab(next[Math.min(i, next.length - 1)] ?? null);
  };

  const reopenTab = () => {
    if (closedStack.length === 0) return;
    const id = closedStack[closedStack.length - 1];
    setClosedStack(closedStack.slice(0, -1));
    setOpenTabs(TAB_ORDER.filter((t) => openTabs.includes(t) || t === id));
    setTab(id);
  };

  // Left/right arrows move between open tabs, the way a real tablist behaves.
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (!tab || openTabs.length < 2) return;
    e.preventDefault();
    const i = openTabs.indexOf(tab);
    const next = (i + (e.key === "ArrowRight" ? 1 : openTabs.length - 1)) % openTabs.length;
    setTab(openTabs[next]);
  };

  return (
    <div className="panel panel--about">
      <div className="panel-kicker">&gt; PROFILE — USER.SYS</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">ABOUT_ME</div>
          <p>
            I'm an agentic AI developer. I build systems that reason about a
            goal, pick the right tools, act, and check their own work — not
            demos that stop at a model call.
          </p>
          <p>
            What keeps me here is the engineering around the model: the loop,
            the memory, the evaluation. That's where an idea turns into
            something that actually runs.
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

      <div className="box term">
        <div className="term-bar" role="tablist" aria-label="Profile summary" onKeyDown={onTabKey}>
          {openTabs.map((id) => {
            const t = TABS.find((x) => x.id === id)!;
            return (
              <div
                className={id === tab ? "term-tab term-tab--active" : "term-tab"}
                key={id}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={id === tab}
                  tabIndex={id === tab ? 0 : -1}
                  className="term-tab-name"
                  onClick={() => setTab(id)}
                >
                  {t.label}
                </button>
                <button
                  type="button"
                  className="term-tab-close"
                  aria-label={`Close ${t.label}`}
                  title={`Close ${t.label}`}
                  onClick={() => closeTab(id)}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="term-add"
            onClick={reopenTab}
            disabled={closedStack.length === 0}
            aria-label="Reopen last closed tab"
            title={closedStack.length ? "Reopen last closed tab" : "No closed tabs"}
          >
            +
          </button>
          {active?.node && (
            <button type="button" className="screen-jump" onClick={() => goToNode(active.node!)}>
              OPEN {active.nodeLabel} →
            </button>
          )}
        </div>

        {!active && (
          <div className="term-body term-body--empty">
            <div className="term-prompt">
              <span className="term-user">visitor@portfolio</span>
              <span className="term-path">:~/profile$</span> exit
            </div>
            <div className="term-empty-note">
              all tabs closed — press <span className="accent">+</span> to reopen
              <span className="cursor" />
            </div>
          </div>
        )}

        {/* Fixed height: whichever tab is open, the body occupies exactly the
            same space, so no combination of content can push the page past its
            bounds. */}
        {active && (
          <div className="term-body" role="tabpanel" key={tab}>
            <div className="term-prompt">
              <span className="term-user">visitor@portfolio</span>
              <span className="term-path">:~/profile$</span> {active.cmd}
            </div>
            <div className="term-out">
        {tab === "experience" && (
          <div className="screen-list">
            {EXPERIENCE.map((x) => (
              <div className="screen-row" key={x.role + x.org}>
                <div className="screen-row-when">
                  {x.current && <span className="screen-dot" />}
                  {x.period}
                </div>
                <div className="screen-row-body">
                  <div className="screen-row-title">
                    {x.role} <span className="screen-at">@</span>{" "}
                    <span className="accent">{x.org}</span>
                  </div>
                  <div className="screen-row-note">{x.note}</div>
                  {x.stack.length > 0 && (
                    <div className="screen-chips screen-chips--tight">
                      {x.stack.map((s) => (
                        <span className="screen-chip screen-chip--sm" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "skills" && (
          <div className="screen-skills">
            {SKILL_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="screen-group-label">{g.label}</div>
                <div className="screen-chips">
                  {g.items.map((s) => (
                    <span className="screen-chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "projects" && (
          <div className="screen-list">
            {PROJECTS.map((p) => (
              <button
                type="button"
                className="screen-row screen-row--link"
                key={p.name}
                onClick={() => goToNode("projects")}
              >
                <div className="screen-row-when">
                  {p.tags.map((t) => (
                    <span className="screen-tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="screen-row-body">
                  <div className="screen-row-title">{p.name}</div>
                  <div className="screen-row-note">{p.note}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === "education" && (
          <div className="screen-list">
            <div className="screen-row">
              <div className="screen-row-when">{EDUCATION.period}</div>
              <div className="screen-row-body">
                <div className="screen-row-title">
                  {EDUCATION.degree} <span className="screen-at">—</span>{" "}
                  <span className="accent">{EDUCATION.school}</span>
                </div>
                <div className="screen-row-note">{EDUCATION.note}</div>
              </div>
            </div>
            <div className="screen-row">
              <div className="screen-row-when">KEY_COURSEWORK</div>
              <div className="screen-row-body">
                <div className="screen-chips">
                  {EDUCATION.coursework.map((c) => (
                    <span className="screen-chip" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="screen-row">
              <div className="screen-row-when">CAPSTONE</div>
              <div className="screen-row-body">
                <div className="screen-row-note screen-row-note--flush">{EDUCATION.capstone}</div>
              </div>
            </div>
          </div>
        )}
            </div>
          </div>
        )}
      </div>

      <div className="box box--status-line">
        <div className="status-line-item">
          <span>PROFILE_LOAD</span>
          <span className="status-line-dots" />
          <span className="accent">COMPLETE</span>
        </div>
        <div className="status-line-item">
          <span>SECTIONS_INDEXED</span>
          <span className="status-line-dots" />
          <span className="accent">04</span>
        </div>
        <div className="status-line-item">
          <span>DETAIL</span>
          <span className="status-line-dots" />
          <span className="accent">SEE_FULL_SECTIONS</span>
        </div>
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(About);
