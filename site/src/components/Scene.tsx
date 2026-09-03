import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GraphLayer from "./GraphLayer";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import Education from "./sections/Education";
import { mainNodes, NODE_W, NODE_H, worldBounds } from "../data/graph";
import { cameraAt, TOTAL_SEGMENTS, HIVE_ZOOM } from "../data/camera";

gsap.registerPlugin(ScrollTrigger);

const SECTION_COMPONENTS = [Hero, About, Skills, Projects, Education];

// Scroll distance per camera segment (focus->hive or hive->focus), in vh.
// Larger = more scroll travel per transition = slower, more controllable camera.
const VH_PER_SEGMENT = 90;

// 3D camera-rig tuning: how far the whole plane recedes and tilts as the
// camera pulls back into the hive view, and how much it levels out again
// once a node is in focus. This wraps the existing (unchanged) 2D pan/zoom
// math rather than replacing it, so the tuned centering logic stays intact.
const RIG_PERSPECTIVE = 1800;
const RIG_MAX_TILT_DEG = 8;
const RIG_MAX_RECEDE_Z = -260;

// How much lag ScrollTrigger's scrub puts between the scroll position and the
// camera. This same lag is also part of every nav jump's motion, so jumps have
// a minimum duration below that keeps it a small fraction of the whole move —
// that ratio is what made the long EDUCATION jump feel right and the short
// ones feel snatched away.
const SCROLL_SCRUB = 0.4;
const JUMP_SECONDS_PER_SEGMENT = 0.4;
const JUMP_MIN_SECONDS = 1.35;

