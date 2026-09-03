import { useEffect, useState } from "react";

const LINES = [
  "KERNEL .................................. LOADED",
  "NEURAL_MODULES ........................... LOADED",
  "MEM/PROJECTS .............................. MOUNTED",
  "MEM/EXPERIENCE ............................ MOUNTED",
  "GPU_ALLOCATION ............................. VERIFIED",
  "SECURE_SHELL ................................ ESTABLISHED",
  "RENDER_PIPELINE .............................. READY",
];

const LINE_STEP_MS = 180;
const AFTER_LINES_PAUSE_MS = 420;
const FADE_MS = 500;

export default function BootLoader({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    LINES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setVisibleLines(i + 1), i * LINE_STEP_MS));
    });
    timers.push(
      window.setTimeout(() => setReady(true), LINES.length * LINE_STEP_MS + AFTER_LINES_PAUSE_MS)
    );
    timers.push(
      window.setTimeout(() => setExiting(true), LINES.length * LINE_STEP_MS + AFTER_LINES_PAUSE_MS + 700)
    );
    timers.push(
      window.setTimeout(
        onDone,
        LINES.length * LINE_STEP_MS + AFTER_LINES_PAUSE_MS + 700 + FADE_MS
      )
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`boot ${exiting ? "boot--exit" : ""}`} style={{ transitionDuration: `${FADE_MS}ms` }}>
      <div className="boot-scan" />
      <div className="boot-window">
        <div className="boot-titlebar">
          <div className="boot-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="boot-titlebar-text">root@portfolio_os — boot</div>
        </div>
        <div className="boot-body">
          <div className="boot-meta">PORTFOLIO_OS v1.0</div>
          <div className="boot-meta boot-meta--dim">BOOT SEQUENCE INITIATED</div>

          <div className="boot-lines">
            {LINES.map((line, i) => (
              <div key={line} className="boot-line" style={{ opacity: i < visibleLines ? 1 : 0 }}>
                <span className="boot-ok">[OK]</span>
                <span>{line}</span>
              </div>
            ))}
          </div>

          {visibleLines >= LINES.length && (
            <>
              <div className="boot-meta boot-meta--dim" style={{ marginTop: 32 }}>
                PROGRESS
              </div>
              <div className="boot-progress">[████████████████████████████████████████████] 100%</div>
            </>
          )}

          {ready && (
            <div className="boot-launch">
              SYSTEM_READY. LAUNCHING INTERFACE<span className="cursor" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
