import { memo, useEffect, useRef } from "react";

// A feed-forward net: four layers, input -> output, each one a flat grid of
// neurons standing in the Y/Z plane. Grids rather than rings or discs — a
// ring reads as a drum and a disc as a shapeless cloud, while aligned planes
// separated along X read as the layers of a network at a glance.
const LAYER_GRID = [
  { cols: 2, rows: 3, label: "INPUT" },
  { cols: 3, rows: 4, label: "HIDDEN_1" },
  { cols: 3, rows: 4, label: "HIDDEN_2" },
  { cols: 2, rows: 2, label: "OUTPUT" },
];

// Share of the possible adjacent-layer connections that actually get wired.
// Full connectivity reads as a solid wall; this keeps the fan-out obvious
// while leaving air between the strands.
const CONNECTIVITY = 0.62;
const LAYER_COUNT = LAYER_GRID.length;
const LAYER_SIZE = LAYER_GRID.map((l) => l.cols * l.rows);

const LAYER_GAP = 168;
const SPACING_Y = 92;
const SPACING_Z = 80;
const FOCAL = 1000;

// Captions share one baseline below the tallest layer, so they read as a row
// of labels rather than stepping up and down with each layer's row count.
const CAPTION_Y =
  Math.max(...LAYER_GRID.map((g) => ((g.rows - 1) / 2) * SPACING_Y)) + 34;

// Rotation oscillates instead of spinning: a full spin puts the layer planes
// edge-on twice a turn, where the whole net collapses into a line. A shallow
// swing keeps every layer readable while still showing real depth.
const YAW_AMPLITUDE = 0.34;
const YAW_PERIOD_MS = 21000;
const PITCH_AMPLITUDE = 0.1;
const PITCH_PERIOD_MS = 15000;

// Forward-pass timing.
const STEP_MS = 340; // time for a signal to cross one layer gap
const PASS_GAP_MS = 850; // pause between passes
const DECAY_MS = 700; // activation half-life once a neuron has fired

// Fraction of a fired neuron's outgoing edges that actually carry a visible
// pulse. Firing every edge of a fully-connected net at once is a wall of
// light; a subset reads as selective activation.
const PULSE_DENSITY = 0.42;

// Strands running off past the edges of the frame, anchored on points that
// sit well outside the visible net. They carry signal in and out like any
// other edge but fade to nothing before they reach the canvas boundary, so
// what's on screen reads as a crop of a much larger network rather than a
// self-contained diagram floating on the panel.
const GHOST_REACH = 300;
const GHOST_SPREAD = 150;
const GHOST_FADE_STEPS = 7;

// The canvas covers the whole hero panel, so the network is placed toward the
// right of it and everything is erased back out toward the edges. The long
// left-hand fade is what keeps the mesh from ending in a straight line beside
// the name; the others stop it being cut off by the panel bounds.
const NET_CENTER_X = 0.72;
const NET_CENTER_Y = 0.55;

// The visible extent is an ellipse around the net, not a rectangle. Straight
// left/top/bottom ramps still meet at right angles, and a soft-edged rectangle
// reads as a box just as much as a hard one does — the boundary has to be
// curved for the mesh to sit in the panel rather than on it.
const HALO_RX = 0.4; // of canvas width
const HALO_RY = 0.4; // of canvas height
const HALO_SOLID = 0.34; // untouched out to this share of the radius
// Short linear fades at the panel bounds so nothing is cut hard on viewports
// where the node is taller than the screen.
const EDGE_FADE = 0.06;

// Palette mirrors the custom properties in global.css. Canvas can't resolve
// var(), so these are kept in sync by hand. Idle nodes and edges are the same
// accent green held down to a low alpha rather than a neutral grey — a grey
// mesh reads as dead next to the rest of the site's acid-green chrome.
const ACCENT_RGB = "199, 255, 47";
const IDLE_RGB = "176, 224, 74";
const EDGE_RGB = "150, 200, 60";

interface Neuron {
  x: number;
  y: number;
  z: number;
  layer: number;
  act: number;
  // Filled in each frame while projecting.
  sx: number;
  sy: number;
  depth: number;
}

interface Edge {
  a: number;
  b: number;
  /** ms elapsed on the travelling pulse, or -1 when idle. */
  pulse: number;
  /** Runs off past the frame: drawn faded out toward its outer end. */
  ghost?: boolean;
}

