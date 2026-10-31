// Executes tool calls returned by the agent against the live scene. The
// Worker already validated them; they are re-checked here against the
// site's own data so a tampered response can't drive anything unexpected.

import { mainNodes } from "../../data/graph";
import { CATEGORIES, PROJECTS } from "../../data/projects";
import { commandBuilds, goToNode, type BuildsCommand } from "../../lib/navNode";

export interface Citation {
  sectionId: string;
  label: string;
  projectId?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const BUILDS = mainNodes.find((n) => n.id === "projects")?.label ?? "BUILDS";

// Navigate first so we know whether BUILDS was already on screen: if it was,
// the panel flashes the changed chip/row instead of the section pinging.
function driveBuilds(cmd: BuildsCommand): boolean {
  const same = goToNode("projects", { ping: false }) === "same";
  commandBuilds({ ...cmd, flash: same });
  return same;
}

/** Returns a short description of what was done, or null if refused. */
export function runTool(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case "navigate_to": {
      const n = mainNodes.find((x) => x.id === str(args.section));
      if (!n) return null;
      return goToNode(n.id) === "same" ? `already on ${n.label}` : `camera -> ${n.label}`;
    }
    case "filter_projects": {
      const c = CATEGORIES.find((x) => x.id === str(args.category));
      if (!c) return null;
      const same = driveBuilds({ filter: c.id });
      return `builds -> ls ${c.label}${same ? ` (already on ${BUILDS})` : ""}`;
    }
    case "open_project": {
      const p = PROJECTS.find((x) => x.id === str(args.id));
      if (!p) return null;
      const same = driveBuilds({ open: p.id });
      return `builds -> cat ${p.category}/${p.id}${same ? ` (already on ${BUILDS})` : ""}`;
    }
    case "get_contact": {
      const label = mainNodes.find((x) => x.id === "ping")?.label ?? "PING";
      return goToNode("ping") === "same" ? `already on ${label}` : `camera -> ${label}`;
    }
    default:
      return null;
  }
}

/** Resolves a `[→ LABEL]` / `[→ BUILDS/<id>]` marker, or null if unknown. */
export function resolveCitation(label: string, id?: string): Citation | null {
  const n = mainNodes.find((x) => x.label === label.toUpperCase());
  if (!n) return null;
  if (id) {
    if (n.id !== "projects") return null;
    const p = PROJECTS.find((x) => x.id === id) ?? PROJECTS.find((x) => x.id.toLowerCase() === id.toLowerCase());
    return p ? { sectionId: n.id, label: n.label, projectId: p.id } : null;
  }
  return { sectionId: n.id, label: n.label };
}

export function followCitation(c: Citation) {
  if (c.projectId) driveBuilds({ open: c.projectId });
  else goToNode(c.sectionId);
}
