import { forwardRef, memo } from "react";
import { decoEdges, decoNodes, pathEdges, mainNodes, nodeCenter, worldBounds } from "../data/graph";

const MAIN_R = 34;
const RING_R = 46;

// Static decorative mesh — never depends on activeIndex, so it's memoized
// and never re-renders (React would otherwise re-diff ~130 elements on
// every activeIndex flip, right as the camera is busiest mid-transition).
const DecorativeMesh = memo(function DecorativeMesh() {
  return (
    <>
      {decoEdges.map((e, i) => (
        <line key={`de-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="edge edge--dim" />
      ))}
      {decoNodes.map((d, i) => (
        <circle key={`dn-${i}`} cx={d.x} cy={d.y} r={d.r} className="deco-node" />
      ))}
    </>
  );
});

// Rendered ABOVE the node panels and crossfaded by scroll-camera scale (see
// Scene.tsx): invisible while a node is in focus (so the panel reads clean),
// fully visible while the camera is pulled back into the "hive" overview —
// that's what lets a small/unreadable-at-a-distance panel still read as a
// labeled node in the network.
const GraphLayer = forwardRef<SVGSVGElement, { activeIndex: number; showSignals: boolean }>(
  function GraphLayer({ activeIndex, showSignals }, ref) {
  return (
    <svg
      ref={ref}
      className="graph-layer"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: worldBounds.maxX,
        height: worldBounds.maxY,
        pointerEvents: "none",
        opacity: 0,
      }}
      viewBox={`0 0 ${worldBounds.maxX} ${worldBounds.maxY}`}
    >
      <DecorativeMesh />

      {pathEdges.map((e, i) => {
        const isCurrent = e.aIndex === activeIndex || e.bIndex === activeIndex;
        const pathId = `path-edge-${i}`;
        return (
          <g key={`pe-${i}`}>
            <line
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              className={isCurrent ? "edge edge--path edge--current" : "edge edge--path"}
            />
            {showSignals && (
              <>
                <path id={pathId} d={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`} fill="none" stroke="none" />
                <circle r="3.5" className="signal-dot">
                  <animateMotion dur="2.8s" repeatCount="indefinite" rotate="0">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.85;1"
                    dur="2.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            )}
          </g>
        );
      })}

      {mainNodes.map((n, i) => {
        const c = nodeCenter(n);
        const isActive = i === activeIndex;
        return (
          <g key={n.id} className={isActive ? "main-node is-active" : "main-node"}>
            <circle cx={c.x} cy={c.y} r={RING_R} className="main-node-ring" />
            <circle cx={c.x} cy={c.y} r={MAIN_R} className="main-node-circle" />
            <text x={c.x} y={c.y + 5} textAnchor="middle" className="main-node-index">
              {String(i + 1).padStart(2, "0")}
            </text>
            <text x={c.x} y={c.y + RING_R + 26} textAnchor="middle" className="main-node-label">
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

export default GraphLayer;