// Deterministic layout — the same seeded generator idea used for the graph
// scatter, so the network looks identical on every load.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNetwork() {
  const rand = mulberry32(20260906);
  const neurons: Neuron[] = [];
  const layerStart: number[] = [];

  LAYER_GRID.forEach((grid, li) => {
    layerStart.push(neurons.length);
    const x = (li - (LAYER_COUNT - 1) / 2) * LAYER_GAP;
    for (let c = 0; c < grid.cols; c++) {
      for (let r = 0; r < grid.rows; r++) {
        neurons.push({
          // A hair of jitter keeps the grid from looking machine-stamped
          // without breaking the alignment that makes it read as a layer.
          x: x + (rand() - 0.5) * 6,
          y: (r - (grid.rows - 1) / 2) * SPACING_Y + (rand() - 0.5) * 7,
          z: (c - (grid.cols - 1) / 2) * SPACING_Z + (rand() - 0.5) * 7,
          layer: li,
          act: 0,
          sx: 0,
          sy: 0,
          depth: 1,
        });
      }
    }
  });

  // Dense fan-out between adjacent layers is what actually says "neural
  // network", but a full mesh at this scale is opaque, so a fixed share of
  // the connections is dropped — with a guarantee that no neuron is left
  // stranded without an input or an output.
  const edges: Edge[] = [];
  for (let li = 0; li < LAYER_COUNT - 1; li++) {
    const aStart = layerStart[li];
    const bStart = layerStart[li + 1];
    const aEnd = aStart + LAYER_SIZE[li];
    const bEnd = bStart + LAYER_SIZE[li + 1];

    for (let a = aStart; a < aEnd; a++) {
      let wired = 0;
      for (let b = bStart; b < bEnd; b++) {
        if (rand() < CONNECTIVITY) {
          edges.push({ a, b, pulse: -1 });
          wired++;
        }
      }
      if (wired === 0) {
        edges.push({ a, b: bStart + Math.floor(rand() * LAYER_SIZE[li + 1]), pulse: -1 });
      }
    }
    for (let b = bStart; b < bEnd; b++) {
      if (!edges.some((e) => e.b === b)) {
        edges.push({ a: aStart + Math.floor(rand() * LAYER_SIZE[li]), b, pulse: -1 });
      }
    }
  }

  // Anchors outside the frame. They are stored as neurons so projection and
  // pulse propagation treat them like anything else, but carry layer -1
  // (feeding the input layer) or LAYER_COUNT (fed by the output layer), which
  // is how the render loop knows not to draw a dot for them.
  const GHOST_IN = -1;
  const GHOST_OUT = LAYER_COUNT;
  const addGhost = (x: number, y: number, z: number, layer: number) => {
    neurons.push({ x, y, z, layer, act: 0, sx: 0, sy: 0, depth: 1 });
    return neurons.length - 1;
  };

  const firstStart = layerStart[0];
  const lastStart = layerStart[LAYER_COUNT - 1];
  const netHalfWidth = ((LAYER_COUNT - 1) / 2) * LAYER_GAP;

  // Upstream strands arriving at the input layer.
  for (let i = firstStart; i < firstStart + LAYER_SIZE[0]; i++) {
    const strands = 1 + Math.floor(rand() * 2);
    for (let s = 0; s < strands; s++) {
      const g = addGhost(
        -netHalfWidth - GHOST_REACH * (0.7 + rand() * 0.6),
        neurons[i].y + (rand() - 0.5) * GHOST_SPREAD * 2,
        neurons[i].z + (rand() - 0.5) * GHOST_SPREAD,
        GHOST_IN
      );
      edges.push({ a: g, b: i, pulse: -1, ghost: true });
    }
  }

  // Downstream strands leaving the output layer.
  for (let i = lastStart; i < lastStart + LAYER_SIZE[LAYER_COUNT - 1]; i++) {
    const strands = 1 + Math.floor(rand() * 2);
    for (let s = 0; s < strands; s++) {
      const g = addGhost(
        netHalfWidth + GHOST_REACH * (0.7 + rand() * 0.6),
        neurons[i].y + (rand() - 0.5) * GHOST_SPREAD * 2,
        neurons[i].z + (rand() - 0.5) * GHOST_SPREAD,
        GHOST_OUT
      );
      edges.push({ a: i, b: g, pulse: -1, ghost: true });
    }
  }

  // A few strands off the top and bottom of the hidden layers, so the crop
  // reads as vertical as well as horizontal — the net continues in every
  // direction, not just left and right.
  for (let li = 1; li < LAYER_COUNT - 1; li++) {
    const start = layerStart[li];
    const end = start + LAYER_SIZE[li];
    let top = start;
    let bottom = start;
    for (let i = start; i < end; i++) {
      if (neurons[i].y < neurons[top].y) top = i;
      if (neurons[i].y > neurons[bottom].y) bottom = i;
    }
    for (const [i, dir] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      const g = addGhost(
        neurons[i].x + (rand() - 0.5) * LAYER_GAP,
        neurons[i].y + dir * GHOST_REACH * (0.42 + rand() * 0.34),
        neurons[i].z + (rand() - 0.5) * GHOST_SPREAD,
        GHOST_OUT
      );
      edges.push({ a: i, b: g, pulse: -1, ghost: true });
    }
  }

  return { neurons, edges, layerStart };
}

