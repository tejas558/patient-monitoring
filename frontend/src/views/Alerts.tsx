import { useState } from "react";
import { ackAlert } from "../api";
import type { Alert, Snapshot } from "../types";
import { formatSim } from "./Ward";

export function Alerts({
  snap,
  onOpen,
}: {
  snap: Snapshot;
  onOpen: (id: string) => void;
}) {
  const [openFhir, setOpenFhir] = useState<string | null>(null);
  const open = snap.alerts.filter((a) => a.status === "requested").length;

  return (
    <div className="page">
      <div className="topbar" style={{ padding: 0 }}>
        <div>
          <h1>Nurse worklist</h1>
          <div className="meta">
            Automated FHIR Task resources · {open} requested
          </div>
        </div>
        <div className="clock">{formatSim(snap.pipeline.sim_time)}</div>
      </div>
      {snap.alerts.length === 0 && (
        <div className="empty">
          No tasks yet. Isolation Forest is watching the stream — a deterioration
          will land here as Task.status = requested.
        </div>
      )}
      <div className="alert-list">
        {snap.alerts.map((a) => (
          <AlertCard
            key={a.id}
            a={a}
            show={openFhir === a.id}
            onToggle={() => setOpenFhir(openFhir === a.id ? null : a.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function AlertCard({
  a,
  show,
  onToggle,
  onOpen,
}: {
  a: Alert;
  show: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <article className={`acard ${a.priority}`}>
      <div>
        <div className="kind">
          {a.priority} · {a.kind} · {a.id.toUpperCase()}
          {a.intersecting ? " · HRV × temp" : ""}
        </div>
        <h3>{a.title}</h3>
        <p>
          {a.patient_name} · {a.bed} · AURA {a.aura} · {a.latency_ms.toFixed(0)} ms
          to emit
        </p>
        <p style={{ marginTop: 8 }}>{a.summary}</p>
      </div>
      <div className="actions" style={{ flexDirection: "column" }}>
        <span className={`risk ${a.status === "requested" ? "critical" : "stable"}`}>
          {a.status}
        </span>
        {a.status === "requested" && (
          <button className="btn primary" onClick={() => ackAlert(a.id, "accepted")}>
            Acknowledge
          </button>
        )}
        {a.status === "accepted" && (
          <button className="btn" onClick={() => ackAlert(a.id, "completed")}>
            Complete
          </button>
        )}
        <button className="btn ghost" onClick={() => onOpen(a.patient_id)}>
          Open chart
        </button>
        <button className="btn ghost" onClick={onToggle}>
          {show ? "Hide FHIR" : "View FHIR"}
        </button>
      </div>
      {show && <pre className="fhir">{JSON.stringify(a.fhir, null, 2)}</pre>}
    </article>
  );
}
