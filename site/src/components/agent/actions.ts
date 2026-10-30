// Executes tool calls returned by the agent against the live scene. The
// Worker already validated them; they are re-checked here against the
// site's own data so a tampered response can't drive anything unexpected.

import { mainNodes } from "../../data/graph";
import { CATEGORIES, PROJECTS } from "../../data/projects";
import { commandBuilds, goToNode } from "../../lib/navNode";

export interface Citation {
  sectionId: string;
  label: string;
  projectId?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Returns a short description of what was done, or null if refused. */
export function runTool(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case "navigate_to": {
      const n = mainNodes.find((x) => x.id === str(args.section));
      if (!n) return null;
      goToNode(n.id);
      return `camera -> ${n.label}`;
    }
    case "filter_projects": {
      const c = CATEGORIES.find((x) => x.id === str(args.category));
      if (!c) return null;
      commandBuilds({ filter: c.id });
      goToNode("projects");
      return `builds -> ls ${c.label}`;
    }
    case "open_project": {
      const p = PROJECTS.find((x) => x.id === str(args.id));
      if (!p) return null;
      commandBuilds({ open: p.id });
      goToNode("projects");
      return `builds -> cat ${p.category}/${p.id}`;
    }
    case "get_contact":
      goToNode("ping");
      return "camera -> PING";
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
  if (c.projectId) commandBuilds({ open: c.projectId });
  goToNode(c.sectionId);
}
