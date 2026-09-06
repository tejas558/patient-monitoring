from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

FEATURE_COLS = [
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
]

# Isolation Forest is trained on healthy windows. These medians/IQRs
# are used only to turn a score into a rough "which vital pulled it".
HEALTHY_CENTER = np.array(
    [76.0, 42.0, 97.5, 36.7, 16.0, 124.0, 0.0, 0.0, 0.0, 0.0, 2.4, 3.0]
)
HEALTHY_SCALE = np.array(
    [8.0, 10.0, 1.4, 0.25, 2.2, 10.0, 4.0, 6.0, 0.15, 0.8, 1.2, 1.6]
)


def window_to_features(window: Sequence[dict]) -> np.ndarray:
    df = pd.DataFrame(window)
    hr = df["hr"].to_numpy(dtype=float)
    hrv = df["hrv"].to_numpy(dtype=float)
    spo2 = df["spo2"].to_numpy(dtype=float)
    temp = df["temp"].to_numpy(dtype=float)
    rr = df["rr"].to_numpy(dtype=float)
    sbp = df["sbp"].to_numpy(dtype=float)
    return np.array(
        [
            hr.mean(),
            hrv.mean(),
            spo2.mean(),
            temp.mean(),
            rr.mean(),
            sbp.mean(),
            hr[-1] - hr[0],
            hrv[-1] - hrv[0],
            temp[-1] - temp[0],
            spo2[-1] - spo2[0],
            hr.std(),
            hrv.std(),
        ],
        dtype=float,
    )


def intersection(window: Sequence[dict]) -> tuple[bool, float, float]:
    """HRV falling while core temperature is rising — the sepsis geometry."""
    hrv0 = float(window[0]["hrv"])
    hrv1 = float(window[-1]["hrv"])
    t0 = float(window[0]["temp"])
    t1 = float(window[-1]["temp"])
    hrv_drop = hrv0 - hrv1
    temp_rise = t1 - t0
    fever = t1 >= 38.0
    concurrent = hrv1 <= 22 and t1 >= 38.0
    trending = hrv_drop >= 7.5 and (temp_rise >= 0.28 or fever)
    hit = trending or concurrent
    return hit, hrv_drop, temp_rise


def news2(v: dict) -> int:
    score = 0
    rr = v["rr"]
    if rr <= 8 or rr >= 25:
        score += 3
    elif rr <= 11 or rr >= 21:
        score += 1
    spo2 = v["spo2"]
    if spo2 <= 91:
        score += 3
    elif spo2 <= 93:
        score += 2
    elif spo2 <= 95:
        score += 1
    temp = v["temp"]
    if temp <= 35.0:
        score += 3
    elif temp >= 39.1:
        score += 2
    elif temp <= 36.0 or temp >= 38.1:
        score += 1
    sbp = v["sbp"]
    if sbp <= 90 or sbp >= 220:
        score += 3
    elif sbp <= 100:
        score += 2
    elif sbp <= 110:
        score += 1
    hr = v["hr"]
    if hr <= 40 or hr >= 131:
        score += 3
    elif hr >= 111:
        score += 2
    elif hr <= 50 or hr >= 91:
        score += 1
    return score


@dataclass
class Score:
    if_raw: float
    aura: int
    anomaly: bool
    intersecting: bool
    news2: int
    hrv_drop: float
    temp_rise: float
    reasons: list[str]
    contributions: list[dict]


