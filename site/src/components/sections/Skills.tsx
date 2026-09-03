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

import { memo } from "react";

function Skills() {
  return (
    <div className="panel panel--skills">
      <div className="panel-kicker">&gt; SKILLS — STACK.JSON</div>
      <h2 className="panel-title">CORE_SKILLS</h2>
      <div className="skills-grid">
        <div className="skills-bars">
          {SKILLS.map((s) => (
            <div className="skill-row" key={s.label}>
              <div className="skill-row-top">
                <span>{s.label}</span>
                <span>{s.pct}%</span>
              </div>
              <div className="skill-bar-track">
                <div className="skill-bar-fill" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <pre className="stack-json">{STACK_JSON}</pre>
      </div>
    </div>
  );
}

export default memo(Skills);
