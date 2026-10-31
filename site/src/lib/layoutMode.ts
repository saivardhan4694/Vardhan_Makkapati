import { createContext, useContext, useSyncExternalStore } from "react";

// The scroll-camera scene is built around fixed 1440x900 panels, so it only
// reads well on a large screen driven by a mouse or trackpad. Everything else
// (phones, tablets incl. iPad, small laptop windows, touch-first devices)
// gets the linear layout: same sections, same data, normal document flow.
export const CAMERA_QUERY =
  "(min-width: 1200px) and (min-height: 700px) and (hover: hover) and (pointer: fine)";

export type LayoutMode = "camera" | "linear";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(CAMERA_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getSnapshot = (): LayoutMode => (window.matchMedia(CAMERA_QUERY).matches ? "camera" : "linear");

/** Live layout mode — flips if the window is resized or rotated across the breakpoint. */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, getSnapshot, () => "camera");
}

/**
 * Which layout a section panel is being rendered into. The camera scene
 * never provides it, so panels keep their original desktop behaviour by
 * default; LinearScene provides "linear".
 */
export const LayoutContext = createContext<LayoutMode>("camera");

export const useIsLinear = () => useContext(LayoutContext) === "linear";
