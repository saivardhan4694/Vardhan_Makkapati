// Asks the camera (Scene.tsx) to travel to another graph node. An event
// keeps callers decoupled from the camera rig — used by PROFILE's tab jump
// buttons, BUILDS-adjacent links, and STACK's evidence tags alike.
export function goToNode(id: string) {
  window.dispatchEvent(new CustomEvent("nav-node", { detail: { id } }));
}
