import { memo, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  PROJECTS,
  PROJECT_COUNT,
  type Project,
  type ProjectCategory,
} from "../../data/projects";

type Filter = ProjectCategory | "all";

function Projects() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string>(
    PROJECTS.find((p) => p.flagship)?.id ?? PROJECTS[0].id
  );
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => (filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.category === filter)),
    [filter]
  );

  // Selection always follows the filter: narrowing to a category that does not
  // contain the current selection moves it to that category's first entry.
  const selected: Project =
    visible.find((p) => p.id === selectedId) ?? visible[0] ?? PROJECTS[0];

  const applyFilter = (next: Filter) => {
    setFilter(next);
    const list = next === "all" ? PROJECTS : PROJECTS.filter((p) => p.category === next);
    if (!list.some((p) => p.id === selectedId) && list[0]) setSelectedId(list[0].id);
  };

  // Up/down walks the list and keeps the highlighted row scrolled into view.
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = visible.findIndex((p) => p.id === selected.id);
    const next = (i + (e.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length;
    setSelectedId(visible[next].id);
    listRef.current
      ?.querySelectorAll(".repo-row")
      [next]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="panel panel--projects">
      <div className="panel-kicker-row">
        <div className="panel-kicker">&gt; BUILDS — REPO[]</div>
        <div className="panel-kicker-dim">
          INDEXED: {String(PROJECT_COUNT).padStart(2, "0")} · SHOWING:{" "}
          {String(visible.length).padStart(2, "0")}
        </div>
      </div>

      <div className="box repo-browser">
        <div className="repo-bar">
          {CATEGORIES.map((c) => {
            const n = c.id === "all" ? PROJECT_COUNT : PROJECTS.filter((p) => p.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className={c.id === filter ? "repo-dir repo-dir--active" : "repo-dir"}
                onClick={() => applyFilter(c.id)}
              >
                {c.label}
                <span className="repo-dir-count">{n}</span>
              </button>
            );
          })}
          <a
            className="repo-gh"
            href="https://github.com/saivardhan4694"
            target="_blank"
            rel="noopener noreferrer"
          >
            GITHUB →
          </a>
        </div>

        <div className="repo-split">
          <div className="repo-list-col">
            <div className="term-prompt term-prompt--sm">
              <span className="term-user">visitor@portfolio</span>
              <span className="term-path">:~/builds$</span> ls {filter === "all" ? "" : filter + "/"}
            </div>
            {/* Scrolls inside itself; overscroll is contained so the wheel
                never leaks out and drags the camera to another section. */}
            <div
              className="repo-list"
              ref={listRef}
              role="listbox"
              tabIndex={0}
              aria-label="Repositories"
              onKeyDown={onListKey}
            >
              {visible.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === selected.id}
                  className={p.id === selected.id ? "repo-row repo-row--active" : "repo-row"}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="repo-caret">{p.id === selected.id ? "▸" : " "}</span>
                  <span className="repo-name">{p.id}</span>
                  {p.flagship && <span className="repo-star">★</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="repo-detail" key={selected.id}>
            <div className="term-prompt term-prompt--sm">
              <span className="term-user">visitor@portfolio</span>
              <span className="term-path">:~/builds$</span> cat {selected.category}/{selected.id}
            </div>

            <div className="repo-detail-head">
              <div className="repo-title">
                {selected.title}
                {selected.flagship && <span className="repo-badge">FLAGSHIP</span>}
              </div>
              <div className="repo-year">{selected.year}</div>
            </div>

            <p className="repo-blurb">{selected.blurb}</p>

            <div className="repo-stack">
              {selected.stack.map((s) => (
                <span className="screen-chip screen-chip--sm" key={s}>
                  {s}
                </span>
              ))}
            </div>

            <ul className="repo-points">
              {selected.highlights.map((h) => (
                <li key={h}>
                  <span className="repo-bullet">+</span>
                  {h}
                </li>
              ))}
            </ul>

            <a
              className="repo-open"
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              OPEN REPO →
            </a>

            <div className="repo-eof">
              <span className="term-path">EOF</span>
              <span className="cursor" />
            </div>
          </div>
        </div>
      </div>

      <div className="box box--status-line">
        <div className="status-line-item">
          <span>REPOS</span>
          <span className="status-line-dots" />
          <span className="accent">{String(PROJECT_COUNT).padStart(2, "0")}</span>
        </div>
        <div className="status-line-item">
          <span>FILTER</span>
          <span className="status-line-dots" />
          <span className="accent">{filter === "all" ? "ALL" : filter.toUpperCase()}</span>
        </div>
        <div className="status-line-item">
          <span>SELECTED</span>
          <span className="status-line-dots" />
          <span className="accent">{selected.id}</span>
        </div>
        <span className="status-line-led" />
      </div>
    </div>
  );
}

export default memo(Projects);
