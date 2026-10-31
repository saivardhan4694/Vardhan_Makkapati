import { useCallback, useEffect, useRef, useState } from "react";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import Education from "./sections/Education";
import Ping from "./sections/Ping";
import { mainNodes } from "../data/graph";
import { LayoutContext } from "../lib/layoutMode";
import { focusPing, type NavRequest } from "../lib/navNode";
import "../styles/linear.css";

const SECTION_COMPONENTS = [Hero, About, Skills, Projects, Education, Ping];

// "Already in view" for a nav request: the section heading sits in the top
// part of the screen below the sticky bar, or the section fills most of it.
function isInView(el: HTMLElement, barBottom: number) {
  const r = el.getBoundingClientRect();
  const avail = window.innerHeight - barBottom;
  if (avail <= 0) return false;
  const topVisible = r.top >= barBottom - 8 && r.top <= barBottom + avail * 0.4;
  const covered = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, barBottom);
  return topVisible || covered >= avail * 0.75;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The linear (mobile / tablet / small-window) layout: the same six panels in
// normal document flow under a sticky PORTFOLIO_OS bar with a scrollable tab
// strip. No camera rig, no GSAP, no HUD — native scrolling does the work.
//
// Navigation keeps the camera scene's contract: anything that dispatches the
// "nav-node" event (goToNode) scrolls to that section here, so panel links
// and future integrations work in both layouts unchanged.
export default function LinearScene() {
  const [active, setActive] = useState(mainNodes[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  // While a tab-initiated smooth scroll is running, the observer would flick
  // the highlight through every section passed on the way; hold it instead.
  const lockUntil = useRef(0);

  const scrollToNode = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    setActive(id);
    lockUntil.current = performance.now() + 900;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  // Same event the camera scene listens to. A section that is already in
  // view gets a focus ping instead of a scroll; the outcome is reported back
  // on the event so callers (the agent) can tell.
  useEffect(() => {
    const onNav = (e: Event) => {
      const req = (e as CustomEvent<NavRequest>).detail;
      const id = req?.id;
      if (!id || !mainNodes.some((n) => n.id === id)) return;
      const el = sectionRefs.current[id];
      const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
      if (el && isInView(el, barBottom)) {
        req.outcome = "same";
        if (req.ping !== false) focusPing(el);
        return;
      }
      req.outcome = "travel";
      scrollToNode(id);
    };
    window.addEventListener("nav-node", onNav);
    return () => window.removeEventListener("nav-node", onNav);
  }, [scrollToNode]);

  // Active tab = the section crossing a line ~35% down the viewport.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (performance.now() < lockUntil.current) return;
        for (const e of entries) {
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.node ?? mainNodes[0].id);
        }
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    for (const el of Object.values(sectionRefs.current)) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  // One-shot reveal as each section first scrolls in.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
    );
    for (const el of Object.values(sectionRefs.current)) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  // Keep the active tab visible inside the horizontally scrolling strip.
  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !tab) return;
    const target = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const activeIndex = mainNodes.findIndex((n) => n.id === active);

  return (
    <LayoutContext.Provider value="linear">
      <div className="m-root">
        <div className="m-scan" aria-hidden="true" />
        <header className="m-bar" ref={barRef}>
          <div className="m-bar-top">
            <button type="button" className="m-brand" onClick={() => scrollToNode(mainNodes[0].id)}>
              <span className="accent">&gt;</span> PORTFOLIO_OS
            </button>
            <div className="m-bar-status" aria-hidden="true">
              <span className="m-led" />
              {String(activeIndex + 1).padStart(2, "0")}/{String(mainNodes.length).padStart(2, "0")}
            </div>
          </div>
          <nav className="m-tabs" ref={tabsRef} aria-label="Sections">
            {mainNodes.map((n) => (
              <button
                key={n.id}
                type="button"
                data-tab={n.id}
                className={n.id === active ? "m-tab m-tab--active" : "m-tab"}
                aria-current={n.id === active ? "true" : undefined}
                onClick={() => scrollToNode(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="m-main">
          {mainNodes.map((n, i) => {
            const Comp = SECTION_COMPONENTS[i];
            return (
              <section
                key={n.id}
                id={`section-${n.id}`}
                data-node={n.id}
                aria-label={n.label}
                className={i === 0 ? "m-section m-section--hero is-revealed" : "m-section"}
                ref={(el) => {
                  sectionRefs.current[n.id] = el;
                }}
              >
                <Comp />
              </section>
            );
          })}
        </main>

        <footer className="m-footer">
          <div>
            <span className="term-path">EOF</span> — PORTFOLIO_OS v1.0
          </div>
          <button type="button" className="m-top" onClick={() => scrollToNode(mainNodes[0].id)}>
            cd ~ ↑
          </button>
        </footer>
      </div>
    </LayoutContext.Provider>
  );
}
