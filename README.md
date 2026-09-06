# AURA Clinical — RPM sepsis / deterioration predictor

**Live demo:** [https://patient-monitoring-azure.vercel.app](https://patient-monitoring-azure.vercel.app)

Real-time remote patient monitoring overlay. A streaming bus ingests synthetic wearable vitals; Isolation Forest scores 24-sample windows; when **HRV is falling and temperature is rising**, the service emits a FHIR `Task` onto the nurse worklist.

Built as a portfolio demo for RPM / connected-care teams (Philips, Medtronic, Masimo, Teladoc, Apple Health). **Not a medical device.** All patients are fictional.

## Run locally

```bash
chmod +x start.sh
./start.sh
```

Then open [http://localhost:5173](http://localhost:5173).

The Vercel deploy runs the same ward in the browser. Locally you can also start the Python stream (`FastAPI` + scikit-learn Isolation Forest on `:8000`); the dashboard uses it when `/api/health` is up, otherwise it falls back to the client simulator.

## What it shows

- **Ward** — 12 beds, live HR / HRV / SpO₂ / temp / BP, AURA risk score
- **Chart** — HRV × temperature intersection, Isolation Forest contributions, NEWS2
- **Alerts** — automated FHIR Task JSON, acknowledge / complete
- **Pipeline** — `rpm.vitals.raw` → `rpm.features.windowed` → `rpm.anomalies.scores` → `rpm.fhir.tasks`

Demo controls: **Crash Elena Voss** forces a sepsis trajectory; **Reset** restores the shift.

## Stack

Kafka-shaped in-process log (swap for Kafka / Kinesis), Python, pandas, scikit-learn Isolation Forest, WebSockets, React dashboard.
