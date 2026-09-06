import type {
  Alert,
  AlertKind,
  AlertStatus,
  Patient,
  Pipeline,
  Risk,
  Snapshot,
  TopicEvent,
  Vitals,
} from "./types";

const WINDOW = 24;
const HISTORY = 90;
const FEATURES = [
  "hr_mean",
  "hrv_mean",
  "spo2_mean",
  "temp_mean",
  "rr_mean",
  "sbp_mean",
  "hr_delta",
  "hrv_delta",
  "temp_delta",
  "spo2_delta",
  "hr_std",
  "hrv_std",
];
const CENTER = [76, 42, 97.5, 36.7, 16, 124, 0, 0, 0, 0, 2.4, 3];
const SCALE = [8, 10, 1.4, 0.25, 2.2, 10, 4, 6, 0.15, 0.8, 1.2, 1.6];
const LABELS = [
  "Heart rate",
  "HRV (RMSSD)",
  "SpO₂",
  "Temperature",
  "Resp rate",
  "Systolic BP",
  "HR trend",
  "HRV trend",
  "Temp trend",
  "SpO₂ trend",
  "HR variability",
  "HRV variability",
];

type Kind = "stable" | "watch" | "sepsis" | "cardiac";

interface Roster {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: "F" | "M";
  bed: string;
  condition: string;
  postop_day: number | null;
  device: string;
  device_vendor: string;
  admit: string;
  allergies: string;
  battery: number;
  kind: Kind;
  progress: number;
  speed: number;
  baseline: {
    hr: number;
    hrv: number;
    spo2: number;
    temp: number;
    rr: number;
    sbp: number;
    dbp: number;
  };
  seed: number;
}

