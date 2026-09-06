import type { Snapshot } from "../types";
import { formatSim } from "./Ward";

const LABELS: Record<string, string> = {
  "rpm.vitals.raw": "Wearable ingest",
  "rpm.features.windowed": "24-sample windows",
  "rpm.anomalies.scores": "Isolation Forest",
  "rpm.fhir.tasks": "FHIR Task emit",
};

export function Pipeline({ snap }: { snap: Snapshot }) {
  const m = snap.pipeline.model;
  return (
    <div className="page">
      <div className="topbar" style={{ padding: 0 }}>
        <div>
          <h1>Streaming pipeline</h1>
          <div className="meta">
            In-process Kafka-shaped log · swap for MSK / Kinesis in production
          </div>
        </div>
        <div className="clock">{formatSim(snap.pipeline.sim_time)}</div>
      </div>

      <div className="topics">
        {snap.pipeline.topics.map((t) => (
          <div className="topic" key={t.name}>
            <header>
              <div>
                <div className="name">{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
                  {LABELS[t.name] ?? t.name}
                </div>
              </div>
              <div className="bed">{t.rate_hz.toFixed(1)} /s</div>
            </header>
            {t.recent
              .slice()
              .reverse()
              .map((e, i) => (
                <div className="ev" key={e.t + e.key + i}>
                  <div className="k">{e.key}</div>
                  {e.summary}
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="model">
        <div className="panel">
          <h3>Model card</h3>
          <p style={{ marginTop: 0, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {m.name} with {m.estimators} trees, contamination {m.contamination}.
            Fitted on {m.trained_windows.toLocaleString()} healthy 24-sample
            windows of HR, HRV, SpO₂, temperature, respiratory rate, SBP and
            their deltas. A FHIR Task fires when the forest flags the window{" "}
            <em>and</em> HRV is falling while core temperature is rising.
          </p>
          <div className="device" style={{ marginTop: 8 }}>
            Features: {m.features.join(" · ")}
          </div>
        </div>
        <div className="metrics">
          <div className="metric">
            <div className="k">True-positive rate</div>
            <div className="v">{(m.tpr * 100).toFixed(1)}%</div>
          </div>
          <div className="metric">
            <div className="k">False-positive rate</div>
            <div className="v">{(m.fpr * 100).toFixed(1)}%</div>
          </div>
          <div className="metric">
            <div className="k">Precision</div>
            <div className="v">{(m.precision * 100).toFixed(1)}%</div>
          </div>
          <div className="metric">
            <div className="k">p50 latency</div>
            <div className="v">{m.p50_latency_ms.toFixed(0)}<span className="unit">ms</span></div>
          </div>
          <div className="metric">
            <div className="k">p95 latency</div>
            <div className="v">{m.p95_latency_ms.toFixed(0)}<span className="unit">ms</span></div>
          </div>
          <div className="metric">
            <div className="k">FHIR tasks</div>
            <div className="v">{snap.pipeline.fhir_tasks}</div>
          </div>
        </div>
      </div>

      <div className="stats" style={{ padding: 0 }}>
        <div className="stat">
          <div className="k">Ingested samples</div>
          <div className="v">{snap.pipeline.ingested.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="k">Windowed</div>
          <div className="v">{snap.pipeline.windowed.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="k">Anomaly scores</div>
          <div className="v">{snap.pipeline.anomalies.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="k">Tick</div>
          <div className="v">15<span className="unit">s sim</span></div>
        </div>
        <div className="stat">
          <div className="k">Wall tick</div>
          <div className="v">{snap.pipeline.wall_tick_ms}<span className="unit">ms</span></div>
        </div>
      </div>
    </div>
  );
}
