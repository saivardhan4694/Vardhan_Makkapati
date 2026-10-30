// Asks the camera (Scene.tsx) to travel to another graph node. An event
// keeps callers decoupled from the camera rig — used by PROFILE's tab jump
// buttons, BUILDS-adjacent links, and STACK's evidence tags alike.
export function goToNode(id: string) {
  window.dispatchEvent(new CustomEvent("nav-node", { detail: { id } }));
}

export interface BuildsCommand {
  /** Category to filter BUILDS to ("all" clears the filter). */
  filter?: string;
  /** Repo id to select in BUILDS. */
  open?: string;
}

// Drives the BUILDS browser (Projects.tsx) from outside — the portfolio
// agent's filter_projects / open_project tools use it. Same decoupling as
// goToNode: the panel listens, callers don't need a ref into it.
export function commandBuilds(cmd: BuildsCommand) {
  window.dispatchEvent(new CustomEvent<BuildsCommand>("builds-cmd", { detail: cmd }));
}
