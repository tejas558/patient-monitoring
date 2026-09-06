import type { Vitals } from "../types";

export function Sparkline({
  values,
  color,
  width = 128,
  height = 34,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="spark" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function padded(vals: number[], minSpan: number): [number, number] {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(hi - lo, minSpan);
  return [lo - span * 0.18, hi + span * 0.18];
}

function linePath(
  vals: number[],
  lo: number,
  hi: number,
  w: number,
  h: number,
  pad: number
) {
  const span = hi - lo || 1;
  return vals
    .map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - lo) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DualChart({ history }: { history: Vitals[] }) {
  const w = 640;
  const h = 180;
  const pad = 10;
  if (history.length < 2) return null;
  const hrv = history.map((x) => x.hrv);
  const temp = history.map((x) => x.temp);
  const [hrvLo, hrvHi] = padded(hrv, 8);
  const [tLo, tHi] = padded(temp, 0.6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="HRV and temperature">
      <path d={linePath(hrv, hrvLo, hrvHi, w, h, pad)} fill="none" stroke="#3d6a57" strokeWidth="2.2" />
      <path d={linePath(temp, tLo, tHi, w, h, pad)} fill="none" stroke="#b24e3c" strokeWidth="2.2" />
    </svg>
  );
}

export function MultiChart({ history }: { history: Vitals[] }) {
  const w = 640;
  const h = 180;
  const pad = 8;
  if (history.length < 2) return null;
  const series: { key: keyof Vitals; color: string; lo: number; hi: number }[] = [
    { key: "hr", color: "#4a6178", lo: 50, hi: 150 },
    { key: "spo2", color: "#3d6a57", lo: 88, hi: 100 },
    { key: "rr", color: "#a56f2a", lo: 10, hi: 32 },
    { key: "sbp", color: "#8a8376", lo: 80, hi: 160 },
  ];
  const path = (vals: number[], lo: number, hi: number) => {
    const span = hi - lo || 1;
    return vals
      .map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - lo) / span) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Vitals history">
      {series.map((s) => (
        <path
          key={s.key}
          d={path(
            history.map((x) => Number(x[s.key])),
            s.lo,
            s.hi
          )}
          fill="none"
          stroke={s.color}
          strokeWidth="1.8"
          opacity={0.9}
        />
      ))}
    </svg>
  );
}

export function Ecg({ hr }: { hr: number }) {
  const w = 640;
  const h = 72;
  const beat = Math.max(18, Math.min(48, 60000 / Math.max(hr, 40) / 12));
  const points: string[] = [];
  let x = 0;
  let i = 0;
  while (x < w + 40) {
    const seq: [number, number][] = [
      [beat * 0.18, 0],
      [beat * 0.08, -6],
      [beat * 0.08, 0],
      [beat * 0.05, 4],
      [beat * 0.04, -26],
      [beat * 0.05, 14],
      [beat * 0.08, 0],
      [beat * 0.12, -8],
      [beat * 0.14, 0],
      [beat * 0.18, 0],
    ];
    for (const [dx, v] of seq) {
      x += dx;
      points.push(`${x.toFixed(1)},${36 - v}`);
    }
    i += 1;
    if (i > 40) break;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ecg" aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#3d6a57"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function Gauge({ value }: { value: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 72 ? "#b24e3c" : value >= 48 ? "#a56f2a" : "#3d6a57";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`AURA ${value}`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e6e0d4" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="44"
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="16"
        fill="#2b271f"
      >
        {value}
      </text>
    </svg>
  );
}
