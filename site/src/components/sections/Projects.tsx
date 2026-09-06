import { memo } from "react";
import { useTilt } from "../../hooks/useTilt";

function Projects() {
  const wideTilt = useTilt<HTMLDivElement>(4);
  const latencyTilt = useTilt<HTMLDivElement>(6);
  const ganTilt = useTilt<HTMLDivElement>(4);
  const dockerTilt = useTilt<HTMLDivElement>(4);

  return (
    <div className="panel panel--projects">
      <div className="panel-kicker-row">
        <div className="panel-kicker">&gt; BUILDS — REPO[]</div>
        <div className="panel-kicker-dim">COUNT: 04</div>
      </div>

      <div className="projects-grid">
        <div className="card card--wide" ref={wideTilt}>
          <div className="card-top">
            <div>
              <div className="card-title">Neural Redactor</div>
              <div className="card-tags">
                <span className="tag">NLP</span>
                <span className="tag">PRIVACY</span>
                <span className="tag">PYTORCH</span>
              </div>
            </div>
            <div className="card-links">
              <span>[ SOURCE_CODE ]</span>
              <span>[ DOCS ]</span>
            </div>
          </div>
          <div className="card-media" />
          <p className="card-desc">
            An automated PII masking system leveraging transformer-based NER
            for real-time redaction of sensitive data in distributed logs.
            Reduced manual oversight requirements by 84%.
          </p>
        </div>

        <div className="card" ref={latencyTilt}>
          <div className="card-index">[ 02 ]</div>
          <div className="card-title card-title--sm">LATENCY_CORE_V3</div>
          <p className="card-desc">
            C++ inference engine optimized for ARM architectures. Sub-5ms
            response time on edge devices.
          </p>
          <div className="card-status">
            STATUS: <span className="accent">DEPLOYED</span>
          </div>
        </div>

        <div className="card card--row" ref={ganTilt}>
          <div>
            <div className="card-title card-title--sm">GAN_SYNTH_24</div>
            <p className="card-desc">
              Synthetic dataset generation for autonomous navigation training.
            </p>
          </div>
          <div className="card-media card-media--sm">BINARY_STREAM_RENDER…</div>
        </div>

        <div className="card card--between" ref={dockerTilt}>
          <div>
            <div className="card-title card-title--sm">DOCKER_SWARM_ORCHESTRATOR</div>
            <p className="card-desc">
              Distributed GPU resource management for multi-tenant training.
            </p>
          </div>
          <div className="card-btn">OPEN_PROJECT</div>
        </div>
      </div>
    </div>
  );
}

export default memo(Projects);
