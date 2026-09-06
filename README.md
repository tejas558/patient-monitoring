# AURA Clinical — RPM sepsis / deterioration predictor

Real-time remote patient monitoring overlay. A streaming bus ingests synthetic wearable vitals; Isolation Forest scores 24-sample windows; when **HRV is falling and temperature is rising**, the service emits a FHIR `Task` onto the nurse worklist.

Built as a portfolio demo for RPM / connected-care teams (Philips, Medtronic, Masimo, Teladoc, Apple Health). **Not a medical device.** All patients are fictional.

## Run

```bash
chmod +x start.sh
./start.sh
```

Then open [http://localhost:5173](http://localhost:5173).

Backend: FastAPI + scikit-learn on `:8000`. Frontend: Vite/React on `:5173` (proxies `/api` and `/ws`).

## What it shows

- **Ward** — 12 beds, live HR / HRV / SpO₂ / temp / BP, AURA risk score
- **Chart** — HRV × temperature intersection, Isolation Forest contributions, NEWS2
- **Alerts** — automated FHIR Task JSON, acknowledge / complete
- **Pipeline** — `rpm.vitals.raw` → `rpm.features.windowed` → `rpm.anomalies.scores` → `rpm.fhir.tasks`

Demo controls: **Crash Elena Voss** forces a sepsis trajectory; **Reset** restores the shift.

## Stack

Kafka-shaped in-process log (swap for Kafka / Kinesis), Python, pandas, scikit-learn Isolation Forest, WebSockets, React dashboard.
