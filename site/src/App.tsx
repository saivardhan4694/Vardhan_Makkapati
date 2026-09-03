import { useState } from "react";
import BootLoader from "./components/BootLoader";
import Scene from "./components/Scene";

export default function App() {
  const [booted, setBooted] = useState(false);

  return (
    <>
      {!booted && <BootLoader onDone={() => setBooted(true)} />}
      {booted && <Scene />}
    </>
  );
}
