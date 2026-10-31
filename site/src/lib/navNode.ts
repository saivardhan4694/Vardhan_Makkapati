// Asks the active layout to show a graph node: the camera (Scene.tsx) flies
// there, the linear layout (LinearScene.tsx) scrolls. An event keeps callers
// decoupled from either — used by PROFILE's tab jump buttons, BUILDS-adjacent
// links, STACK's evidence tags and the portfolio agent alike.
//
// The layout that owns navigation decides between travelling and, when the
// node is already on screen, a "focus ping" in place. It writes that outcome
// back onto the (synchronously dispatched) event detail, so goToNode can
// return it without callers knowing which layout is mounted.

export type NavOutcome = "travel" | "same";

export interface NavRequest {
  id: string;
  /** Ping the section when no travel is needed (default true). */
  ping?: boolean;
  /** Set by the listening layout. */
  outcome?: NavOutcome;
}

export function goToNode(id: string, opts: { ping?: boolean } = {}): NavOutcome {
  const detail: NavRequest = { id, ping: opts.ping ?? true };
  window.dispatchEvent(new CustomEvent<NavRequest>("nav-node", { detail }));
  return detail.outcome ?? "travel";
}

export interface BuildsCommand {
  /** Category to filter BUILDS to ("all" clears the filter). */
  filter?: string;
  /** Repo id to select in BUILDS. */
  open?: string;
  /** BUILDS is already on screen: flash what changed instead of travelling. */
  flash?: boolean;
}

// Drives the BUILDS browser (Projects.tsx) from outside — the portfolio
// agent's filter_projects / open_project tools use it. Same decoupling as
// goToNode: the panel listens, callers don't need a ref into it.
export function commandBuilds(cmd: BuildsCommand) {
  window.dispatchEvent(new CustomEvent<BuildsCommand>("builds-cmd", { detail: cmd }));
}

// Re-triggerable one-shot CSS animation: (re)adds `cls`, removes it after `ms`.
const timers = new WeakMap<Element, number>();
export function pulseClass(el: Element | null | undefined, cls: string, ms: number) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add(cls);
  const prev = timers.get(el);
  if (prev) window.clearTimeout(prev);
  timers.set(
    el,
    window.setTimeout(() => {
      el.classList.remove(cls);
      timers.delete(el);
    }, ms)
  );
}

/** Corner brackets flash + one scanline sweep over a section panel. */
export const focusPing = (el: Element | null | undefined) => pulseClass(el, "focus-ping", 900);
/** Subtle one-off highlight on an element that just changed (chip, repo row). */
export const flashOnce = (el: Element | null | undefined) => pulseClass(el, "flash-once", 700);
