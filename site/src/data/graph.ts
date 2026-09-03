// World-space layout for the scroll-camera scene.
// Coordinates are in "world px" at camera scale 1. Main nodes are laid out
// as a SEQUENCE (a path graph) so the camera can travel edge-to-edge in
// order: hero -> about -> skills -> projects -> education. Decorative nodes
// are scattered around the path purely for the "network" visual texture —
// they carry no navigation meaning.

export const NODE_W = 1440;
export const NODE_H = 900;

export interface MainNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
}

// Raw layout before normalization — a gentle zigzag so edges aren't collinear.
// A winding, genuinely 2D layout (not a straight or zigzag horizontal
// chain) — each hop changes direction, the way a real knowledge-graph
// layout would, while keeping consecutive nodes roughly equidistant.
const RAW_MAIN_NODES: MainNode[] = [
  { id: "hero", label: "HERO", sub: "ENTRY_POINT", x: 0, y: 0 },
  { id: "about", label: "ABOUT", sub: "PROFILE.SYS", x: 1300, y: 950 },
  { id: "skills", label: "SKILLS", sub: "STACK.JSON", x: 2650, y: 260 },
  { id: "projects", label: "PROJECTS", sub: "REPO[]:04", x: 1950, y: -1080 },
  { id: "education", label: "EDUCATION", sub: "LOG.ACADEMIC", x: 3350, y: -680 },
];

// Deterministic PRNG so the decorative scatter is stable across renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1337);

// Scatter bounds padding around the main path, before normalization.
const PAD = 700;
const rawMinX = Math.min(...RAW_MAIN_NODES.map((n) => n.x)) - PAD;
const rawMaxX = Math.max(...RAW_MAIN_NODES.map((n) => n.x + NODE_W)) + PAD;
const rawMinY = Math.min(...RAW_MAIN_NODES.map((n) => n.y)) - PAD - 500;
const rawMaxY = Math.max(...RAW_MAIN_NODES.map((n) => n.y + NODE_H)) + PAD + 500;

export interface DecoNode {
  x: number;
  y: number;
  r: number;
}

const DECO_COUNT = 46;
const RAW_DECO_NODES: DecoNode[] = Array.from({ length: DECO_COUNT }, () => ({
  x: rawMinX + rand() * (rawMaxX - rawMinX),
  y: rawMinY + rand() * (rawMaxY - rawMinY),
  r: 2 + rand() * 2.5,
}));

// Normalize so the whole world starts at (0, 0).
const OFFSET_X = rawMinX;
const OFFSET_Y = rawMinY;

export const mainNodes: MainNode[] = RAW_MAIN_NODES.map((n) => ({
  ...n,
  x: n.x - OFFSET_X,
  y: n.y - OFFSET_Y,
}));

export const decoNodes: DecoNode[] = RAW_DECO_NODES.map((n) => ({
  ...n,
  x: n.x - OFFSET_X,
  y: n.y - OFFSET_Y,
}));

export const worldBounds = {
  minX: 0,
  minY: 0,
  maxX: rawMaxX - OFFSET_X,
  maxY: rawMaxY - OFFSET_Y,
};

export function nodeCenter(n: MainNode) {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
}

// Decorative edges: each deco node links to its nearest main node, plus a
// handful of short deco-to-deco links so the scatter reads as a mesh rather
// than isolated dust.
export interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dim?: boolean;
  aIndex?: number;
  bIndex?: number;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export const decoEdges: Edge[] = [];
for (const d of decoNodes) {
  let nearest: MainNode | null = null;
  let best = Infinity;
  for (const m of mainNodes) {
    const c = nodeCenter(m);
    const dd = dist(d.x, d.y, c.x, c.y);
    if (dd < best) {
      best = dd;
      nearest = m;
    }
  }
  if (nearest && best < 2600) {
    const c = nodeCenter(nearest);
    decoEdges.push({ x1: d.x, y1: d.y, x2: c.x, y2: c.y, dim: true });
  }
}
for (let i = 0; i < decoNodes.length; i++) {
  for (let j = i + 1; j < decoNodes.length; j++) {
    const a = decoNodes[i];
    const b = decoNodes[j];
    const dd = dist(a.x, a.y, b.x, b.y);
    if (dd < 420 && rand() > 0.55) {
      decoEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, dim: true });
    }
  }
}

// The main path edges, drawn bright/solid — this is the literal sequence
// the camera travels along.
export const pathEdges: Edge[] = [];
for (let i = 0; i < mainNodes.length - 1; i++) {
  const a = nodeCenter(mainNodes[i]);
  const b = nodeCenter(mainNodes[i + 1]);
  pathEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, aIndex: i, bIndex: i + 1 });
}
