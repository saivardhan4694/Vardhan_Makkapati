import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GraphLayer from "./GraphLayer";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import Education from "./sections/Education";
import Ping from "./sections/Ping";
import { mainNodes, NODE_W, NODE_H, worldBounds } from "../data/graph";
import { cameraAt, easeInOutCubic, TOTAL_SEGMENTS, HIVE_ZOOM, FOCUS_SCALE } from "../data/camera";
import { focusPing, type NavOutcome, type NavRequest } from "../lib/navNode";

// Fraction of a nav jump's duration spent zooming out / zooming back in; the
// rest is spent cruising at hive altitude. Applied regardless of how many
// intermediate nodes the jump's path happens to cross.
const JUMP_ZOOM_RAMP = 0.18;
// A nav request closer than this (in camera segments) to the target node
// counts as "already there": settle + focus ping instead of a full jump.
const SAME_NODE_SEGMENTS = 0.5;
const SETTLE_SECONDS = 0.35;

gsap.registerPlugin(ScrollTrigger);

const SECTION_COMPONENTS = [Hero, About, Skills, Projects, Education, Ping];

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

// Cap how far the camera scales up on wide viewports. Content inside each
// panel uses pixel offsets authored for the 1440px reference frame; those
// offsets scale right along with everything else, so on a much wider screen
// (1920px+, common) elements positioned near a panel edge (e.g. the hero's
// scroll hint) get amplified enough to collide with the fixed nav/footer
// chrome, which never scales. Capping the scale keeps that math sane —
// panels are letterboxed slightly on very wide screens instead.
const MAX_BASE_SCALE = 1.2;

// Below this the rig's tilt is visually indistinguishable from flat, so the
// perspective/rotateX transform is skipped entirely rather than writing an
// identity 3D stack — a redundant 3D matrix still costs real compute even at
// 0deg. A real but modest win on its own (profiled under 4x CPU throttle:
// severe-stutter frames >33ms dropped from ~50 to ~48 out of a few hundred).
const RIG_TILT_EPSILON = 0.02;

// Profiling under 4x CPU throttle (Chrome DevTools CPU throttling, a rough
// proxy for a weak/old CPU) found no single dominant cost inside applyCamera
// — pausing every CSS animation, hiding the canvas, hiding all off-screen
// panel content, and freezing the transform's scale component each measured
// as noise individually. What did move the needle was disabling the whole
// function's per-frame work at once (severe-stutter frames >33ms: ~50 -> ~5
// out of a few hundred sampled), meaning the cost is cumulative across many
// small contributors (cameraAt's keyframe search, the 3D rig transform, the
// SVG opacity crossfade, conditional React state, three textContent writes)
// rather than one line to delete. So low-power mode doesn't try to strip any
// single piece further — it runs the whole thing less often instead.
const LOW_POWER_FPS_CAP = 24;
const LOW_POWER_FRAME_INTERVAL_MS = 1000 / LOW_POWER_FPS_CAP;