class Detector:
    def __init__(self, rng: np.random.Generator) -> None:
        self.rng = rng
        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.04,
            random_state=7,
            n_jobs=1,
        )
        self.trained_windows = 0
        self.tpr = 0.0
        self.fpr = 0.0
        self.precision = 0.0
        self._fit()

    def _healthy_row(self) -> np.ndarray:
        noise = self.rng.normal(0, 1, size=len(FEATURE_COLS))
        row = HEALTHY_CENTER + HEALTHY_SCALE * noise * 0.55
        row[2] = np.clip(row[2], 95, 100)
        row[3] = np.clip(row[3], 36.3, 37.3)
        return row

    def _sepsis_row(self, strength: float) -> np.ndarray:
        s = np.clip(strength, 0.3, 1.0)
        row = self._healthy_row()
        row[0] += 28 * s  # hr
        row[1] -= 22 * s  # hrv
        row[2] -= 4 * s  # spo2
        row[3] += 1.4 * s  # temp
        row[4] += 8 * s  # rr
        row[5] -= 22 * s  # sbp
        row[6] += 18 * s  # hr_delta
        row[7] -= 16 * s  # hrv_delta
        row[8] += 0.7 * s  # temp_delta
        row[9] -= 3 * s  # spo2_delta
        return row

    def _cardiac_row(self, strength: float) -> np.ndarray:
        s = np.clip(strength, 0.3, 1.0)
        row = self._healthy_row()
        row[0] += 34 * s
        row[1] -= 18 * s
        row[2] -= 2 * s
        row[5] -= 28 * s
        row[6] += 22 * s
        row[7] -= 12 * s
        row[10] += 4 * s
        return row

    def _chronic_row(self) -> np.ndarray:
        """Stable COPD / CHF-like envelope so chronic baselines aren't all anomalies."""
        row = self._healthy_row()
        row[0] += 10
        row[1] -= 10
        row[2] -= 4.5
        row[4] += 5
        row[5] += 8
        return row

    def _mild_row(self) -> np.ndarray:
        """Borderline deterioration — some of these should miss, keeping TPR honest."""
        row = self._healthy_row()
        row[0] += 10
        row[1] -= 6
        row[3] += 0.25
        return row

    def _fit(self) -> None:
        healthy = np.vstack(
            [self._healthy_row() for _ in range(1800)]
            + [self._chronic_row() for _ in range(248)]
        )
        self.model.fit(healthy)
        self.trained_windows = int(healthy.shape[0])
        self._backtest()

    def _backtest(self) -> None:
        pos = np.vstack(
            [self._sepsis_row(self.rng.uniform(0.55, 1.0)) for _ in range(80)]
            + [self._cardiac_row(self.rng.uniform(0.55, 1.0)) for _ in range(30)]
            + [self._mild_row() for _ in range(5)]
        )
        neg = np.vstack(
            [self._healthy_row() for _ in range(90)]
            + [self._chronic_row() for _ in range(30)]
        )
        pred_pos = self.model.predict(pos) == -1
        pred_neg = self.model.predict(neg) == -1
        tp = int(pred_pos.sum())
        fn = int((~pred_pos).sum())
        fp = int(pred_neg.sum())
        tn = int((~pred_neg).sum())
        self.tpr = tp / max(tp + fn, 1)
        self.fpr = fp / max(fp + tn, 1)
        self.precision = tp / max(tp + fp, 1)

    def score(self, window: Sequence[dict]) -> Score:
        x = window_to_features(window).reshape(1, -1)
        raw = float(-self.model.decision_function(x)[0])  # higher = more anomalous
        anomaly = bool(self.model.predict(x)[0] == -1)
        # Map typical range ~[-0.1, 0.35] onto 0–100 with a soft curve.
        aura = int(np.clip(100 * (1 / (1 + np.exp(-8 * (raw - 0.05)))), 1, 99))
        hit, hrv_drop, temp_rise = intersection(window)
        latest = window[-1]
        n2 = news2(latest)
        if hit:
            aura = int(np.clip(aura + 14, 1, 99))
        aura = int(np.clip(aura + n2 * 2, 1, 99))

        z = (x.reshape(-1) - HEALTHY_CENTER) / HEALTHY_SCALE
        order = np.argsort(np.abs(z))[::-1]
        contributions = []
        labels = {
            "hr_mean": "Heart rate",
            "hrv_mean": "HRV (RMSSD)",
            "spo2_mean": "SpO₂",
            "temp_mean": "Temperature",
            "rr_mean": "Resp rate",
            "sbp_mean": "Systolic BP",
            "hr_delta": "HR trend",
            "hrv_delta": "HRV trend",
            "temp_delta": "Temp trend",
            "spo2_delta": "SpO₂ trend",
            "hr_std": "HR variability",
            "hrv_std": "HRV variability",
        }
        for i in order[:5]:
            contributions.append(
                {
                    "feature": labels[FEATURE_COLS[i]],
                    "z": round(float(z[i]), 2),
                }
            )

        reasons: list[str] = []
        if hit:
            if hrv_drop >= 4:
                reasons.append(
                    f"HRV × temp intersection · RMSSD ↓{hrv_drop:.0f} ms, core {latest['temp']:.1f}°C"
                )
            else:
                reasons.append(
                    f"HRV × temp intersection · RMSSD {latest['hrv']:.0f} ms with core {latest['temp']:.1f}°C"
                )
        if latest["hr"] >= 100:
            reasons.append(f"Tachycardia {latest['hr']} /min")
        if latest["hrv"] <= 22:
            reasons.append(f"Suppressed HRV {latest['hrv']:.0f} ms")
        if latest["temp"] >= 38.0:
            reasons.append(f"Fever {latest['temp']:.1f}°C")
        if latest["spo2"] <= 94:
            reasons.append(f"Desaturation {latest['spo2']}%")
        if latest["sbp"] <= 100:
            reasons.append(f"Hypotension {latest['sbp']}/{latest['dbp']}")
        if latest["rr"] >= 22:
            reasons.append(f"Tachypnea {latest['rr']} /min")
        if anomaly and not reasons:
            reasons.append("Isolation Forest out-of-distribution window")
        if n2 >= 5:
            reasons.append(f"NEWS2 {n2} — high early-warning score")

        return Score(
            if_raw=raw,
            aura=aura,
            anomaly=anomaly,
            intersecting=hit,
            news2=n2,
            hrv_drop=hrv_drop,
            temp_rise=temp_rise,
            reasons=reasons[:4],
            contributions=contributions,
        )
