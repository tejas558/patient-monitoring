export type Risk = "stable" | "watch" | "critical";
export type AlertKind = "sepsis" | "cardiac" | "hypoxia";
export type AlertStatus = "requested" | "accepted" | "completed" | "cancelled";

export interface Vitals {
  t: string;
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  rr: number;
  sbp: number;
  dbp: number;
  map: number;
}

export interface Contribution {
  feature: string;
  z: number;
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: "F" | "M";
  bed: string;
  unit: string;
  condition: string;
  postop_day: number | null;
  device: string;
  device_vendor: string;
  admit: string;
  allergies: string;
  vitals: Vitals;
  history: Vitals[];
  aura: number;
  risk: Risk;
  intersecting: boolean;
  news2: number;
  if_score: number;
  reasons: string[];
  contributions: Contribution[];
  battery: number;
  trajectory: string;
}

export interface TopicEvent {
  t: string;
  key: string;
  summary: string;
  topic: string;
}

export interface Topic {
  name: string;
  rate_hz: number;
  retained: number;
  recent: TopicEvent[];
}

export interface ModelCard {
  name: string;
  estimators: number;
  contamination: number;
  trained_windows: number;
  features: string[];
  tpr: number;
  fpr: number;
  precision: number;
  p95_latency_ms: number;
  p50_latency_ms: number;
}

export interface Pipeline {
  topics: Topic[];
  model: ModelCard;
  ingested: number;
  windowed: number;
  anomalies: number;
  fhir_tasks: number;
  sim_time: string;
  wall_tick_ms: number;
}

export interface Alert {
  id: string;
  patient_id: string;
  patient_name: string;
  bed: string;
  created_at: string;
  priority: "stat" | "urgent" | "routine";
  kind: AlertKind;
  title: string;
  summary: string;
  status: AlertStatus;
  latency_ms: number;
  intersecting: boolean;
  aura: number;
  fhir: Record<string, unknown>;
}

export interface Snapshot {
  patients: Patient[];
  alerts: Alert[];
  pipeline: Pipeline;
  unit: string;
  nurse: string;
  role: string;
}

export type View = "ward" | "patient" | "alerts" | "pipeline";
