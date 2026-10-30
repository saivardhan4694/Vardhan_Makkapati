import { useState } from "react";
import BootLoader from "./components/BootLoader";
import Scene from "./components/Scene";
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
    </>
  );
}
