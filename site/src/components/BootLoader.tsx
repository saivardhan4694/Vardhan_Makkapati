import { useEffect, useState } from "react";

const COMMAND = "./boot --target portfolio";

const LINES = [
  ["KERNEL", "LOADED"],
  ["NEURAL_MODULES", "LOADED"],
  ["MEM/PROJECTS", "MOUNTED"],
  ["MEM/EXPERIENCE", "MOUNTED"],
  ["GPU_ALLOCATION", "VERIFIED"],
  ["SECURE_SHELL", "ESTABLISHED"],
  ["RENDER_PIPELINE", "READY"],
];

const BAR_WIDTH = 32;

const TYPE_STEP_MS = 28;
const AFTER_TYPE_PAUSE_MS = 220;
const LINE_STEP_MS = 160;
const PROGRESS_MS = 520;
const READY_HOLD_MS = 650;
const FADE_MS = 500;

// The whole viewport is the terminal: no window chrome, output grows from the
// bottom-left and pushes older lines up, like a real shell.
export default function BootLoader({ onDone }: { onDone: () => void }) {
  const [typed, setTyped] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(-1);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    for (let i = 1; i <= COMMAND.length; i++) at(i * TYPE_STEP_MS, () => setTyped(i));

    const linesStart = COMMAND.length * TYPE_STEP_MS + AFTER_TYPE_PAUSE_MS;
    LINES.forEach((_, i) => at(linesStart + i * LINE_STEP_MS, () => setVisibleLines(i + 1)));

    const progressStart = linesStart + LINES.length * LINE_STEP_MS;
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      at(progressStart + (s * PROGRESS_MS) / steps, () => setProgress(Math.round((s / steps) * 100)));
    }

    const readyAt = progressStart + PROGRESS_MS + 120;
    at(readyAt, () => setReady(true));
    at(readyAt + READY_HOLD_MS, () => setExiting(true));
    at(readyAt + READY_HOLD_MS + FADE_MS, onDone);

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = Math.round((Math.max(progress, 0) / 100) * BAR_WIDTH);
  const typing = typed < COMMAND.length;

  return (
    <div className={`boot ${exiting ? "boot--exit" : ""}`} style={{ transitionDuration: `${FADE_MS}ms` }}>
      <div className="boot-scan" />

      <div className="boot-header">
        <span>PORTFOLIO_OS v1.0</span>
        <span className="boot-header-dim">tty1</span>
      </div>

      <div className="boot-term">
        <div className="boot-meta boot-meta--dim">BOOT SEQUENCE INITIATED</div>

        <div className="boot-line">
          <span className="boot-prompt">root@portfolio_os:~$</span>
          <span>
            {COMMAND.slice(0, typed)}
            {typing && <span className="cursor" />}
          </span>
        </div>

        {LINES.slice(0, visibleLines).map(([name, status]) => (
          <div key={name} className="boot-line boot-line--status">
            <span className="boot-ok">[OK]</span>
            <span>{name}</span>
            <span className="boot-leader" />
            <span>{status}</span>
          </div>
        ))}

        {progress >= 0 && (
          <div className="boot-line">
            <span className="boot-progress">
              [{"█".repeat(filled)}
              <span className="boot-progress-empty">{"░".repeat(BAR_WIDTH - filled)}</span>]
            </span>
            <span>{String(progress).padStart(3, " ")}%</span>
          </div>
        )}

        {ready && (
          <div className="boot-line boot-launch">
            SYSTEM_READY. LAUNCHING INTERFACE<span className="cursor" />
          </div>
        )}
      </div>
    </div>
  );
}