function NeuralNet() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { neurons, edges, layerStart } = buildNetwork();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pre-rendered glow sprite. Canvas shadowBlur gives the same look but
    // re-rasterizes a blur per shape per frame — with ~20 neurons firing that
    // measured 10fps. Blitting one cached radial gradient holds 60.
    const GLOW_PX = 64;
    const glow = document.createElement("canvas");
    glow.width = GLOW_PX;
    glow.height = GLOW_PX;
    const gctx = glow.getContext("2d");
    if (gctx) {
      const g = gctx.createRadialGradient(
        GLOW_PX / 2,
        GLOW_PX / 2,
        0,
        GLOW_PX / 2,
        GLOW_PX / 2,
        GLOW_PX / 2
      );
      g.addColorStop(0, `rgba(${ACCENT_RGB}, 0.7)`);
      g.addColorStop(0.22, `rgba(${ACCENT_RGB}, 0.18)`);
      g.addColorStop(0.55, `rgba(${ACCENT_RGB}, 0.05)`);
      g.addColorStop(1, `rgba(${ACCENT_RGB}, 0)`);
      gctx.fillStyle = g;
      gctx.fillRect(0, 0, GLOW_PX, GLOW_PX);
    }

    // Backing store is sized from layout pixels, never getBoundingClientRect:
    // the camera CSS-scales this whole subtree, and measuring the transformed
    // box would resize the canvas on every zoom.
    let cssW = 0;
    let cssH = 0;
    // Edge fades, rebuilt only on resize — they depend on canvas size alone,
    // so there is nothing to allocate per frame.
    let halo: CanvasGradient | null = null;
    let haloR = 0;
    let fadeL: CanvasGradient | null = null;
    let fadeR: CanvasGradient | null = null;
    let fadeT: CanvasGradient | null = null;
    let fadeB: CanvasGradient | null = null;

    const resize = () => {
      cssW = wrap.offsetWidth;
      cssH = wrap.offsetHeight;
      // Capped at 1.5: the panel is already CSS-scaled up to 1.2x by the
      // camera, and every extra backing pixel is rasterized every frame.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (cssW === 0 || cssH === 0) return;
      const opaque = "rgba(0, 0, 0, 1)";
      const clear = "rgba(0, 0, 0, 0)";

      // Elliptical halo, built as a circle in a space the draw loop scales —
      // gradient coordinates resolve against the transform in force when it
      // is painted, so one cached circular gradient gives any ellipse.
      haloR = cssW * HALO_RX;
      halo = ctx.createRadialGradient(0, 0, haloR * HALO_SOLID, 0, 0, haloR);
      halo.addColorStop(0, clear);
      halo.addColorStop(0.55, "rgba(0, 0, 0, 0.28)");
      halo.addColorStop(0.82, "rgba(0, 0, 0, 0.78)");
      halo.addColorStop(1, opaque);

      fadeL = ctx.createLinearGradient(0, 0, cssW * EDGE_FADE, 0);
      fadeL.addColorStop(0, opaque);
      fadeL.addColorStop(1, clear);

      fadeR = ctx.createLinearGradient(cssW * (1 - EDGE_FADE), 0, cssW, 0);
      fadeR.addColorStop(0, clear);
      fadeR.addColorStop(1, opaque);

      fadeT = ctx.createLinearGradient(0, 0, 0, cssH * EDGE_FADE);
      fadeT.addColorStop(0, opaque);
      fadeT.addColorStop(1, clear);

      fadeB = ctx.createLinearGradient(0, cssH * (1 - EDGE_FADE), 0, cssH);
      fadeB.addColorStop(0, clear);
      fadeB.addColorStop(1, opaque);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Pointer parallax, lerped toward the target so the net eases rather than
    // snapping. Written to locals, never state — a per-frame setState here
    // would re-render the whole hero.
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      pointerTargetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointerTargetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => {
      pointerTargetX = 0;
      pointerTargetY = 0;
    };
    // Listen on the panel, not the canvas wrapper: the wrapper is
    // pointer-events:none so it never swallows selection on the hero text,
    // which also means it would never see a pointer event of its own.
    const pointerHost = wrap.parentElement ?? wrap;
    pointerHost.addEventListener("pointermove", onMove);
    pointerHost.addEventListener("pointerleave", onLeave);

    // The camera keeps every panel mounted at all times, so "mounted" is not
    // "on screen" — without this the loop would burn frames behind the other
    // four sections for the whole visit.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(wrap);

    // --- forward-pass state -------------------------------------------
    // Starts one step before the input layer: a pass begins out in the
    // unseen part of the network and arrives along the upstream strands.
    const GHOST_IN_LAYER = -1;
    let passLayer = GHOST_IN_LAYER - 1;
    let passTimer = 0;
    const rand = mulberry32(7);

    const igniteLayer = (li: number) => {
      if (li === GHOST_IN_LAYER) {
        // Seed a random subset of the upstream anchors so no two passes
        // arrive the same way.
        let any = false;
        for (const n of neurons) {
          if (n.layer === GHOST_IN_LAYER && rand() > 0.35) {
            n.act = 1;
            any = true;
          }
        }
        if (!any) {
          const first = neurons.find((n) => n.layer === GHOST_IN_LAYER);
          if (first) first.act = 1;
        }
      }
      for (const e of edges) {
        const from = neurons[e.a];
        if (from.layer !== li || from.act <= 0.45) continue;
        // Off-frame strands are few, so they fire more readily than the
        // dense interior edges — otherwise the pass often has no visible
        // entry or exit.
        if (rand() < (e.ghost ? 0.75 : PULSE_DENSITY)) e.pulse = 0;
      }
    };

    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(now - last, 64);
      last = now;
      if (!visible || cssW === 0) return;

      // --- advance simulation ----------------------------------------
      if (!reduceMotion) {
        passTimer -= dt;
        if (passTimer <= 0) {
          passLayer++;
          if (passLayer >= LAYER_COUNT) {
            passLayer = GHOST_IN_LAYER - 1;
            passTimer = PASS_GAP_MS;
          } else {
            igniteLayer(passLayer);
            passTimer = STEP_MS;
          }
        }

        for (const e of edges) {
          if (e.pulse < 0) continue;
          e.pulse += dt;
          if (e.pulse >= STEP_MS) {
            e.pulse = -1;
            neurons[e.b].act = 1; // signal lands: the target fires
          }
        }

        const decay = Math.pow(0.5, dt / DECAY_MS);
        for (const n of neurons) n.act *= decay;
      } else if (neurons[0].act === 0) {
        for (const n of neurons) n.act = 0.3;
      }

      pointerX += (pointerTargetX - pointerX) * 0.06;
      pointerY += (pointerTargetY - pointerY) * 0.06;

      // --- project ----------------------------------------------------
      const yaw =
        (reduceMotion ? 0.22 : Math.sin((now / YAW_PERIOD_MS) * Math.PI * 2) * YAW_AMPLITUDE) +
        pointerX * 0.24;
      const pitch =
        (reduceMotion ? 0 : Math.sin((now / PITCH_PERIOD_MS) * Math.PI * 2) * PITCH_AMPLITUDE) +
        pointerY * -0.16;

      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      // Placed toward the right of a canvas that spans the whole panel, and
      // scaled against a nominal panel size rather than the canvas box, so
      // the net keeps its size instead of ballooning with the bigger canvas.
      const ox = cssW * NET_CENTER_X;
      const oy = cssH * NET_CENTER_Y;
      const fit = Math.min(cssW / 1800, cssH / 1120);

      const project = (lx: number, ly: number, lz: number) => {
        const x1 = lx * cy + lz * sy;
        const z1 = -lx * sy + lz * cy;
        const y1 = ly * cp - z1 * sp;
        const z2 = ly * sp + z1 * cp;
        const d = FOCAL / (FOCAL + z2);
        return { sx: ox + x1 * d * fit, sy: oy + y1 * d * fit, depth: d };
      };

      for (const n of neurons) {
        const p = project(n.x, n.y, n.z);
        n.sx = p.sx;
        n.sy = p.sy;
        n.depth = p.depth;
      }

      // --- render -----------------------------------------------------
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.lineCap = "round";

      // Idle edges are batched into three depth tiers rather than stroked one
      // by one: a fully-connected net is ~400 edges, and 400 separate strokes
      // per frame is the difference between 60fps and not.
      const tiers: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
      const live: Edge[] = [];
      const ghosts: Edge[] = [];
      for (const e of edges) {
        if (e.ghost) {
          ghosts.push(e);
          continue;
        }
        const a = neurons[e.a];
        const b = neurons[e.b];
        if (e.pulse >= 0 || a.act > 0.06) {
          live.push(e);
          continue;
        }
        const depth = (a.depth + b.depth) / 2;
        const tier = depth < 0.93 ? 0 : depth < 1.06 ? 1 : 2;
        tiers[tier].moveTo(a.sx, a.sy);
        tiers[tier].lineTo(b.sx, b.sy);
      }
      const tierAlpha = [0.07, 0.12, 0.19];
      for (let t = 0; t < tiers.length; t++) {
        ctx.strokeStyle = `rgba(${EDGE_RGB}, ${tierAlpha[t]})`;
        ctx.lineWidth = 0.6 + t * 0.2;
        ctx.stroke(tiers[t]);
      }

      // Strands leaving the frame. Stepped alpha down the length rather than a
      // gradient object, which would mean an allocation per strand per frame:
      // they start at the neuron and dissolve before the canvas edge, so
      // nothing ever terminates in a visible stub.
      for (const e of ghosts) {
        const outward = neurons[e.b].layer >= LAYER_COUNT; // ghost end
        const near = outward ? neurons[e.a] : neurons[e.b];
        const far = outward ? neurons[e.b] : neurons[e.a];
        const heat = Math.max(near.act, e.pulse >= 0 ? 0.5 : 0);
        const head = (0.16 + heat * 0.34) * near.depth;

        for (let s = 0; s < GHOST_FADE_STEPS; s++) {
          const t0 = s / GHOST_FADE_STEPS;
          const t1 = (s + 1) / GHOST_FADE_STEPS;
          // Cubic falloff so the strand thins out fast and the tail is
          // already invisible well inside the frame.
          const k = 1 - t0;
          const a0 = head * k * k * k;
          if (a0 < 0.004) break;
          ctx.strokeStyle = `rgba(${heat > 0.05 ? ACCENT_RGB : EDGE_RGB}, ${a0})`;
          ctx.lineWidth = (heat > 0.05 ? 0.9 : 0.7) * near.depth;
          ctx.beginPath();
          ctx.moveTo(near.sx + (far.sx - near.sx) * t0, near.sy + (far.sy - near.sy) * t0);
          ctx.lineTo(near.sx + (far.sx - near.sx) * t1, near.sy + (far.sy - near.sy) * t1);
          ctx.stroke();
        }

        // A pulse on a strand dims as it heads out of frame and brightens as
        // it comes in, so signal enters and leaves rather than popping.
        if (e.pulse >= 0) {
          const a = neurons[e.a];
          const b = neurons[e.b];
          const t = e.pulse / STEP_MS;
          const along = outward ? 1 - t : t; // 1 at the neuron end
          const fade = along * along;
          const px = a.sx + (b.sx - a.sx) * t;
          const py = a.sy + (b.sy - a.sy) * t;
          const t0 = Math.max(0, t - 0.2);
          ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${0.5 * fade * near.depth})`;
          ctx.lineWidth = 1.7 * near.depth;
          ctx.beginPath();
          ctx.moveTo(a.sx + (b.sx - a.sx) * t0, a.sy + (b.sy - a.sy) * t0);
          ctx.lineTo(px, py);
          ctx.stroke();

          ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.9 * fade * near.depth})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.8 * near.depth, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Edges carrying (or having just carried) signal, drawn individually.
      for (const e of live) {
        const a = neurons[e.a];
        const b = neurons[e.b];
        const depth = (a.depth + b.depth) / 2;
        const heat = Math.max(a.act, e.pulse >= 0 ? 0.55 : 0);
        ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${0.1 + heat * 0.3})`;
        ctx.lineWidth = 0.9 * depth;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();

        // Travelling signal: a short bright trail plus a head dot.
        if (e.pulse >= 0) {
          const t = e.pulse / STEP_MS;
          const px = a.sx + (b.sx - a.sx) * t;
          const py = a.sy + (b.sy - a.sy) * t;
          const t0 = Math.max(0, t - 0.2);
          ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${0.55 * depth})`;
          ctx.lineWidth = 1.8 * depth;
          ctx.beginPath();
          ctx.moveTo(a.sx + (b.sx - a.sx) * t0, a.sy + (b.sy - a.sy) * t0);
          ctx.lineTo(px, py);
          ctx.stroke();

          ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.95 * depth})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.9 * depth, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Far neurons first so near ones overlap them.
      const order = neurons.map((_, i) => i).sort((i, j) => neurons[i].depth - neurons[j].depth);
      for (const i of order) {
        const n = neurons[i];
        if (n.layer < 0 || n.layer >= LAYER_COUNT) continue; // off-frame anchor
        const act = Math.min(n.act, 1);
        const r = (2.4 + act * 2.4) * n.depth;

        if (act > 0.04) {
          const size = (20 + act * 26) * n.depth;
          ctx.globalAlpha = Math.min(1, act * 1.05);
          ctx.drawImage(glow, n.sx - size / 2, n.sy - size / 2, size, size);
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.35 + act * 0.65})`;
        } else {
          ctx.fillStyle = `rgba(${IDLE_RGB}, ${Math.max(0.3, (n.depth - 0.75) * 1.15)})`;
        }
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Expanding ring on firing neurons — reads as the node discharging.
        if (act > 0.4) {
          ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${(act - 0.4) * 0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.sx, n.sy, r + 4 + (1 - act) * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Layer captions, projected with the geometry so they sit under their
      // own plane and travel with the rotation.
      ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      for (let li = 0; li < LAYER_COUNT; li++) {
        const grid = LAYER_GRID[li];
        const lx = (li - (LAYER_COUNT - 1) / 2) * LAYER_GAP;
        const p = project(lx, CAPTION_Y, 0);
        if (p.sy > cssH - 8) continue; // never let a caption run off the bottom
        const layerLit = neurons
          .slice(layerStart[li], layerStart[li] + LAYER_SIZE[li])
          .reduce((m, n) => Math.max(m, n.act), 0);
        ctx.fillStyle =
          layerLit > 0.2
            ? `rgba(${ACCENT_RGB}, ${0.35 + layerLit * 0.4})`
            : `rgba(${IDLE_RGB}, 0.3)`;
        ctx.fillText(grid.label, p.sx, p.sy);
      }

      // Dissolve the canvas edges. destination-out erases by alpha, so the
      // mesh, the strands and the captions all fade out together toward the
      // panel instead of stopping along a rectangle — the long left-hand
      // ramp is what clears the space beside the name.
      ctx.globalCompositeOperation = "destination-out";
      if (halo) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(1, (cssH * HALO_RY) / haloR);
        ctx.fillStyle = halo;
        const reach = haloR * 3;
        ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
        ctx.restore();
      }
      for (const g of [fadeL, fadeR, fadeT, fadeB]) {
        if (!g) continue;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cssW, cssH);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      pointerHost.removeEventListener("pointermove", onMove);
      pointerHost.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="netviz" ref={wrapRef}>
      <canvas className="netviz-canvas" ref={canvasRef} />
    </div>
  );
}

export default memo(NeuralNet);
