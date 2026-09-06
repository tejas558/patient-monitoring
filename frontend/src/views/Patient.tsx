import { DualChart, Ecg, Gauge, MultiChart } from "../components/Charts";
import { crashPatient } from "../api";
import type { Alert, Patient } from "../types";
import { formatSim } from "./Ward";

export function PatientView({
  p,
  alerts,
  simTime,
  onBack,
}: {
  p: Patient;
  alerts: Alert[];
  simTime: string;
  onBack: () => void;
}) {
  const mine = alerts.filter((a) => a.patient_id === p.id);
  return (
    <div className="page">
      <div className="topbar" style={{ padding: 0 }}>
        <button className="btn ghost" onClick={onBack}>
          ← Ward
        </button>
        <div className="clock">{formatSim(simTime)}</div>
      </div>
      <div className="identity">
        <div>
          <div className="bed">
            {p.bed} · MRN {p.mrn} · {p.device}
          </div>
          <h2>{p.name}</h2>
          <div className="sub">
            {p.age}{p.sex} · {p.condition} · admitted {p.admit} · allergies {p.allergies}
          </div>
        </div>
        <div className="actions">
          <Gauge value={p.aura} />
          <div>
            <span className={`risk ${p.risk}`}>{p.risk}</span>
            {p.intersecting && (
              <div className="xbadge" style={{ marginTop: 8, display: "inline-block" }}>
                HRV × temp
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button className="btn danger" onClick={() => crashPatient(p.id)}>
                Induce deterioration
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="vital-grid">
        <Vital loinc="8867-4" lab="Heart rate" num={`${p.vitals.hr}`} unit="/min" warn={p.vitals.hr >= 100} />
        <Vital loinc="80439-3" lab="HRV RMSSD" num={p.vitals.hrv.toFixed(0)} unit="ms" warn={p.vitals.hrv <= 22} />
        <Vital loinc="8310-5" lab="Temperature" num={p.vitals.temp.toFixed(1)} unit="°C" warn={p.vitals.temp >= 38} />
        <Vital loinc="2708-6" lab="SpO₂" num={`${p.vitals.spo2}`} unit="%" warn={p.vitals.spo2 <= 94} />
        <Vital loinc="9279-1" lab="Resp rate" num={`${p.vitals.rr}`} unit="/min" warn={p.vitals.rr >= 22} />
        <Vital loinc="8480-6" lab="NIBP" num={`${p.vitals.sbp}/${p.vitals.dbp}`} unit={`MAP ${p.vitals.map}`} warn={p.vitals.sbp <= 100} />
      </div>

      <div className="panel">
        <h3>Lead II · derived from wearable pulse</h3>
        <Ecg hr={p.vitals.hr} />
      </div>

      <div className="panels">
        <div className="panel">
          <h3>HRV × temperature — the intersection the model watches</h3>
          <div className="legend">
            <span><i className="swatch" style={{ background: "#3d6a57" }} /> HRV (ms)</span>
            <span><i className="swatch" style={{ background: "#b24e3c" }} /> Temp (°C)</span>
          </div>
          <DualChart history={p.history} />
        </div>
        <div className="panel">
          <h3>Why this score</h3>
          <div className="reasons">
            {p.reasons.length === 0 && (
              <div className="reason">No deterioration geometry. Isolation Forest inside baseline envelope.</div>
            )}
            {p.reasons.map((r) => (
              <div className="reason" key={r}>{r}</div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {p.contributions.map((c) => (
              <div className="contrib" key={c.feature}>
                <span>{c.feature}</span>
                <span className={c.z >= 0 ? "zpos" : "zneg"}>
                  {c.z >= 0 ? "+" : ""}
                  {c.z.toFixed(2)}σ
                </span>
              </div>
            ))}
          </div>
          <div className="reason" style={{ marginTop: 12 }}>
            Isolation Forest {p.if_score.toFixed(3)} · NEWS2 {p.news2} · AURA {p.aura}
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Windowed vitals (HR, SpO₂, RR, SBP)</h3>
        <div className="legend">
          <span><i className="swatch" style={{ background: "#4a6178" }} /> HR</span>
          <span><i className="swatch" style={{ background: "#3d6a57" }} /> SpO₂</span>
          <span><i className="swatch" style={{ background: "#a56f2a" }} /> RR</span>
          <span><i className="swatch" style={{ background: "#8a8376" }} /> SBP</span>
        </div>
        <MultiChart history={p.history} />
      </div>

      {mine.length > 0 && (
        <div className="panel">
          <h3>FHIR tasks for this patient</h3>
          {mine.map((a) => (
            <div key={a.id} className="reason" style={{ marginBottom: 8 }}>
              <b>{a.id.toUpperCase()}</b> · {a.title} · {a.status} · {a.latency_ms.toFixed(0)} ms
              <div>{a.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Vital({
  loinc,
  lab,
  num,
  unit,
  warn,
}: {
  loinc: string;
  lab: string;
  num: string;
  unit: string;
  warn: boolean;
}) {
  return (
    <div className="vital">
      <div className="loinc">{loinc}</div>
      <div className="num" style={{ color: warn ? "var(--clay)" : undefined }}>{num}</div>
      <div className="lab">{lab} · {unit}</div>
    </div>
  );
}