// A simple, synchronous capability check — no timers, no async warm-up, so it
// can gate the very first frame. `hardwareConcurrency`/`deviceMemory` are
// coarse, but they're exactly the signal that correlates with "the camera's
// per-frame math is going to cost this device real frame budget": low core
// count or low RAM means a weak/older/integrated GPU behind it too, almost
// always. Unsupported properties (Safari lacks deviceMemory) fail open — a
// device we can't measure is assumed capable rather than degraded by default.
function detectLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || memory <= 4;
}

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
  const uptimeRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const showSignalsRef = useRef(true);
  // Lazy initializer: computed exactly once, before first paint.
  const [lowPowerMode] = useState(detectLowPowerDevice);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const applyCameraRef = useRef<
    ((progress: number, scaleOverride?: number, force?: boolean) => void) | null
  >(null);
  const jumpTweenRef = useRef<gsap.core.Tween | null>(null);
  // Mirror of the camera's current progress, kept by applyCamera. A jump reads
  // its starting point from here rather than from the trigger.
  const renderProgressRef = useRef(0);
  const jumpingRef = useRef(false);

  const jumpTargetRef = useRef(-1);

  // Settle the camera onto node `index` without leaving it (no zoom-out):
  // used when a nav request targets the node already on screen.
  const settleOnNode = (index: number, fromProgress: number, toProgress: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const fromScale = cameraAt(fromProgress).scale;
    jumpTweenRef.current?.kill();
    jumpingRef.current = true;
    jumpTargetRef.current = index;
    const state = { p: fromProgress };
    const span = toProgress - fromProgress;
    jumpTweenRef.current = gsap.to(state, {
      p: toProgress,
      duration: SETTLE_SECONDS,
      ease: "power2.out",
      onUpdate: () => {
        // Scale only ever moves from what's on screen toward focus.
        const t = span === 0 ? 1 : (state.p - fromProgress) / span;
        const scale = gsap.utils.interpolate(fromScale, FOCUS_SCALE, t);
        applyCameraRef.current?.(state.p, scale, state.p === toProgress);
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

  const jumpToNode = (index: number, ping = true): NavOutcome => {
    const trigger = triggerRef.current;
    if (!trigger) return "travel";

    // Focus keyframes sit at even indices in cameraKeyframes (focus, hive,
    // focus, hive, ...), so node i's focus is at progress (i*2)/TOTAL_SEGMENTS.
    // Start from OUR mirrored progress, never `trigger.progress` — reading it
    // off the trigger is what made durations, and therefore landing
    // positions, wrong on every jump after the first.
    const fromProgress = renderProgressRef.current;
    const toProgress = (index * 2) / TOTAL_SEGMENTS;
    const segmentsCrossed = Math.abs(toProgress - fromProgress) * TOTAL_SEGMENTS;

    // Already flying there: let that flight finish rather than restart it.
    if (jumpingRef.current && jumpTargetRef.current === index && segmentsCrossed >= SAME_NODE_SEGMENTS) {
      return "travel";
    }

    // Already there: no zoom-out/in round trip. Nudge onto the exact focus
    // if slightly off (unless a settle/landing is already doing that), then
    // ping the panel.
    if (segmentsCrossed < SAME_NODE_SEGMENTS) {
      const landingHere = jumpingRef.current && jumpTargetRef.current === index;
      if (!landingHere && segmentsCrossed > 0.002) settleOnNode(index, fromProgress, toProgress);
      if (ping) {
        focusPing(worldRef.current?.querySelector(`.node-frame[data-node="${mainNodes[index].id}"]`));
      }
      return "same";
    }

    const duration = gsap.utils.clamp(
      JUMP_MIN_SECONDS,
      5,
      segmentsCrossed * JUMP_SECONDS_PER_SEGMENT
    );

    // The scale a plain progress-tween would start from — usually 1 (focused
    // on a node), but reads whatever's actually on screen so an interrupted
    // jump redirecting mid-flight still starts its zoom-out from there rather
    // than snapping.
    const fromScale = cameraAt(fromProgress).scale;

    jumpTweenRef.current?.kill();
    jumpingRef.current = true;
    jumpTargetRef.current = index;

    const state = { p: fromProgress };
    const span = toProgress - fromProgress;
    jumpTweenRef.current = gsap.to(state, {
      p: toProgress,
      duration,
      ease: "sine.inOut",
      onUpdate: () => {
        // Position (and the nav/HUD labels) still follow the real path
        // through every node in between — that's what makes this read as
        // travel along the graph rather than a teleport. Scale is driven
        // separately: zoom out at the start, hold at hive altitude no
        // matter how many nodes the path passes on the way, zoom in only
        // at the very end — so intermediate nodes are passed over, not
        // individually focused.
        const t = span === 0 ? 1 : (state.p - fromProgress) / span;
        let scaleOverride: number;
        if (t <= JUMP_ZOOM_RAMP) {
          scaleOverride = gsap.utils.interpolate(
            fromScale,
            HIVE_ZOOM,
            easeInOutCubic(t / JUMP_ZOOM_RAMP)
          );
        } else if (t >= 1 - JUMP_ZOOM_RAMP) {
          scaleOverride = gsap.utils.interpolate(
            HIVE_ZOOM,
            FOCUS_SCALE,
            easeInOutCubic((t - (1 - JUMP_ZOOM_RAMP)) / JUMP_ZOOM_RAMP)
          );
        } else {
          scaleOverride = HIVE_ZOOM;
        }

        // Drive the camera ourselves — scrub is still fed the matching
        // scroll position (so it stays caught up and there's nothing to
        // snap back to once we hand control back), but its own smoothed
        // output is ignored for the duration of the jump so only one curve
        // is ever driving the camera at a time.
        //
        // `force: true` on the exact final tick — low-power mode throttles
        // how often applyCamera does its work, and without this the jump
        // could land a throttle-interval short of its actual destination.
        applyCameraRef.current?.(state.p, scaleOverride, state.p === toProgress);
        trigger.scroll(trigger.start + state.p * (trigger.end - trigger.start));
      },
      onComplete: () => {
        jumpingRef.current = false;
      },
      onInterrupt: () => {
        jumpingRef.current = false;
      },
    });
    return "travel";
  };

  useLayoutEffect(() => {
    const world = worldRef.current;
    const section = sectionRef.current;
    if (!world || !section) return;

    let baseScale = Math.min(window.innerWidth / NODE_W, MAX_BASE_SCALE);
    let lastAppliedAt = 0;

    // Runs on every animation frame, so it writes styles directly rather than
    // through gsap.set (each of those allocates a zero-duration tween).
    //
    // `scaleOverride` lets a nav jump drive the zoom level independently of
    // raw scroll progress (see jumpToNode) — position and labels still come
    // from the real path at `progress`, only how zoomed-in we render differs.
    //
    // `force` bypasses the low-power throttle below — used for the exact
    // final tick of a jump so a transition always lands precisely instead of
    // stopping a throttle-interval short.
    const applyCamera = (progress: number, scaleOverride?: number, force = false) => {
      renderProgressRef.current = progress;

      // Profiling found no single expensive line inside this function on a
      // CPU-throttled device — the cost is cumulative across many small
      // pieces (see LOW_POWER_FPS_CAP above). So rather than cut any one of
      // them further, low-power mode just runs all of it less often. Scroll
      // position (renderProgressRef, just set above) still updates every
      // call either way, so a jump starting mid-throttle always reads the
      // right place to resume from.
      if (lowPowerMode && !force) {
        const now = performance.now();
        if (now - lastAppliedAt < LOW_POWER_FRAME_INTERVAL_MS) return;
        lastAppliedAt = now;
      }

      const cam = cameraAt(progress);
      const camScale = scaleOverride ?? cam.scale;
      const scale = camScale * baseScale;
      const tx = window.innerWidth / 2 - cam.cx * scale;
      const ty = window.innerHeight / 2 - cam.cy * scale;
      world.style.transform = `translate3d(${tx}px, ${ty}px, 0px) scale(${scale})`;

      // Crossfade the graph overlay in as the camera pulls back toward the
      // hive zoom, and out as it locks onto a node in focus.
      const focusAmount = Math.min(Math.max((camScale - HIVE_ZOOM) / (1 - HIVE_ZOOM), 0), 1);
      if (graphRef.current) {
        graphRef.current.style.opacity = `${1 - focusAmount}`;
      }

      // Tilt and recede the whole plane as the camera pulls back — this is
      // what turns a flat scale/translate zoom into an actual sense of
      // moving through depth, then levels flat again once a node is focused.
      const hiveAmount = lowPowerMode ? 0 : 1 - focusAmount;
      if (rigRef.current) {
        if (hiveAmount < RIG_TILT_EPSILON) {
          // `transform: none` rather than a 3D-identity stack: an unused
          // perspective()/rotateX() still costs a full matrix computation
          // every frame even at 0deg, and this is the common case — most of
          // a visit is spent reading a focused panel, not mid-transition.
          rigRef.current.style.transform = "none";
        } else {
          rigRef.current.style.transform =
            `perspective(${RIG_PERSPECTIVE}px) ` +
            `translate3d(0px, 0px, ${hiveAmount * RIG_MAX_RECEDE_Z}px) ` +
            `rotateX(${hiveAmount * RIG_MAX_TILT_DEG}deg)`;
        }

        // preserve-3d breaks hit testing on descendants in Chromium: clicks
        // inside a focused panel land on the rig instead of the button under
        // the cursor, which made every control in every panel dead. The 3D
        // context is only needed while the plane is actually tilted, so drop
        // to flat at focus — at this threshold the tilt is under a fifth of a
        // degree, so nothing changes visually.
        rigRef.current.style.transformStyle = hiveAmount < RIG_TILT_EPSILON ? "flat" : "preserve-3d";
      }
      if (fogRef.current) {
        fogRef.current.style.opacity = `${hiveAmount * 0.55}`;
      }

      // The traveling signal dots use SMIL animations that repaint every frame
      // while displayed, so they're only shown near the zoomed-out hive view.
      // Toggled as a DOM attribute rather than React state: mounting/unmounting
      // them from a re-render landed exactly mid-transition and caused spikes.
      const nearHive = focusAmount < 0.45;
      if (nearHive !== showSignalsRef.current) {
        showSignalsRef.current = nearHive;
        graphRef.current?.setAttribute("data-signals", nearHive ? "on" : "off");
      }

      if (cam.activeIndex !== activeIndexRef.current) {
        activeIndexRef.current = cam.activeIndex;
        setActiveIndex(cam.activeIndex);
      }
      if (coordRef.current) {
        coordRef.current.textContent = `LOC: ${cam.cx.toFixed(0)} / ${cam.cy.toFixed(0)}`;
      }
      if (camReadoutRef.current) {
        const state = camScale < 0.6 ? "ZOOM_OUT" : "LOCKED";
        camReadoutRef.current.textContent = `CAMERA: ${state} [${camScale.toFixed(2)}x] — ${cam.segmentLabel}`;
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

    // Panels can ask the camera to travel to another node by id — the profile
    // summary uses this to open the full section behind each of its cards.
    // An event keeps the panels decoupled from the camera rig.
    const onNavRequest = (e: Event) => {
      const req = (e as CustomEvent<NavRequest>).detail;
      const index = mainNodes.findIndex((n) => n.id === req?.id);
      if (index >= 0) req.outcome = jumpToNode(index, req.ping !== false);
    };
    window.addEventListener("nav-node", onNavRequest);

    applyCamera(0, undefined, true);

    const onResize = () => {
      baseScale = Math.min(window.innerWidth / NODE_W, MAX_BASE_SCALE);
      applyCamera(renderProgressRef.current, undefined, true);
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", cancelJump);
      window.removeEventListener("touchstart", cancelJump);
      window.removeEventListener("nav-node", onNavRequest);
      jumpTweenRef.current?.kill();
      trigger.kill();
    };
    // lowPowerMode is set once via a lazy useState initializer and never
    // changes again, so listing it here doesn't cause the effect to re-run —
    // it just satisfies the closure check.
  }, [lowPowerMode]);

  useEffect(() => {
    const bootTime = Date.now();
    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = `SYS_CLOCK: ${new Date().toLocaleTimeString("en-US", { hour12: false })}`;
      }
      if (uptimeRef.current) {
        const elapsed = Math.floor((Date.now() - bootTime) / 1000);
        const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const ss = String(elapsed % 60).padStart(2, "0");
        uptimeRef.current.textContent = `UPTIME: ${mm}:${ss}`;
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
                  data-node={n.id}
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                >
                  <Comp />
                </div>
              );
            })}
            <GraphLayer ref={graphRef} activeIndex={activeIndex} />
          </div>
        </div>

        <div ref={fogRef} className="depth-fog" />

        <footer className="chrome-footer">
          <div ref={coordRef}>LOC: 0 / 0</div>
          <div className="chrome-footer-status">
            STATUS: <span className="accent">OPTIMAL</span>
          </div>
          <div className="chrome-footer-right">
            <div ref={uptimeRef}>UPTIME: 00:00</div>
            <div ref={clockRef}>SYS_CLOCK: —</div>
          </div>
        </footer>
      </div>
    </section>
  );
}
