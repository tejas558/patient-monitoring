import { Sparkline } from "../components/Charts";
import type { Patient, Risk, Snapshot } from "../types";

export function Ward({
  snap,
  filter,
  setFilter,
  query,
  setQuery,
  onOpen,
}: {
  snap: Snapshot;
  filter: "all" | Risk;
  setFilter: (v: "all" | Risk) => void;
  query: string;
  setQuery: (v: string) => void;
  onOpen: (id: string) => void;
}) {
  const counts = {
    all: snap.patients.length,
    critical: snap.patients.filter((p) => p.risk === "critical").length,
    watch: snap.patients.filter((p) => p.risk === "watch").length,
    stable: snap.patients.filter((p) => p.risk === "stable").length,
  };
  const q = query.trim().toLowerCase();
  const list = snap.patients.filter((p) => {
    if (filter !== "all" && p.risk !== filter) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.bed.toLowerCase().includes(q) ||
      p.mrn.includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{snap.unit}</h1>
          <div className="meta">
            <span>{snap.nurse}</span>
            <span>{snap.role}</span>
          </div>
        </div>
        <div className="clock">{formatSim(snap.pipeline.sim_time)}</div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="k">Monitored</div>
          <div className="v">{counts.all}</div>
        </div>
        <div className="stat crit">
          <div className="k">Critical</div>
          <div className="v">{counts.critical}</div>
        </div>
        <div className="stat warn">
          <div className="k">Watch</div>
          <div className="v">{counts.watch}</div>
        </div>
        <div className="stat">
          <div className="k">Open FHIR tasks</div>
          <div className="v">
            {snap.alerts.filter((a) => a.status === "requested").length}
          </div>
        </div>
        <div className="stat">
          <div className="k">Alert p95</div>
          <div className="v">{snap.pipeline.model.p95_latency_ms.toFixed(0)}<span className="unit">ms</span></div>
        </div>
      </div>
      <div className="filters">
        {(["all", "critical", "watch", "stable"] as const).map((k) => (
          <button
            key={k}
            className={`chip ${filter === k ? "on" : ""}`}
            onClick={() => setFilter(k)}
          >
            {k === "all" ? "All beds" : k} · {counts[k]}
          </button>
        ))}
        <input
          className="search"
          placeholder="Search name, bed, MRN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid">
        {list.map((p) => (
          <PatientCard key={p.id} p={p} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function PatientCard({ p, onOpen }: { p: Patient; onOpen: (id: string) => void }) {
  const hrs = p.history.map((h) => h.hr);
  const color =
    p.risk === "critical" ? "#b24e3c" : p.risk === "watch" ? "#a56f2a" : "#3d6a57";
  return (
    <button className={`pcard ${p.risk}`} onClick={() => onOpen(p.id)}>
      <div className="pcard-top">
        <span className="bed">{p.bed} · {p.device_vendor}</span>
        <span className={`risk ${p.risk}`}>{p.risk}</span>
      </div>
      <div>
        <div className="pname">{p.name}</div>
        <div className="sub">
          {p.age}{p.sex} · {p.condition}
        </div>
        <div className="device">{p.device}</div>
      </div>
      <Sparkline values={hrs} color={color} />
      <div className="vitals-row">
        <div className="vtile">
          <div className="lab">HR · 8867-4</div>
          <div className={`num ${p.vitals.hr >= 100 ? "hot" : p.vitals.hr >= 90 ? "warm" : ""}`}>
            {p.vitals.hr}
            <span className="unit">/min</span>
          </div>
        </div>
        <div className="vtile">
          <div className="lab">HRV</div>
          <div className={`num ${p.vitals.hrv <= 20 ? "hot" : p.vitals.hrv <= 28 ? "warm" : ""}`}>
            {p.vitals.hrv.toFixed(0)}
            <span className="unit">ms</span>
          </div>
        </div>
        <div className="vtile">
          <div className="lab">Temp</div>
          <div className={`num ${p.vitals.temp >= 38 ? "hot" : p.vitals.temp >= 37.6 ? "warm" : ""}`}>
            {p.vitals.temp.toFixed(1)}
            <span className="unit">°C</span>
          </div>
        </div>
      </div>
      <div className="vitals-row">
        <div className="vtile">
          <div className="lab">SpO₂</div>
          <div className={`num ${p.vitals.spo2 <= 92 ? "hot" : p.vitals.spo2 <= 94 ? "warm" : ""}`}>
            {p.vitals.spo2}<span className="unit">%</span>
          </div>
        </div>
        <div className="vtile">
          <div className="lab">BP</div>
          <div className={`num ${p.vitals.sbp <= 100 ? "hot" : ""}`}>
            {p.vitals.sbp}/{p.vitals.dbp}
          </div>
        </div>
        <div className="vtile">
          <div className="lab">NEWS2</div>
          <div className={`num ${p.news2 >= 5 ? "hot" : p.news2 >= 3 ? "warm" : ""}`}>{p.news2}</div>
        </div>
      </div>
      <div className="aura-row">
        <span>AURA {p.aura}</span>
        <div className="bar">
          <i style={{ width: `${p.aura}%` }} />
        </div>
        {p.intersecting && <span className="xbadge">HRV × temp</span>}
      </div>
    </button>
  );
}

export function formatSim(iso: string) {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])} · ${m[4]}:${m[5]}:${m[6]} sim`;
}
