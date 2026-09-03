import { mainNodes, nodeCenter, NODE_W } from "./graph";

export interface CameraKeyframe {
  cx: number;
  cy: number;
  scale: number; // relative to "focus" scale (1 = framed on a node, <1 = pulled back)
  kind: "focus" | "hive";
  nodeIndex: number; // the node this keyframe is associated with (for hive: the node being departed)
  label: string;
}

// Focus keyframe on every main node, with a "hive" pull-back keyframe
// travelling along the connecting edge between each consecutive pair.
// This is what makes the transition a literal move along the graph's
// edges rather than a return-to-hub every time.
export const HIVE_ZOOM = 0.32;
// Focus locks at an exact 1:1 frame — an overshoot above 1.0 scales every
// panel's internal padding too, which crops content up into the fixed nav
// bar. The "deeper zoom" feel comes from HIVE_ZOOM's pull-back instead.
export const FOCUS_SCALE = 1;

export const cameraKeyframes: CameraKeyframe[] = (() => {
  const kfs: CameraKeyframe[] = [];
  mainNodes.forEach((node, i) => {
    const c = nodeCenter(node);
    kfs.push({ cx: c.x, cy: c.y, scale: FOCUS_SCALE, kind: "focus", nodeIndex: i, label: node.label });

    if (i < mainNodes.length - 1) {
      const next = nodeCenter(mainNodes[i + 1]);
      kfs.push({
        cx: (c.x + next.x) / 2,
        cy: (c.y + next.y) / 2,
        scale: HIVE_ZOOM,
        kind: "hive",
        nodeIndex: i,
        label: `${node.label} -> ${mainNodes[i + 1].label}`,
      });
    }
  });
  return kfs;
})();

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface CameraState {
  cx: number;
  cy: number;
  scale: number; // multiplier applied on top of the viewport's base "1x fit" scale
  activeIndex: number; // nearest main node index, for HUD/nav highlighting
  segmentLabel: string;
}

/**
 * Maps global scroll progress [0,1] to a camera state by lerping between
 * consecutive keyframes, easing within each segment.
 */
export function cameraAt(progress: number): CameraState {
  const n = cameraKeyframes.length;
  const p = Math.min(Math.max(progress, 0), 1) * (n - 1);
  let i = Math.floor(p);
  if (i >= n - 1) i = n - 2;
  const localT = easeInOutCubic(p - i);

  const a = cameraKeyframes[i];
  const b = cameraKeyframes[i + 1];

  const cx = a.cx + (b.cx - a.cx) * localT;
  const cy = a.cy + (b.cy - a.cy) * localT;
  const scale = a.scale + (b.scale - a.scale) * localT;

  const activeIndex = localT < 0.5 ? a.nodeIndex : b.kind === "focus" ? b.nodeIndex : a.nodeIndex;

  return { cx, cy, scale, activeIndex, segmentLabel: localT < 0.5 ? a.label : b.label };
}

export const TOTAL_SEGMENTS = cameraKeyframes.length - 1;
export const REFERENCE_WIDTH = NODE_W;
