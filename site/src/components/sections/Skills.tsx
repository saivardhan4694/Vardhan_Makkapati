import { memo, useMemo, useState } from "react";
import { goToNode } from "../../lib/navNode";
import { STACK_CATEGORIES, STACK_INTRO } from "../../data/profile";

const CATEGORIES = STACK_CATEGORIES;

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
          <p>{STACK_INTRO}</p>
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
