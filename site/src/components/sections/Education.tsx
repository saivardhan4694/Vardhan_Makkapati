const LOG = [
  {
    year: "2022",
    school: "STANFORD UNIVERSITY",
    degree: "MS in Computer Science (AI Specialization)",
    courseworkA: ["Deep Multi-Task Learning", "Probabilistic Models", "Natural Language Processing"],
    courseworkB: ["Advanced Robotics", "Convex Optimization"],
  },
  {
    year: "2020",
    school: "MIT",
    degree: "BS in Electrical Engineering & CS",
    courseworkA: ["Signal Processing", "Algorithm Design"],
    courseworkB: ["Compilers", "Microarchitectures"],
  },
];

import { memo } from "react";

function Education() {
  return (
    <div className="panel panel--education">
      <div className="panel-kicker">&gt; EDUCATION — LOG.ACADEMIC</div>
      <h2 className="panel-title">ACADEMIC_LOG</h2>
      <div className="edu-list">
        {LOG.map((row) => (
          <div className="edu-row" key={row.school}>
            <div className="edu-row-left">
              <div className="edu-year">GRAD_YEAR: {row.year}</div>
              <div className="edu-school">{row.school}</div>
              <div className="edu-degree">{row.degree}</div>
            </div>
            <div className="edu-row-right">
              <div className="edu-coursework-label">[ KEY_COURSEWORK ]</div>
              <div className="edu-coursework-cols">
                <div>
                  {row.courseworkA.map((c) => (
                    <div key={c}>+ {c}</div>
                  ))}
                </div>
                <div>
                  {row.courseworkB.map((c) => (
                    <div key={c}>+ {c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(Education);
