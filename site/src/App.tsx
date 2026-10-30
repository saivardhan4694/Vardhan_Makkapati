import { useState } from "react";
import BootLoader from "./components/BootLoader";
import Scene from "./components/Scene";
import AgentTerminal from "./components/agent/AgentTerminal";

export default function App() {
  const [booted, setBooted] = useState(false);

  return (
    <>
      {!booted && <BootLoader onDone={() => setBooted(true)} />}
      {booted && <Scene />}
      {/* Renders nothing unless VITE_AGENT_API_URL was set at build time. */}
      {booted && <AgentTerminal />}
    </>
  );
}
