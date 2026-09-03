import { memo } from "react";

function About() {
  return (
    <div className="panel panel--about">
      <div className="panel-kicker">&gt; ABOUT — PROFILE.SYS</div>
      <h2 className="panel-title">WHO_AM_I</h2>
      <div className="about-grid">
        <p className="about-copy">
          [YOUR BIO] — a couple of sentences on your background, what kind of
          problems you like solving, and what "AI Engineer / Deep Learning Ops"
          means in your day-to-day. Keep it concrete: systems you've built,
          scale you've operated at, the part of the stack you own end-to-end.
        </p>
        <div className="about-meta">
          <div className="about-meta-row">
            <span className="about-meta-key">BASED_IN</span>
            <span className="about-meta-val">[YOUR LOCATION]</span>
          </div>
          <div className="about-meta-row">
            <span className="about-meta-key">FOCUS</span>
            <span className="about-meta-val">ML Systems / Infra</span>
          </div>
          <div className="about-meta-row">
            <span className="about-meta-key">STATUS</span>
            <span className="about-meta-val accent">OPEN_TO_WORK</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(About);
