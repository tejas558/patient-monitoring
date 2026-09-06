from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Deque, Optional

import numpy as np

from .bus import Bus
from .detector import FEATURE_COLS, Detector
from .fhir import build_task
from .models import (
    AlertOut,
    ModelCard,
    PatientOut,
    PipelineOut,
    Snapshot,
    TopicEvent,
    TopicOut,
    Vitals,
)
from .patients import ROSTER, RosterEntry

WINDOW = 24
HISTORY = 90
TICK_SIM = timedelta(seconds=15)
COOLDOWN_TICKS = 48
UNIT = "4 West"


@dataclass
class LivePatient:
    roster: RosterEntry
    progress: float
    kind: str
    history: Deque[dict] = field(default_factory=lambda: deque(maxlen=HISTORY))
    last_score: Optional[object] = None
    last_alert_tick: int = -10_000
    aura_smooth: float = 12.0
    x_hold: int = 0
    rng: np.random.Generator = field(default_factory=lambda: np.random.default_rng())

    def vitals_now(self) -> dict:
        return self.history[-1]


class Engine:
    def __init__(self) -> None:
        self.rng = np.random.default_rng(7)
        self.bus = Bus()
        self.detector = Detector(self.rng)
        self.sim_time = datetime(2026, 9, 5, 7, 12, 0)
        self.tick_i = 0
        self.ingested = 0
        self.windowed = 0
        self.anomaly_count = 0
        self.latencies: Deque[float] = deque(maxlen=200)
        self.patients: dict[str, LivePatient] = {}
        self.alerts: list[AlertOut] = []
        self._reset_patients()
        self._seed_history()

    def _reset_patients(self) -> None:
        self.patients = {}
        for r in ROSTER:
            self.patients[r.id] = LivePatient(
                roster=r,
                progress=r.progress,
                kind=r.kind,
                rng=np.random.default_rng(r.seed),
            )

    def reset(self) -> None:
        self.sim_time = datetime(2026, 9, 5, 7, 12, 0)
        self.tick_i = 0
        self.ingested = 0
        self.windowed = 0
        self.anomaly_count = 0
        self.latencies.clear()
        self.alerts.clear()
        for topic in self.bus.topics.values():
            topic.log.clear()
            topic.count = 0
        self._reset_patients()
        self._seed_history()

    def crash(self, patient_id: str) -> None:
        p = self.patients[patient_id]
        if p.kind in ("stable", "watch"):
            p.kind = "sepsis"
        p.progress = max(p.progress, 0.72)
        p.last_alert_tick = -10_000

    def _physiology(self, p: LivePatient, advance: bool = True) -> dict:
        b = p.roster.baseline
        t = self.tick_i
        n = p.rng
        # Respiratory sinus coupling + slow wander
        wander = np.sin(t / 18.0 + p.roster.seed) * 0.4
        hr = b.hr + wander * 3 + n.normal(0, 1.1)
        hrv = b.hrv + n.normal(0, 1.4) - wander * 1.2
        spo2 = b.spo2 + n.normal(0, 0.25)
        temp = b.temp + 0.08 * np.sin(t / 40.0) + n.normal(0, 0.03)
        rr = b.rr + n.normal(0, 0.4)
        sbp = b.sbp + n.normal(0, 1.6)
        dbp = b.dbp + n.normal(0, 1.1)

        if p.kind == "watch":
            hr += 8 + 4 * np.sin(t / 9.0)
            hrv -= 8
            if p.roster.id == "robert-hale":
                # Irregularly irregular
                hr = b.hr + n.choice([-18, -8, 6, 16, 28, 40]) + n.normal(0, 3)
                hrv = max(8, b.hrv + n.normal(0, 4) - 6)
            if p.roster.id == "james-okonkwo":
                spo2 = b.spo2 + n.normal(0, 0.7) - 0.4 * np.sin(t / 7.0)

        s = 1 / (1 + np.exp(-10 * (p.progress - 0.5))) if p.kind in ("sepsis", "cardiac") else 0.0
        if p.kind == "sepsis":
            hr += 42 * s
            hrv -= 28 * s
            temp += 1.7 * s
            rr += 10 * s
            spo2 -= 5.5 * s
            sbp -= 30 * s
            dbp -= 14 * s
        elif p.kind == "cardiac":
            hr += 48 * s
            hrv -= 16 * s
            rr += 6 * s
            spo2 -= 2.2 * s
            sbp -= 36 * s
            dbp -= 16 * s
            temp += 0.15 * s

        if advance and p.kind in ("sepsis", "cardiac") and p.progress < 1.0:
            p.progress = min(1.0, p.progress + p.roster.speed)

        hr = int(np.clip(hr, 42, 178))
        hrv = float(np.clip(hrv, 6.0, 90.0))
        spo2 = int(np.clip(round(spo2), 78, 100))
        temp = float(np.clip(temp, 35.0, 40.6))
        rr = int(np.clip(round(rr), 8, 40))
        sbp = int(np.clip(sbp, 72, 190))
        dbp = int(np.clip(dbp, 42, 110))
        if dbp >= sbp - 20:
            dbp = sbp - 22
        mapa = int(round((sbp + 2 * dbp) / 3))
        ts = self.sim_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "t": ts,
            "hr": hr,
            "hrv": round(hrv, 1),
            "spo2": spo2,
            "temp": round(temp, 1),
            "rr": rr,
            "sbp": sbp,
            "dbp": dbp,
            "map": mapa,
        }

    def _seed_history(self) -> None:
        # Replay a short past so charts show the trend into the current state.
        start = self.sim_time
        steps = WINDOW + 8
        for i in range(steps):
            self.sim_time = start - TICK_SIM * (steps - i)
            self.tick_i = i - steps
            for p in self.patients.values():
                p.progress = max(0.0, p.roster.progress - p.roster.speed * (steps - i))
                v = self._physiology(p, advance=False)
                p.history.append(v)
                self.ingested += 1
        self.sim_time = start
        self.tick_i = 0
        for p in self.patients.values():
            p.progress = p.roster.progress
            if len(p.history) >= WINDOW:
                p.last_score = self.detector.score(list(p.history)[-WINDOW:])
                p.aura_smooth = float(getattr(p.last_score, "aura", 12))
                p.x_hold = 16 if getattr(p.last_score, "intersecting", False) else 0

    def tick(self) -> Optional[AlertOut]:
        t0 = time.perf_counter()
        self.sim_time = self.sim_time + TICK_SIM
        self.tick_i += 1
        iso = self.sim_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        new_alert: Optional[AlertOut] = None

        for p in self.patients.values():
            v = self._physiology(p)
            p.history.append(v)
            self.ingested += 1
            self.bus.publish(
                "rpm.vitals.raw",
                iso,
                p.roster.id,
                f"{p.roster.name.split()[-1]} HR {v['hr']}  SpO₂ {v['spo2']}  {v['temp']:.1f}°C",
            )

            if len(p.history) < WINDOW:
                continue
            window = list(p.history)[-WINDOW:]
            self.windowed += 1
            score = self.detector.score(window)
            p.last_score = score
            if score.aura > p.aura_smooth:
                p.aura_smooth = 0.35 * p.aura_smooth + 0.65 * score.aura
            else:
                p.aura_smooth = 0.9 * p.aura_smooth + 0.1 * score.aura
            if score.intersecting:
                p.x_hold = 16
            elif p.x_hold:
                p.x_hold -= 1
            if self.tick_i % 3 == 0:
                self.bus.publish(
                    "rpm.features.windowed",
                    iso,
                    p.roster.id,
                    f"win24  HRVΔ {-score.hrv_drop:.0f}  TΔ {score.temp_rise:+.2f}  NEWS2 {score.news2}",
                )

            if score.anomaly or score.aura >= 62:
                self.anomaly_count += 1
                self.bus.publish(
                    "rpm.anomalies.scores",
                    iso,
                    p.roster.id,
                    f"IF {score.if_raw:.3f}  AURA {score.aura}  {'HRV×T' if score.intersecting else 'no-intersect'}",
                )

            fire = False
            kind = "sepsis"
            if score.intersecting and (score.anomaly or score.aura >= 64):
                fire = True
                kind = "sepsis"
            elif p.kind == "cardiac" and score.anomaly and score.aura >= 70 and v["sbp"] <= 100:
                fire = True
                kind = "cardiac"
            elif v["spo2"] <= 88 and score.aura >= 72:
                fire = True
                kind = "hypoxia"

            open_same = any(
                a.patient_id == p.roster.id
                and a.kind == kind
                and a.status in ("requested", "accepted")
                for a in self.alerts
            )
            if (
                fire
                and not open_same
                and (self.tick_i - p.last_alert_tick) >= COOLDOWN_TICKS
            ):
                p.last_alert_tick = self.tick_i
                latency_ms = (time.perf_counter() - t0) * 1000.0
                self.latencies.append(latency_ms)
                task_id = f"aura-{1000 + len(self.alerts) + 1}"
                title = {
                    "sepsis": "Sepsis / deterioration watch",
                    "cardiac": "Cardiac deterioration watch",
                    "hypoxia": "Hypoxemic deterioration",
                }[kind]
                summary = (
                    f"{p.roster.name} · {p.roster.bed}. "
                    + (
                        (
                            f"HRV {v['hrv']:.0f} ms (↓{score.hrv_drop:.0f}) intersecting core temp {v['temp']:.1f}°C. "
                            if score.hrv_drop >= 4
                            else f"Suppressed HRV {v['hrv']:.0f} ms intersecting core temp {v['temp']:.1f}°C. "
                        )
                        if score.intersecting
                        else f"HR {v['hr']}  MAP {v['map']}  SpO₂ {v['spo2']}%. "
                    )
                    + f"Isolation Forest {score.if_raw:.2f} · AURA {score.aura} · NEWS2 {score.news2}."
                )
                fhir = build_task(
                    task_id=task_id,
                    patient_id=p.roster.id,
                    patient_name=p.roster.name,
                    mrn=p.roster.mrn,
                    bed=p.roster.bed,
                    authored_on=iso,
                    kind=kind,
                    priority="stat" if score.aura >= 75 else "urgent",
                    description=summary,
                    aura=score.aura,
                    hrv=v["hrv"],
                    temp=v["temp"],
                    hr=v["hr"],
                    spo2=v["spo2"],
                    intersecting=score.intersecting,
                    if_score=score.if_raw,
                    news2=score.news2,
                )
                alert = AlertOut(
                    id=task_id,
                    patient_id=p.roster.id,
                    patient_name=p.roster.name,
                    bed=p.roster.bed,
                    created_at=iso,
                    priority="stat" if score.aura >= 75 else "urgent",
                    kind=kind,  # type: ignore[arg-type]
                    title=title,
                    summary=summary,
                    status="requested",
                    latency_ms=round(latency_ms, 2),
                    intersecting=score.intersecting,
                    aura=score.aura,
                    fhir=fhir,
                )
                self.alerts.insert(0, alert)
                self.bus.publish(
                    "rpm.fhir.tasks",
                    iso,
                    task_id,
                    f"Task/{task_id}  {kind}  {p.roster.name}  {alert.priority.upper()}",
                )
                if new_alert is None:
                    new_alert = alert

        elapsed = (time.perf_counter() - t0) * 1000.0
        self.latencies.append(elapsed)
        return new_alert

    def _risk(self, aura: int, intersecting: bool, v: dict) -> str:
        if (
            aura >= 78
            or (intersecting and aura >= 64)
            or v["sbp"] <= 88
            or v["spo2"] <= 88
        ):
            return "critical"
        if aura >= 48 or v["hr"] >= 110 or v["spo2"] <= 92:
            return "watch"
        return "stable"

    def _patient_out(self, p: LivePatient) -> PatientOut:
        v = p.history[-1]
        score = p.last_score
        aura = int(round(p.aura_smooth or getattr(score, "aura", 12)))
        intersecting = bool(p.x_hold > 0 or getattr(score, "intersecting", False))
        risk = self._risk(aura, intersecting, v)
        open_alert = any(
            a.patient_id == p.roster.id and a.status in ("requested", "accepted")
            for a in self.alerts
        )
        if open_alert and intersecting:
            risk = "critical"
        elif open_alert and risk == "stable":
            risk = "watch"
        return PatientOut(
            id=p.roster.id,
            mrn=p.roster.mrn,
            name=p.roster.name,
            age=p.roster.age,
            sex=p.roster.sex,
            bed=p.roster.bed,
            unit=UNIT,
            condition=p.roster.condition,
            postop_day=p.roster.postop_day,
            device=p.roster.device,
            device_vendor=p.roster.device_vendor,
            admit=p.roster.admit,
            allergies=p.roster.allergies,
            vitals=Vitals(**v),
            history=[Vitals(**x) for x in list(p.history)[-60:]],
            aura=aura,
            risk=risk,  # type: ignore[arg-type]
            intersecting=intersecting,
            news2=int(getattr(score, "news2", 0)),
            if_score=float(getattr(score, "if_raw", 0.0)),
            reasons=list(getattr(score, "reasons", [])),
            contributions=list(getattr(score, "contributions", [])),
            battery=p.roster.battery,
            trajectory=p.kind,
        )

    def _percentile(self, q: float) -> float:
        if not self.latencies:
            return 0.0
        arr = np.array(self.latencies)
        return float(np.percentile(arr, q))

    def pipeline(self) -> PipelineOut:
        iso = self.sim_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        topics = []
        # Rate: counts / ticks, ticks are 1s wall
        ticks = max(self.tick_i, 1)
        for name, topic in self.bus.topics.items():
            topics.append(
                TopicOut(
                    name=name,
                    rate_hz=round(topic.count / max(ticks, 1), 2),
                    retained=len(topic.log),
                    recent=[
                        TopicEvent(t=e.t, key=e.key, summary=e.summary, topic=e.topic)
                        for e in list(topic.log)[-8:]
                    ],
                )
            )
        return PipelineOut(
            topics=topics,
            model=ModelCard(
                name="IsolationForest",
                estimators=200,
                contamination=0.04,
                trained_windows=self.detector.trained_windows,
                features=FEATURE_COLS,
                tpr=round(self.detector.tpr, 3),
                fpr=round(self.detector.fpr, 3),
                precision=round(self.detector.precision, 3),
                p95_latency_ms=round(self._percentile(95), 2),
                p50_latency_ms=round(self._percentile(50), 2),
            ),
            ingested=self.ingested,
            windowed=self.windowed,
            anomalies=self.anomaly_count,
            fhir_tasks=len(self.alerts),
            sim_time=iso,
            wall_tick_ms=1000,
        )

    def snapshot(self) -> Snapshot:
        patients = [self._patient_out(p) for p in self.patients.values()]
        patients.sort(key=lambda x: (-x.aura, x.bed))
        return Snapshot(
            patients=patients,
            alerts=list(self.alerts),
            pipeline=self.pipeline(),
        )

    def set_alert_status(self, alert_id: str, status: str) -> Optional[AlertOut]:
        for a in self.alerts:
            if a.id == alert_id:
                a.status = status  # type: ignore[assignment]
                a.fhir["status"] = status
                a.fhir["lastModified"] = self.sim_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                return a
        return None
