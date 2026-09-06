import { memo, useEffect, useRef, useState } from "react";

const SKILLS = [
  { label: "LANG: PYTHON_3.12", pct: 98 },
  { label: "LIB: PYTORCH_DEEP_L", pct: 92 },
  { label: "LANG: C++ / CUDA", pct: 75 },
  { label: "TOOL: DOCKER / K8S", pct: 88 },
];

const STACK_JSON = `{
  "frameworks": ["TensorFlow", "JAX", "HuggingFace", "LangChain"],
  "cloud": ["AWS_SageMaker", "GCP_VertexAI", "Azure_ML"],
  "database": ["VectorDB_Pinecone", "PostgreSQL", "Redis"],
  "version_control": "Git_LFS",
  "cicd": ["GitHub_Actions", "MLOps_DVC"]
}`;

function Skills() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bars fill in once this node is actually in view, not on mount — the
  // camera keeps every node's DOM mounted at all times, so mount doesn't
  // mean "arrived." IntersectionObserver correctly accounts for the world's
  // transform (it measures rendered position, not layout position).
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.55 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(STACK_JSON);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard API unavailable (e.g. insecure context) — fail quietly
    }
  };

  return (
    <div className="panel panel--skills" ref={panelRef}>
      <div className="panel-kicker">&gt; STACK — SKILLS.JSON</div>
      <h2 className="panel-title">CORE_SKILLS</h2>
      <div className="skills-grid">
        <div className="skills-bars">
          {SKILLS.map((s, i) => (
            <div className="skill-row" key={s.label}>
              <div className="skill-row-top">
                <span>{s.label}</span>
                <span>{s.pct}%</span>
              </div>
              <div className="skill-bar-track">
                <div
                  className="skill-bar-fill"
                  style={{
                    width: visible ? `${s.pct}%` : "0%",
                    transitionDelay: `${i * 90}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="stack-json-wrap">
          <button type="button" className={copied ? "copy-btn copy-btn--copied" : "copy-btn"} onClick={handleCopy}>
            {copied ? "[ COPIED ]" : "[ COPY ]"}
          </button>
          <pre className="stack-json">{STACK_JSON}</pre>
        </div>
      </div>
    </div>
  );
}

export default memo(Skills);