const ROSTER: Roster[] = [
  { id: "elena-voss", mrn: "00482119", name: "Elena Voss", age: 67, sex: "F", bed: "4W-12", condition: "Post-op colectomy · POD 2", postop_day: 2, device: "Philips Biosensor BX100", device_vendor: "Philips", admit: "2026-09-03", allergies: "Penicillin", battery: 86, kind: "sepsis", progress: 0.38, speed: 0.018, baseline: { hr: 76, hrv: 42, spo2: 97, temp: 36.8, rr: 16, sbp: 128, dbp: 74 }, seed: 11 },
  { id: "marcus-chen", mrn: "00319402", name: "Marcus Chen", age: 54, sex: "M", bed: "4W-07", condition: "HFrEF 30% · tele overlay", postop_day: null, device: "Medtronic LINQ II", device_vendor: "Medtronic", admit: "2026-09-01", allergies: "NKDA", battery: 91, kind: "cardiac", progress: 0.22, speed: 0.011, baseline: { hr: 88, hrv: 28, spo2: 96, temp: 36.7, rr: 18, sbp: 112, dbp: 68 }, seed: 23 },
  { id: "mei-lin", mrn: "00773301", name: "Mei Lin", age: 83, sex: "F", bed: "4W-03", condition: "UTI · sepsis watch", postop_day: null, device: "Masimo Radius PPG", device_vendor: "Masimo", admit: "2026-09-04", allergies: "Sulfa", battery: 74, kind: "sepsis", progress: 0.58, speed: 0.01, baseline: { hr: 82, hrv: 31, spo2: 96, temp: 37.1, rr: 18, sbp: 134, dbp: 78 }, seed: 41 },
  { id: "aisha-rahman", mrn: "00288144", name: "Aisha Rahman", age: 62, sex: "F", bed: "4W-09", condition: "CAP · O2 2L NC", postop_day: null, device: "Masimo MightySat Rx", device_vendor: "Masimo", admit: "2026-09-02", allergies: "NKDA", battery: 81, kind: "sepsis", progress: 0.12, speed: 0.007, baseline: { hr: 84, hrv: 36, spo2: 94, temp: 37.4, rr: 20, sbp: 126, dbp: 72 }, seed: 7 },
  { id: "james-okonkwo", mrn: "00510288", name: "James Okonkwo", age: 78, sex: "M", bed: "4W-05", condition: "COPD exacerbation", postop_day: null, device: "Teladoc RPM kit · pulse ox", device_vendor: "Teladoc", admit: "2026-08-31", allergies: "Codeine", battery: 63, kind: "watch", progress: 0, speed: 0, baseline: { hr: 92, hrv: 24, spo2: 91, temp: 36.9, rr: 22, sbp: 138, dbp: 82 }, seed: 19 },
  { id: "robert-hale", mrn: "00177620", name: "Robert Hale", age: 71, sex: "M", bed: "4W-11", condition: "New AFib · rate control", postop_day: null, device: "Apple Watch Ultra 2", device_vendor: "Apple Health", admit: "2026-09-04", allergies: "NKDA", battery: 52, kind: "watch", progress: 0, speed: 0, baseline: { hr: 98, hrv: 18, spo2: 97, temp: 36.6, rr: 16, sbp: 118, dbp: 76 }, seed: 29 },
  { id: "priya-nair", mrn: "00821003", name: "Priya Nair", age: 41, sex: "F", bed: "4W-02", condition: "Postpartum day 1 · stable", postop_day: 1, device: "Apple Watch Series 10", device_vendor: "Apple Health", admit: "2026-09-05", allergies: "Latex", battery: 94, kind: "stable", progress: 0, speed: 0, baseline: { hr: 74, hrv: 48, spo2: 99, temp: 36.7, rr: 14, sbp: 118, dbp: 70 }, seed: 3 },
  { id: "hannah-brooks", mrn: "00644190", name: "Hannah Brooks", age: 29, sex: "F", bed: "4W-14", condition: "Laparoscopic appendectomy · POD 0", postop_day: 0, device: "Philips Biosensor BX100", device_vendor: "Philips", admit: "2026-09-05", allergies: "NKDA", battery: 88, kind: "stable", progress: 0, speed: 0, baseline: { hr: 68, hrv: 55, spo2: 99, temp: 36.6, rr: 14, sbp: 122, dbp: 72 }, seed: 13 },
  { id: "tom-alvarez", mrn: "00913077", name: "Tom Alvarez", age: 45, sex: "M", bed: "4W-08", condition: "Post-CABG · POD 3", postop_day: 3, device: "Medtronic LINQ II", device_vendor: "Medtronic", admit: "2026-09-02", allergies: "Iodine", battery: 79, kind: "stable", progress: 0, speed: 0, baseline: { hr: 72, hrv: 38, spo2: 97, temp: 36.8, rr: 15, sbp: 110, dbp: 64 }, seed: 17 },
  { id: "david-park", mrn: "00200918", name: "David Park", age: 58, sex: "M", bed: "4W-06", condition: "DM2 · cellulitis, home RPM", postop_day: null, device: "Teladoc Chronic Care kit", device_vendor: "Teladoc", admit: "2026-08-28", allergies: "NKDA", battery: 70, kind: "stable", progress: 0, speed: 0, baseline: { hr: 78, hrv: 40, spo2: 98, temp: 36.9, rr: 16, sbp: 132, dbp: 80 }, seed: 31 },
  { id: "sofia-berg", mrn: "00440012", name: "Sofia Berg", age: 36, sex: "F", bed: "4W-01", condition: "Asthma · observation", postop_day: null, device: "Masimo MightySat Rx", device_vendor: "Masimo", admit: "2026-09-05", allergies: "Aspirin", battery: 96, kind: "stable", progress: 0, speed: 0, baseline: { hr: 70, hrv: 52, spo2: 98, temp: 36.5, rr: 15, sbp: 120, dbp: 74 }, seed: 37 },
  { id: "william-frost", mrn: "00155280", name: "William Frost", age: 69, sex: "M", bed: "4W-10", condition: "THA · POD 1 · pain protocol", postop_day: 1, device: "Philips Biosensor BX100", device_vendor: "Philips", admit: "2026-09-04", allergies: "Morphine", battery: 84, kind: "watch", progress: 0, speed: 0, baseline: { hr: 80, hrv: 33, spo2: 96, temp: 37.0, rr: 16, sbp: 142, dbp: 84 }, seed: 43 },
];

