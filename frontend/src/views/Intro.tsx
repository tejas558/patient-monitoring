export function Intro({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="intro">
      <div className="intro-inner">
        <div className="kicker">AURA Clinical · Remote patient intelligence</div>
        <h1>
          The crash is visible
          <br />
          <em>eight minutes early.</em>
        </h1>
        <p className="lede">
          Hospitals and remote care teams are drowning in wearable streams — heart
          rate, SpO₂, blood pressure, temperature. AURA sits on the wire and
          watches the geometry. When heart-rate variability and temperature
          trends intersect a dangerous threshold, a FHIR Task lands on the nurse
          worklist before the floor knows the patient is crashing.
        </p>
        <button className="btn primary" onClick={onEnter}>
          Enter live ward
        </button>
        <div className="vendors">
          <span>Philips</span>
          <span>Medtronic</span>
          <span>Masimo</span>
          <span>Teladoc</span>
          <span>Apple Health</span>
        </div>
        <p className="stack-note">
          Demo ward on synthetic physiology. Streaming bus (Kafka-shaped topics),
          Isolation Forest on 24-sample windows, WebSocket fan-out, automated FHIR
          Task alerts. Not a medical device — a portfolio simulation of an RPM
          early-warning overlay.
        </p>
      </div>
    </div>
  );
}
