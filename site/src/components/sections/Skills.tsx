import { memo, useMemo, useState } from "react";
import { goToNode } from "../../lib/navNode";

interface Evidence {
  label: string;
  node: string;
}

interface StackCategory {
  id: string;
  label: string;
  /** Short directory-style name for the filter bar, e.g. "frameworks/". */
  dir: string;
  items: string[];
  /** Real, textually-backed usage — not every category has one. */
  evidence?: Evidence[];
}

// Every entry here is lifted straight from the technical-skills section of
// the resume — nothing added, nothing dropped. `evidence` only appears where
// an experience bullet or a BUILDS repo names that exact tool; everything
// else is listed without a claim attached to it.
const CATEGORIES: StackCategory[] = [
  {
    id: "languages",
    label: "LANGUAGES",
    dir: "languages/",
    items: ["Python", "SQL", "Bash"],
  },
  {
    id: "frameworks",
    label: "AI / ML FRAMEWORKS",
    dir: "frameworks/",
    items: ["TensorFlow", "PyTorch", "LangChain", "LangGraph", "LlamaIndex", "HF Transformers"],
    evidence: [
      { label: "Main Flow internship", node: "about" },
      { label: "BUILDS", node: "projects" },
    ],
  },
  {
    id: "models",
    label: "MODELS & FINE-TUNING",
    dir: "models/",
    items: [
      "LLaMA 2 / 3",
      "Mistral",
      "Falcon",
      "GPT-4 / 4o",
      "Gemini Pro",
      "LoRA / QLoRA",
      "RLHF (PPO, DPO)",
    ],
  },
  {
    id: "data",
    label: "DATA & VECTOR STORES",
    dir: "data/",
    items: ["ChromaDB", "Pinecone", "Weaviate", "Qdrant", "PostgreSQL", "MongoDB", "MySQL", "DataStax Cassandra"],
  },
  {
    id: "cloud",
    label: "CLOUD & SERVING",
    dir: "cloud/",
    items: [
      "AWS Bedrock",
      "AWS SageMaker",
      "AWS (EC2, Lambda, API Gateway, S3)",
      "Docker",
      "Kubernetes",
      "FastAPI",
      "Flask",
      "Streamlit",
      "Gradio",
    ],
    evidence: [{ label: "Main Flow internship", node: "about" }],
  },
  {
    id: "multimodal",
    label: "MULTIMODAL & CORE",
    dir: "multimodal/",
    items: ["Diffusers", "DALL·E", "CLIP", "BLIP-2", "Whisper", "Prompt Engineering", "RAG", "NLP"],
  },
];

const TOOL_COUNT = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

type Filter = "all" | string;

function Skills() {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === filter)),
    [filter]
  );

  return (
    <div className="panel panel--skills">
      <div className="panel-kicker">&gt; STACK — SKILLS.JSON</div>

      <div className="screen-top">
        <div className="screen-intro">
          <div className="screen-intro-label">TECH_STACK</div>
          <p>
            Everything below is something I've actually built with — an agent
            framework, a production interview platform, or a project on
            BUILDS. Not a checklist of frameworks I've only read about.
          </p>
        </div>

        <div className="box screen-id">
          <div className="screen-id-row">
            <span className="screen-id-key">CATEGORIES</span>
            <span className="screen-id-val">{String(CATEGORIES.length).padStart(2, "0")}</span>
          </div>
          <div className="screen-id-row">
            <span className="screen-id-key">TOOLS_LOGGED</span>
            <span className="screen-id-val">{TOOL_COUNT}</span>
          </div>
          <div className="screen-id-row">
            <span className="screen-id-key">CORE_LANGUAGE</span>
            <span className="screen-id-val">PYTHON</span>
          </div>
          <div className="screen-id-row">
            <span className="screen-id-key">PRIMARY_CLOUD</span>
            <span className="screen-id-val accent">AWS</span>
          </div>
        </div>
      </div>

      <div className="box stack-browser">
        <div className="repo-bar">
          <button
            type="button"
            className={filter === "all" ? "repo-dir repo-dir--active" : "repo-dir"}
            onClick={() => setFilter("all")}
          >
            all/
            <span className="repo-dir-count">{TOOL_COUNT}</span>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={filter === c.id ? "repo-dir repo-dir--active" : "repo-dir"}
              onClick={() => setFilter(c.id)}
            >
              {c.dir}
              <span className="repo-dir-count">{c.items.length}</span>
            </button>
          ))}
        </div>

        <div className="term-prompt term-prompt--sm">
          <span className="term-user">visitor@portfolio</span>
          <span className="term-path">:~/stack$</span> cat skills.json
          {filter !== "all" && ` | grep ${filter}`}
        </div>

        <div className="stack-grid">
          {visible.map((c) => (
            <div className="stack-cat" key={c.id}>
              <div className="stack-cat-head">
                <span className="stack-cat-label">{c.label}</span>
                {c.evidence?.map((e) => (
                  <button
                    key={e.label}
                    type="button"
                    className="stack-evidence"
                    onClick={() => goToNode(e.node)}
                  >
                    used in: {e.label} →
                  </button>
                ))}
              </div>
              <div className="screen-chips">
                {c.items.map((item) => (
                  <span className="screen-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="box box--status-line">
        <div className="status-line-item">
          <span>CATEGORIES</span>
          <span className="status-line-dots" />
          <span className="accent">{String(CATEGORIES.length).padStart(2, "0")}</span>
        </div>
        <div className="status-line-item">
          <span>TOOLS_LOGGED</span>
          <span className="status-line-dots" />
          <span className="accent">{TOOL_COUNT}</span>
        </div>
        <div className="status-line-item">
          <span>FILTER</span>
          <span className="status-line-dots" />
          <span className="accent">{filter === "all" ? "ALL" : filter.toUpperCase()}</span>
        </div>
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(Skills);
