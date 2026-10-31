import { useState } from "react";
import BootLoader from "./components/BootLoader";
import Scene from "./components/Scene";
import AgentTerminal from "./components/agent/AgentTerminal";
import LinearScene from "./components/LinearScene";
import { useLayoutMode } from "./lib/layoutMode";

export default function App() {
  const [booted, setBooted] = useState(false);
  // Camera scene on large mouse/trackpad screens, linear layout everywhere else.
  const mode = useLayoutMode();

  return (
    <>
      {!booted && <BootLoader onDone={() => setBooted(true)} />}
      {booted && (mode === "camera" ? <Scene /> : <LinearScene />)}
      {/* Renders nothing unless VITE_AGENT_API_URL was set at build time. */}
      {booted && <AgentTerminal />}
    </>
  );
}