export default function Scene() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const fogRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLDivElement>(null);
  const camReadoutRef = useRef<HTMLDivElement>(null);
  const scrollPctRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [showSignals, setShowSignals] = useState(true);
  const showSignalsRef = useRef(true);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const applyCameraRef = useRef<((progress: number) => void) | null>(null);
  const jumpTweenRef = useRef<gsap.core.Tween | null>(null);
  // Mirror of the camera's current progress, kept by applyCamera. A jump reads
  // its starting point from here rather than from the trigger.
  const renderProgressRef = useRef(0);
  const jumpingRef = useRef(false);

  const jumpToNode = (index: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    // Focus keyframes sit at even indices in cameraKeyframes (focus, hive,
    // focus, hive, ...), so node i's focus is at progress (i*2)/TOTAL_SEGMENTS.
    // Start from OUR mirrored progress, never `trigger.progress` — reading it
    // off the trigger is what made durations, and therefore landing
    // positions, wrong on every jump after the first.
    const fromProgress = renderProgressRef.current;
    const toProgress = (index * 2) / TOTAL_SEGMENTS;
    const segmentsCrossed = Math.abs(toProgress - fromProgress) * TOTAL_SEGMENTS;
    const duration = gsap.utils.clamp(
      JUMP_MIN_SECONDS,
      5,
      segmentsCrossed * JUMP_SECONDS_PER_SEGMENT
    );

    jumpTweenRef.current?.kill();
    jumpingRef.current = true;

    const state = { p: fromProgress };
    jumpTweenRef.current = gsap.to(state, {
      p: toProgress,
      duration,
      ease: "sine.inOut",
      onUpdate: () => {
        // Drive the camera ourselves — scrub is still fed the matching
        // scroll position (so it stays caught up and there's nothing to
        // snap back to once we hand control back), but its own smoothed
        // output is ignored for the duration of the jump so only one curve
        // is ever driving the camera at a time.
        applyCameraRef.current?.(state.p);
        trigger.scroll(trigger.start + state.p * (trigger.end - trigger.start));
      },
      onComplete: () => {
        jumpingRef.current = false;
      },
      onInterrupt: () => {
        jumpingRef.current = false;
      },
    });
  };

  useLayoutEffect(() => {
    const world = worldRef.current;
    const section = sectionRef.current;
    if (!world || !section) return;

    let baseScale = window.innerWidth / NODE_W;

    // Runs on every animation frame, so it writes styles directly rather than
    // through gsap.set (each of those allocates a zero-duration tween).
    const applyCamera = (progress: number) => {
      renderProgressRef.current = progress;
      const cam = cameraAt(progress);
      const scale = cam.scale * baseScale;
      const tx = window.innerWidth / 2 - cam.cx * scale;
      const ty = window.innerHeight / 2 - cam.cy * scale;
      world.style.transform = `translate3d(${tx}px, ${ty}px, 0px) scale(${scale})`;

      // Crossfade the graph overlay in as the camera pulls back toward the
      // hive zoom, and out as it locks onto a node in focus.
      const focusAmount = Math.min(Math.max((cam.scale - HIVE_ZOOM) / (1 - HIVE_ZOOM), 0), 1);
      if (graphRef.current) {
        graphRef.current.style.opacity = `${1 - focusAmount}`;
      }

      // Tilt and recede the whole plane as the camera pulls back — this is
      // what turns a flat scale/translate zoom into an actual sense of
      // moving through depth, then levels flat again once a node is focused.
      const hiveAmount = 1 - focusAmount;
      if (rigRef.current) {
        rigRef.current.style.transform =
          `perspective(${RIG_PERSPECTIVE}px) ` +
          `translate3d(0px, 0px, ${hiveAmount * RIG_MAX_RECEDE_Z}px) ` +
          `rotateX(${hiveAmount * RIG_MAX_TILT_DEG}deg)`;
      }
      if (fogRef.current) {
        fogRef.current.style.opacity = `${hiveAmount * 0.55}`;
      }

      // The traveling signal dots use SMIL animations that run continuously
      // once mounted, costing a repaint every frame even while invisible.
      // Only mount them near the zoomed-out hive view where they're seen.
      const nearHive = focusAmount < 0.45;
      if (nearHive !== showSignalsRef.current) {
        showSignalsRef.current = nearHive;
        setShowSignals(nearHive);
      }

      if (cam.activeIndex !== activeIndexRef.current) {
        activeIndexRef.current = cam.activeIndex;
        setActiveIndex(cam.activeIndex);
      }
      if (coordRef.current) {
        coordRef.current.textContent = `LOC: ${cam.cx.toFixed(0)} / ${cam.cy.toFixed(0)}`;
      }
      if (camReadoutRef.current) {
        const state = cam.scale < 0.6 ? "ZOOM_OUT" : "LOCKED";
        camReadoutRef.current.textContent = `CAMERA: ${state} [${cam.scale.toFixed(2)}x] — ${cam.segmentLabel}`;
      }
      if (scrollPctRef.current) {
        scrollPctRef.current.textContent = `SCROLL_PROGRESS: ${Math.round(progress * 100)}%`;
      }
    };

    // `scrub` does the smoothing between scroll position and camera. Hand-
    // rolling that in a ticker measured markedly worse (≈40 dropped frames
    // per scroll vs ≈13), so scrub stays. It was never what broke nav jumps:
    // that was reading the start position off the trigger and disabling it
    // mid-flight, both fixed below. We only mirror the progress into a ref
    // so a jump always knows its true starting point.
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: SCROLL_SCRUB,
      onUpdate: (self) => {
        if (jumpingRef.current) return; // the jump tween is driving the camera itself
        applyCamera(self.progress);
      },
    });
    triggerRef.current = trigger;
    applyCameraRef.current = applyCamera;

    // Let a real scroll interrupt an in-flight nav jump rather than fighting it.
    const cancelJump = () => {
      if (!jumpingRef.current) return;
      jumpTweenRef.current?.kill();
      jumpingRef.current = false;
    };
    window.addEventListener("wheel", cancelJump, { passive: true });
    window.addEventListener("touchstart", cancelJump, { passive: true });

    applyCamera(0);

    const onResize = () => {
      baseScale = window.innerWidth / NODE_W;
      applyCamera(renderProgressRef.current);
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", cancelJump);
      window.removeEventListener("touchstart", cancelJump);
      jumpTweenRef.current?.kill();
      trigger.kill();
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = `SYS_CLOCK: ${new Date().toLocaleTimeString("en-US", { hour12: false })}`;
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="scene-section"
      style={{ height: `${TOTAL_SEGMENTS * VH_PER_SEGMENT + 100}vh` }}
    >
      <div className="scene-viewport">
        <div className="scanlines" />

        <header className="chrome-nav">
          <div className="chrome-brand">
            <span className="accent">&gt;</span> PORTFOLIO_OS_V1.0
          </div>
          <nav className="chrome-links">
            {mainNodes.map((n, i) => (
              <button
                key={n.id}
                type="button"
                onClick={() => jumpToNode(i)}
                className={i === activeIndex ? "chrome-link chrome-link--active" : "chrome-link"}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="chrome-icons">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="5" width="18" height="14" rx="1" />
              <path d="M3 9h18" />
              <path d="M8 13h4" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
        </header>

        <div className="chrome-meta chrome-meta--left">
          <div>SYSTEM_INIT... <span className="accent">OK</span></div>
          <div ref={camReadoutRef}>CAMERA: LOCKED [1.00x] — HERO</div>
        </div>
        <div className="chrome-meta chrome-meta--right" ref={scrollPctRef}>
          SCROLL_PROGRESS: 0%
        </div>

        <div ref={rigRef} className="camera-rig">
          <div ref={worldRef} className="world" style={{ width: worldBounds.maxX, height: worldBounds.maxY }}>
            {mainNodes.map((n, i) => {
              const Comp = SECTION_COMPONENTS[i];
              return (
                <div
                  key={n.id}
                  className="node-frame"
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                >
                  <Comp />
                </div>
              );
            })}
            <GraphLayer ref={graphRef} activeIndex={activeIndex} showSignals={showSignals} />
          </div>
        </div>

        <div ref={fogRef} className="depth-fog" />

        <footer className="chrome-footer">
          <div ref={coordRef}>LOC: 0 / 0</div>
          <div className="chrome-footer-status">
            STATUS: <span className="accent">OPTIMAL</span>
          </div>
          <div ref={clockRef}>SYS_CLOCK: —</div>
        </footer>
      </div>
    </section>
  );
}
