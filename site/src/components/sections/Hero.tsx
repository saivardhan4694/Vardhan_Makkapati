import { memo } from "react";

function Hero() {
  return (
    <div className="panel panel--hero">
      <div className="hero-kicker">— HELLO, I'M SIVA —</div>
      <h1 className="hero-title">
        AI_ENGINEER
        <br />
        DEEP_LEARNING_OPS
        <span className="cursor" />
      </h1>
      <p className="hero-sub">
        Specializing in architectural neural design and high-density data pipelines.
        <br />
        Optimizing for latency, scale, and algorithmic precision.
      </p>
      <div className="hero-stat">
        <div className="hero-stat-label">PROJECTS_SHIPPED</div>
        <div className="hero-stat-value">04</div>
      </div>
      <div className="hero-hint">
        <div>SCROLL TO ZOOM OUT — NETWORK VIEW</div>
        <div className="hero-hint-arrow">▾</div>
      </div>
    </div>
  );
}

export default memo(Hero);
