import { useMemo, useState } from "react";
import { crashPatient, resetSim, useAura } from "./api";
import type { Risk, View } from "./types";
import { Alerts } from "./views/Alerts";
import { Intro } from "./views/Intro";
import { PatientView } from "./views/Patient";
import { Pipeline } from "./views/Pipeline";
import { Ward } from "./views/Ward";

export default function App() {
  const { snap, connected, flash, setFlash } = useAura();
  const [intro, setIntro] = useState(
    () => sessionStorage.getItem("aura-entered") !== "1"
  );
  const [view, setView] = useState<View>("ward");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Risk>("all");
  const [query, setQuery] = useState("");

  const openAlerts = snap?.alerts.filter((a) => a.status === "requested").length ?? 0;
  const patient = useMemo(
    () => snap?.patients.find((p) => p.id === selected) ?? null,
    [snap, selected]
  );

  const openPatient = (id: string) => {
    setSelected(id);
    setView("patient");
  };

  if (intro) {
    return (
      <Intro
        onEnter={() => {
          sessionStorage.setItem("aura-entered", "1");
          setIntro(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <strong>
            A<em>u</em>ra
          </strong>
          <span>Clinical RPM</span>
        </div>
        <div className="live-pill">
          <i className={`dot ${connected ? "on" : "off"}`} />
          {connected ? "stream live" : "reconnecting"}
          {snap ? ` · ${snap.patients.length}` : ""}
        </div>
        <nav>
          <button className={view === "ward" ? "active" : ""} onClick={() => setView("ward")}>
            Ward
          </button>
          <button
            className={view === "alerts" ? "active" : ""}
            onClick={() => setView("alerts")}
          >
            Alerts
            {openAlerts > 0 && <span className="count">{openAlerts}</span>}
          </button>
          <button
            className={view === "pipeline" ? "active" : ""}
            onClick={() => setView("pipeline")}
          >
            Pipeline
          </button>
          {patient && (
            <button
              className={view === "patient" ? "active" : ""}
              onClick={() => setView("patient")}
            >
              {patient.name.split(" ")[0]}
            </button>
          )}
        </nav>
        <div className="side-foot">
          <b>4 West · step-down</b>
          <div>Synthetic wearables · Isolation Forest on HRV × temperature</div>
        </div>
      </aside>

      <main className="main">
        {!snap && <div className="empty">Waiting for the stream…</div>}
        {snap && view === "ward" && (
          <Ward
            snap={snap}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            onOpen={openPatient}
          />
        )}
        {snap && view === "patient" && patient && (
          <PatientView
            p={patient}
            alerts={snap.alerts}
            simTime={snap.pipeline.sim_time}
            onBack={() => setView("ward")}
          />
        )}
        {snap && view === "patient" && !patient && (
          <div className="empty">Select a bed from the ward.</div>
        )}
        {snap && view === "alerts" && <Alerts snap={snap} onOpen={openPatient} />}
        {snap && view === "pipeline" && <Pipeline snap={snap} />}
      </main>

      <div className="demo">
        <span>Demo · synthetic data</span>
        <button onClick={() => crashPatient("elena-voss")}>Crash Elena Voss</button>
        <button className="ghost" onClick={() => resetSim()}>
          Reset
        </button>
      </div>

      {flash && (
        <div className="toast" role="alert">
          <b>{flash.title}</b>
          <p>
            {flash.patient_name} · {flash.bed} · {flash.summary}
          </p>
          <button
            onClick={() => {
              openPatient(flash.patient_id);
              setFlash(null);
            }}
          >
            Open chart
          </button>
          <button
            className="ghost"
            style={{ background: "transparent", color: "#efebe3", border: "1px solid #5b554a" }}
            onClick={() => setFlash(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
