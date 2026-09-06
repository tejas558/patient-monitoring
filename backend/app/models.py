from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Risk = Literal["stable", "watch", "critical"]
Sex = Literal["F", "M"]
AlertKind = Literal["sepsis", "cardiac", "hypoxia"]
AlertStatus = Literal["requested", "accepted", "completed", "cancelled"]
Priority = Literal["stat", "urgent", "routine"]


class Vitals(BaseModel):
    t: str
    hr: int
    hrv: float
    spo2: int
    temp: float
    rr: int
    sbp: int
    dbp: int
    map: int


class PatientOut(BaseModel):
    id: str
    mrn: str
    name: str
    age: int
    sex: Sex
    bed: str
    unit: str
    condition: str
    postop_day: Optional[int] = None
    device: str
    device_vendor: str
    admit: str
    allergies: str
    vitals: Vitals
    history: list[Vitals]
    aura: int
    risk: Risk
    intersecting: bool
    news2: int
    if_score: float
    reasons: list[str]
    contributions: list[dict[str, Any]]
    battery: int
    trajectory: str


class TopicEvent(BaseModel):
    t: str
    key: str
    summary: str
    topic: str


class TopicOut(BaseModel):
    name: str
    rate_hz: float
    retained: int
    recent: list[TopicEvent]


class ModelCard(BaseModel):
    name: str
    estimators: int
    contamination: float
    trained_windows: int
    features: list[str]
    tpr: float
    fpr: float
    precision: float
    p95_latency_ms: float
    p50_latency_ms: float


class PipelineOut(BaseModel):
    topics: list[TopicOut]
    model: ModelCard
    ingested: int
    windowed: int
    anomalies: int
    fhir_tasks: int
    sim_time: str
    wall_tick_ms: int


class AlertOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    bed: str
    created_at: str
    priority: Priority
    kind: AlertKind
    title: str
    summary: str
    status: AlertStatus
    latency_ms: float
    intersecting: bool
    aura: int
    fhir: dict[str, Any]


class Snapshot(BaseModel):
    patients: list[PatientOut]
    alerts: list[AlertOut]
    pipeline: PipelineOut
    unit: str = "4 West · Step-down / RPM overlay"
    nurse: str = "J. Hale, RN"
    role: str = "Charge · 07:00–19:00"


class StatusBody(BaseModel):
    status: AlertStatus


class WsMessage(BaseModel):
    type: Literal["snapshot", "tick", "alert"]
    snapshot: Optional[Snapshot] = None
    patients: Optional[list[PatientOut]] = None
    alerts: Optional[list[AlertOut]] = None
    pipeline: Optional[PipelineOut] = None
    alert: Optional[AlertOut] = None