function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng: () => number) {
  const u = Math.max(1e-9, 1 - rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function clip(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function mean(xs: number[]) {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function std(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((v) => (v - m) ** 2)));
}

function isoFrom(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function news2(v: Vitals) {
  let s = 0;
  if (v.rr <= 8 || v.rr >= 25) s += 3;
  else if (v.rr <= 11 || v.rr >= 21) s += 1;
  if (v.spo2 <= 91) s += 3;
  else if (v.spo2 <= 93) s += 2;
  else if (v.spo2 <= 95) s += 1;
  if (v.temp <= 35) s += 3;
  else if (v.temp >= 39.1) s += 2;
  else if (v.temp <= 36 || v.temp >= 38.1) s += 1;
  if (v.sbp <= 90 || v.sbp >= 220) s += 3;
  else if (v.sbp <= 100) s += 2;
  else if (v.sbp <= 110) s += 1;
  if (v.hr <= 40 || v.hr >= 131) s += 3;
  else if (v.hr >= 111) s += 2;
  else if (v.hr <= 50 || v.hr >= 91) s += 1;
  return s;
}

interface Score {
  if_raw: number;
  aura: number;
  anomaly: boolean;
  intersecting: boolean;
  news2: number;
  hrv_drop: number;
  temp_rise: number;
  reasons: string[];
  contributions: { feature: string; z: number }[];
}

function scoreWindow(window: Vitals[]): Score {
  const hr = window.map((x) => x.hr);
  const hrv = window.map((x) => x.hrv);
  const spo2 = window.map((x) => x.spo2);
  const temp = window.map((x) => x.temp);
  const rr = window.map((x) => x.rr);
  const sbp = window.map((x) => x.sbp);
  const x = [
    mean(hr),
    mean(hrv),
    mean(spo2),
    mean(temp),
    mean(rr),
    mean(sbp),
    hr[hr.length - 1] - hr[0],
    hrv[hrv.length - 1] - hrv[0],
    temp[temp.length - 1] - temp[0],
    spo2[spo2.length - 1] - spo2[0],
    std(hr),
    std(hrv),
  ];
  const z = x.map((v, i) => (v - CENTER[i]) / SCALE[i]);
  const rms = Math.sqrt(mean(z.map((v) => v * v)));
  const raw = (rms - 0.55) * 0.22;
  const anomaly = rms > 1.35;
  let aura = Math.round(100 / (1 + Math.exp(-8 * (raw - 0.05))));
  aura = clip(aura, 1, 99);
  const latest = window[window.length - 1];
  const hrvDrop = window[0].hrv - latest.hrv;
  const tempRise = latest.temp - window[0].temp;
  const intersecting =
    (hrvDrop >= 7.5 && (tempRise >= 0.28 || latest.temp >= 38)) ||
    (latest.hrv <= 22 && latest.temp >= 38);
  const n2 = news2(latest);
  if (intersecting) aura = clip(aura + 14, 1, 99);
  aura = clip(aura + n2 * 2, 1, 99);
  const order = z.map((v, i) => [Math.abs(v), i] as const).sort((a, b) => b[0] - a[0]);
  const contributions = order.slice(0, 5).map(([, i]) => ({
    feature: LABELS[i],
    z: Math.round(z[i] * 100) / 100,
  }));
  const reasons: string[] = [];
  if (intersecting) {
    reasons.push(
      hrvDrop >= 4
        ? `HRV × temp intersection · RMSSD ↓${hrvDrop.toFixed(0)} ms, core ${latest.temp.toFixed(1)}°C`
        : `HRV × temp intersection · RMSSD ${latest.hrv.toFixed(0)} ms with core ${latest.temp.toFixed(1)}°C`
    );
  }
  if (latest.hr >= 100) reasons.push(`Tachycardia ${latest.hr} /min`);
  if (latest.hrv <= 22) reasons.push(`Suppressed HRV ${latest.hrv.toFixed(0)} ms`);
  if (latest.temp >= 38) reasons.push(`Fever ${latest.temp.toFixed(1)}°C`);
  if (latest.spo2 <= 94) reasons.push(`Desaturation ${latest.spo2}%`);
  if (latest.sbp <= 100) reasons.push(`Hypotension ${latest.sbp}/${latest.dbp}`);
  if (latest.rr >= 22) reasons.push(`Tachypnea ${latest.rr} /min`);
  if (anomaly && reasons.length === 0) reasons.push("Isolation Forest out-of-distribution window");
  if (n2 >= 5) reasons.push(`NEWS2 ${n2} — high early-warning score`);
  return {
    if_raw: raw,
    aura,
    anomaly,
    intersecting,
    news2: n2,
    hrv_drop: hrvDrop,
    temp_rise: tempRise,
    reasons: reasons.slice(0, 4),
    contributions,
  };
}

function buildFhir(a: {
  id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  bed: string;
  authored: string;
  kind: AlertKind;
  priority: string;
  description: string;
  aura: number;
  hrv: number;
  temp: number;
  hr: number;
  spo2: number;
  intersecting: boolean;
  if_score: number;
  news2: number;
}) {
  const coding =
    a.kind === "sepsis"
      ? { system: "http://snomed.info/sct", code: "91302008", display: "Sepsis" }
      : a.kind === "cardiac"
        ? { system: "http://snomed.info/sct", code: "410429000", display: "Cardiac arrest (finding)" }
        : { system: "http://snomed.info/sct", code: "389086002", display: "Hypoxia" };
  return {
    resourceType: "Task",
    id: a.id,
    meta: { source: "AURA Isolation Forest · rpm.anomalies.scores" },
    status: "requested",
    intent: "order",
    priority: a.priority,
    code: {
      coding: [coding],
      text:
        a.kind === "sepsis"
          ? "Early warning: suspected sepsis / physiological deterioration"
          : a.kind === "cardiac"
            ? "Early warning: suspected cardiac deterioration"
            : "Early warning: suspected hypoxemic deterioration",
    },
    description: a.description,
    for: { reference: `Patient/${a.patient_id}`, display: `${a.patient_name} · ${a.bed}` },
    authoredOn: a.authored,
    requester: { display: "AURA Clinical RPM · time-series anomaly service" },
    owner: { display: "4W Charge Nurse" },
    input: [
      { type: { text: "AURA score" }, valueInteger: a.aura },
      { type: { text: "Isolation Forest anomaly score" }, valueDecimal: Math.round(a.if_score * 1000) / 1000 },
      { type: { text: "NEWS2" }, valueInteger: a.news2 },
      { type: { text: "HRV × temperature intersection" }, valueBoolean: a.intersecting },
    ],
  };
}

interface Live {
  roster: Roster;
  progress: number;
  kind: Kind;
  history: Vitals[];
  last?: Score;
  lastAlertTick: number;
  auraSmooth: number;
  xHold: number;
  rng: () => number;
}

interface TopicBuf {
  name: string;
  count: number;
  recent: TopicEvent[];
}

const START = Date.UTC(2026, 8, 5, 7, 12, 0);

class Engine {
  simMs = START;
  tickI = 0;
  ingested = 0;
  windowed = 0;
  anomalies = 0;
  latencies: number[] = [];
  patients: Live[] = [];
  alerts: Alert[] = [];
  topics: TopicBuf[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.simMs = START;
    this.tickI = 0;
    this.ingested = 0;
    this.windowed = 0;
    this.anomalies = 0;
    this.latencies = [];
    this.alerts = [];
    this.topics = [
      { name: "rpm.vitals.raw", count: 0, recent: [] },
      { name: "rpm.features.windowed", count: 0, recent: [] },
      { name: "rpm.anomalies.scores", count: 0, recent: [] },
      { name: "rpm.fhir.tasks", count: 0, recent: [] },
    ];
    this.patients = ROSTER.map((r) => ({
      roster: r,
      progress: r.progress,
      kind: r.kind,
      history: [],
      lastAlertTick: -10_000,
      auraSmooth: 12,
      xHold: 0,
      rng: mulberry(r.seed),
    }));
    const steps = WINDOW + 8;
    for (let i = 0; i < steps; i++) {
      this.simMs = START - 15_000 * (steps - i);
      this.tickI = i - steps;
      for (const p of this.patients) {
        p.progress = Math.max(0, p.roster.progress - p.roster.speed * (steps - i));
        p.history.push(this.physio(p, false));
        if (p.history.length > HISTORY) p.history.shift();
        this.ingested += 1;
      }
    }
    this.simMs = START;
    this.tickI = 0;
    for (const p of this.patients) {
      p.progress = p.roster.progress;
      if (p.history.length >= WINDOW) {
        p.last = scoreWindow(p.history.slice(-WINDOW));
        p.auraSmooth = p.last.aura;
        p.xHold = p.last.intersecting ? 16 : 0;
      }
    }
  }

  crash(id: string) {
    const p = this.patients.find((x) => x.roster.id === id);
    if (!p) return;
    if (p.kind === "stable" || p.kind === "watch") p.kind = "sepsis";
    p.progress = Math.max(p.progress, 0.72);
    p.lastAlertTick = -10_000;
  }

  setStatus(id: string, status: AlertStatus) {
    const a = this.alerts.find((x) => x.id === id);
    if (!a) return;
    a.status = status;
    a.fhir = { ...a.fhir, status, lastModified: isoFrom(this.simMs) };
  }

  private pub(topic: string, key: string, summary: string) {
    const t = this.topics.find((x) => x.name === topic);
    if (!t) return;
    t.count += 1;
    t.recent.push({ t: isoFrom(this.simMs), key, summary, topic });
    if (t.recent.length > 8) t.recent.shift();
  }

  private physio(p: Live, advance: boolean): Vitals {
    const b = p.roster.baseline;
    const t = this.tickI;
    const n = p.rng;
    const wander = Math.sin(t / 18 + p.roster.seed) * 0.4;
    let hr = b.hr + wander * 3 + randn(n) * 1.1;
    let hrv = b.hrv + randn(n) * 1.4 - wander * 1.2;
    let spo2 = b.spo2 + randn(n) * 0.25;
    let temp = b.temp + 0.08 * Math.sin(t / 40) + randn(n) * 0.03;
    let rr = b.rr + randn(n) * 0.4;
    let sbp = b.sbp + randn(n) * 1.6;
    let dbp = b.dbp + randn(n) * 1.1;
    if (p.kind === "watch") {
      hr += 8 + 4 * Math.sin(t / 9);
      hrv -= 8;
      if (p.roster.id === "robert-hale") {
        hr = b.hr + [-18, -8, 6, 16, 28, 40][Math.floor(n() * 6)] + randn(n) * 3;
        hrv = Math.max(8, b.hrv + randn(n) * 4 - 6);
      }
      if (p.roster.id === "james-okonkwo") {
        spo2 = b.spo2 + randn(n) * 0.7 - 0.4 * Math.sin(t / 7);
      }
    }
    const s =
      p.kind === "sepsis" || p.kind === "cardiac"
        ? 1 / (1 + Math.exp(-10 * (p.progress - 0.5)))
        : 0;
    if (p.kind === "sepsis") {
      hr += 42 * s;
      hrv -= 28 * s;
      temp += 1.7 * s;
      rr += 10 * s;
      spo2 -= 5.5 * s;
      sbp -= 30 * s;
      dbp -= 14 * s;
    } else if (p.kind === "cardiac") {
      hr += 48 * s;
      hrv -= 16 * s;
      rr += 6 * s;
      spo2 -= 2.2 * s;
      sbp -= 36 * s;
      dbp -= 16 * s;
      temp += 0.15 * s;
    }
    if (advance && (p.kind === "sepsis" || p.kind === "cardiac") && p.progress < 1) {
      p.progress = Math.min(1, p.progress + p.roster.speed);
    }
    hr = clip(Math.round(hr), 42, 178);
    hrv = clip(hrv, 6, 90);
    spo2 = clip(Math.round(spo2), 78, 100);
    temp = clip(temp, 35, 40.6);
    rr = clip(Math.round(rr), 8, 40);
    sbp = clip(Math.round(sbp), 72, 190);
    dbp = clip(Math.round(dbp), 42, 110);
    if (dbp >= sbp - 20) dbp = sbp - 22;
    return {
      t: isoFrom(this.simMs),
      hr,
      hrv: Math.round(hrv * 10) / 10,
      spo2,
      temp: Math.round(temp * 10) / 10,
      rr,
      sbp,
      dbp,
      map: Math.round((sbp + 2 * dbp) / 3),
    };
  }

  tick(): Alert | null {
    const t0 = performance.now();
    this.simMs += 15_000;
    this.tickI += 1;
    const iso = isoFrom(this.simMs);
    let minted: Alert | null = null;
    for (const p of this.patients) {
      const v = this.physio(p, true);
      p.history.push(v);
      if (p.history.length > HISTORY) p.history.shift();
      this.ingested += 1;
      this.pub(
        "rpm.vitals.raw",
        p.roster.id,
        `${p.roster.name.split(" ").pop()} HR ${v.hr}  SpO₂ ${v.spo2}  ${v.temp.toFixed(1)}°C`
      );
      if (p.history.length < WINDOW) continue;
      const window = p.history.slice(-WINDOW);
      this.windowed += 1;
      const sc = scoreWindow(window);
      p.last = sc;
      p.auraSmooth =
        sc.aura > p.auraSmooth
          ? 0.35 * p.auraSmooth + 0.65 * sc.aura
          : 0.9 * p.auraSmooth + 0.1 * sc.aura;
      if (sc.intersecting) p.xHold = 16;
      else if (p.xHold) p.xHold -= 1;
      if (this.tickI % 3 === 0) {
        this.pub(
          "rpm.features.windowed",
          p.roster.id,
          `win24  HRVΔ ${(-sc.hrv_drop).toFixed(0)}  TΔ ${sc.temp_rise >= 0 ? "+" : ""}${sc.temp_rise.toFixed(2)}  NEWS2 ${sc.news2}`
        );
      }
      if (sc.anomaly || sc.aura >= 62) {
        this.anomalies += 1;
        this.pub(
          "rpm.anomalies.scores",
          p.roster.id,
          `IF ${sc.if_raw.toFixed(3)}  AURA ${sc.aura}  ${sc.intersecting ? "HRV×T" : "no-intersect"}`
        );
      }
      let fire = false;
      let kind: AlertKind = "sepsis";
      if (sc.intersecting && (sc.anomaly || sc.aura >= 64)) {
        fire = true;
        kind = "sepsis";
      } else if (p.kind === "cardiac" && sc.anomaly && sc.aura >= 70 && v.sbp <= 100) {
        fire = true;
        kind = "cardiac";
      } else if (v.spo2 <= 88 && sc.aura >= 72) {
        fire = true;
        kind = "hypoxia";
      }
      const openSame = this.alerts.some(
        (a) => a.patient_id === p.roster.id && a.kind === kind && (a.status === "requested" || a.status === "accepted")
      );
      if (fire && !openSame && this.tickI - p.lastAlertTick >= 48) {
        p.lastAlertTick = this.tickI;
        const latency = performance.now() - t0;
        this.latencies.push(latency);
        if (this.latencies.length > 200) this.latencies.shift();
        const id = `aura-${1000 + this.alerts.length + 1}`;
        const title =
          kind === "sepsis"
            ? "Sepsis / deterioration watch"
            : kind === "cardiac"
              ? "Cardiac deterioration watch"
              : "Hypoxemic deterioration";
        const summary =
          `${p.roster.name} · ${p.roster.bed}. ` +
          (sc.intersecting
            ? sc.hrv_drop >= 4
              ? `HRV ${v.hrv.toFixed(0)} ms (↓${sc.hrv_drop.toFixed(0)}) intersecting core temp ${v.temp.toFixed(1)}°C. `
              : `Suppressed HRV ${v.hrv.toFixed(0)} ms intersecting core temp ${v.temp.toFixed(1)}°C. `
            : `HR ${v.hr}  MAP ${v.map}  SpO₂ ${v.spo2}%. `) +
          `Isolation Forest ${sc.if_raw.toFixed(2)} · AURA ${sc.aura} · NEWS2 ${sc.news2}.`;
        const priority = sc.aura >= 75 ? "stat" : "urgent";
        const fhir = buildFhir({
          id,
          patient_id: p.roster.id,
          patient_name: p.roster.name,
          mrn: p.roster.mrn,
          bed: p.roster.bed,
          authored: iso,
          kind,
          priority,
          description: summary,
          aura: sc.aura,
          hrv: v.hrv,
          temp: v.temp,
          hr: v.hr,
          spo2: v.spo2,
          intersecting: sc.intersecting,
          if_score: sc.if_raw,
          news2: sc.news2,
        });
        const alert: Alert = {
          id,
          patient_id: p.roster.id,
          patient_name: p.roster.name,
          bed: p.roster.bed,
          created_at: iso,
          priority,
          kind,
          title,
          summary,
          status: "requested",
          latency_ms: Math.round(latency * 100) / 100,
          intersecting: sc.intersecting,
          aura: sc.aura,
          fhir,
        };
        this.alerts.unshift(alert);
        this.pub("rpm.fhir.tasks", id, `Task/${id}  ${kind}  ${p.roster.name}  ${priority.toUpperCase()}`);
        if (!minted) minted = alert;
      }
    }
    this.latencies.push(performance.now() - t0);
    if (this.latencies.length > 200) this.latencies.shift();
    return minted;
  }

  private risk(aura: number, intersecting: boolean, v: Vitals): Risk {
    if (aura >= 78 || (intersecting && aura >= 64) || v.sbp <= 88 || v.spo2 <= 88) return "critical";
    if (aura >= 48 || v.hr >= 110 || v.spo2 <= 92) return "watch";
    return "stable";
  }

  private pct(q: number) {
    if (!this.latencies.length) return 0;
    const s = [...this.latencies].sort((a, b) => a - b);
    const i = (q / 100) * (s.length - 1);
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }

  snapshot(): Snapshot {
    const patients: Patient[] = this.patients.map((p) => {
      const v = p.history[p.history.length - 1];
      const aura = Math.round(p.auraSmooth || p.last?.aura || 12);
      const intersecting = p.xHold > 0 || Boolean(p.last?.intersecting);
      let risk = this.risk(aura, intersecting, v);
      const open = this.alerts.some(
        (a) => a.patient_id === p.roster.id && (a.status === "requested" || a.status === "accepted")
      );
      if (open && intersecting) risk = "critical";
      else if (open && risk === "stable") risk = "watch";
      return {
        id: p.roster.id,
        mrn: p.roster.mrn,
        name: p.roster.name,
        age: p.roster.age,
        sex: p.roster.sex,
        bed: p.roster.bed,
        unit: "4 West",
        condition: p.roster.condition,
        postop_day: p.roster.postop_day,
        device: p.roster.device,
        device_vendor: p.roster.device_vendor,
        admit: p.roster.admit,
        allergies: p.roster.allergies,
        vitals: v,
        history: p.history.slice(-60),
        aura,
        risk,
        intersecting,
        news2: p.last?.news2 ?? 0,
        if_score: p.last?.if_raw ?? 0,
        reasons: p.last?.reasons ?? [],
        contributions: p.last?.contributions ?? [],
        battery: p.roster.battery,
        trajectory: p.kind,
      };
    });
    patients.sort((a, b) => b.aura - a.aura || a.bed.localeCompare(b.bed));
    const ticks = Math.max(this.tickI, 1);
    const pipeline: Pipeline = {
      topics: this.topics.map((t) => ({
        name: t.name,
        rate_hz: Math.round((t.count / ticks) * 100) / 100,
        retained: t.recent.length,
        recent: t.recent,
      })),
      model: {
        name: "IsolationForest",
        estimators: 200,
        contamination: 0.04,
        trained_windows: 2048,
        features: FEATURES,
        tpr: 0.965,
        fpr: 0.092,
        precision: 0.91,
        p95_latency_ms: Math.round(this.pct(95) * 100) / 100,
        p50_latency_ms: Math.round(this.pct(50) * 100) / 100,
      },
      ingested: this.ingested,
      windowed: this.windowed,
      anomalies: this.anomalies,
      fhir_tasks: this.alerts.length,
      sim_time: isoFrom(this.simMs),
      wall_tick_ms: 1000,
    };
    return {
      patients,
      alerts: this.alerts,
      pipeline,
      unit: "4 West · Step-down / RPM overlay",
      nurse: "J. Hale, RN",
      role: "Charge · 07:00–19:00",
    };
  }
}

const engine = new Engine();
type Listener = (snap: Snapshot, alert?: Alert) => void;
const listeners = new Set<Listener>();

export function startClientSim(onTick: Listener) {
  listeners.add(onTick);
  onTick(engine.snapshot());
  const id = window.setInterval(() => {
    const alert = engine.tick() ?? undefined;
    const snap = engine.snapshot();
    for (const fn of listeners) fn(snap, alert);
  }, 1000);
  return () => {
    listeners.delete(onTick);
    window.clearInterval(id);
  };
}

export function clientCrash(id: string) {
  engine.crash(id);
  const snap = engine.snapshot();
  for (const fn of listeners) fn(snap);
}

export function clientReset() {
  engine.reset();
  const snap = engine.snapshot();
  for (const fn of listeners) fn(snap);
}

export function clientStatus(id: string, status: AlertStatus) {
  engine.setStatus(id, status);
  const snap = engine.snapshot();
  for (const fn of listeners) fn(snap);
}
