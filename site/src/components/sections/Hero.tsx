import { memo, useEffect, useState } from "react";
import NeuralNet from "../NeuralNet";
import {
  ROLE_TITLE,
  ROLE_TAGLINE,
  CURRENT_ROLE,
  CURRENT_COMPANY,
  TOP_SKILLS,
} from "../../data/highlights";

const LINE_1 = "SAI VARDHAN";
const LINE_2 = "MAKKAPATI";
const TOTAL_CHARS = LINE_1.length + LINE_2.length;
const MS_PER_CHAR = 32;

function Hero() {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (charCount >= TOTAL_CHARS) return;
    const id = window.setTimeout(() => setCharCount((c) => c + 1), MS_PER_CHAR);
    return () => window.clearTimeout(id);
  }, [charCount]);

  const line1Shown = LINE_1.slice(0, Math.min(charCount, LINE_1.length));
  const line2Shown = LINE_2.slice(0, Math.max(0, charCount - LINE_1.length));
  const typingLine2 = charCount > LINE_1.length;
  const nameDone = charCount >= TOTAL_CHARS;

  return (
    <div className="panel panel--hero">
      <div className="hero-main">
        <div className="hero-kicker">— HELLO, I'M —</div>
        <h1 className="hero-title">
          <span className="hero-title-first">
            {line1Shown}
            {!typingLine2 && <span className="cursor" />}
          </span>
          <span className="hero-title-last">
            {line2Shown}
            {typingLine2 && <span className="cursor" />}
          </span>
        </h1>
        <div className={nameDone ? "hero-role hero-role--visible" : "hero-role"}>
          {ROLE_TITLE}
          <span className="hero-role-sep"> // </span>
          {ROLE_TAGLINE}
        </div>
        <p className="hero-sub">
          Specializing in architectural neural design and high-density data pipelines.
          <br />
          Optimizing for latency, scale, and algorithmic precision.
        </p>

        <div className="hero-status">
          <div className="hero-status-row">
            <span className="hero-pulse" />
            <span className="hero-status-key">CURRENTLY</span>
            <span className="hero-status-val">
              {CURRENT_ROLE} @ <span className="accent">{CURRENT_COMPANY}</span>
            </span>
          </div>
          <div className="hero-status-skills">
            {TOP_SKILLS.map((s, i) => (
              <span key={s}>
                {s}
                {i < TOP_SKILLS.length - 1 && <span className="hero-status-sep">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <NeuralNet />

      {/* Outside .hero-main on purpose: it positions itself against the panel,
          and .hero-main is now a positioned element (it has to sit above the
          network canvas), which would otherwise become its containing block
          and pull the hint up onto the role line. */}
      <div className="hero-hint">
        <div>SCROLL TO ZOOM OUT — NETWORK VIEW</div>
        <div className="hero-hint-arrow">▾</div>
      </div>
    </div>
  );
}

export default memo(Hero);
