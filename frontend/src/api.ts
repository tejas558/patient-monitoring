import { useEffect, useRef, useState } from "react";
import { clientCrash, clientReset, clientStatus, startClientSim } from "./sim";
import type { Alert, AlertStatus, Snapshot } from "./types";

let mode: "ws" | "local" = "local";

export async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export function useAura() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState<Alert | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: number | undefined;
    let stopLocal: (() => void) | undefined;

    const applyTick = (next: Snapshot, alert?: Alert) => {
      setSnap(next);
      setConnected(true);
      if (alert) setFlash(alert);
    };

    const connectWs = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        mode = "ws";
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = window.setTimeout(connectWs, 1200);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as {
          type: string;
          snapshot?: Snapshot;
          patients?: Snapshot["patients"];
          alerts?: Snapshot["alerts"];
          pipeline?: Snapshot["pipeline"];
          alert?: Alert;
        };
        if (msg.type === "snapshot" && msg.snapshot) {
          setSnap(msg.snapshot);
        } else if (msg.type === "tick") {
          setSnap((prev) =>
            prev
              ? {
                  ...prev,
                  patients: msg.patients ?? prev.patients,
                  alerts: msg.alerts ?? prev.alerts,
                  pipeline: msg.pipeline ?? prev.pipeline,
                }
              : prev
          );
        } else if (msg.type === "alert" && msg.alert) {
          setFlash(msg.alert);
        }
      };
    };

    const start = async () => {
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 700);
        const r = await fetch("/api/health", { signal: ctrl.signal });
        window.clearTimeout(t);
        if (r.ok && !closed) {
          connectWs();
          return;
        }
      } catch {
        /* static host — run the stream in the browser */
      }
      if (closed) return;
      mode = "local";
      stopLocal = startClientSim(applyTick);
    };

    start();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      wsRef.current?.close();
      stopLocal?.();
    };
  }, []);

  return { snap, connected, flash, setFlash };
}

export async function ackAlert(id: string, status: AlertStatus) {
  if (mode === "ws") return post(`/api/alerts/${id}/status`, { status });
  clientStatus(id, status);
}

export async function crashPatient(id: string) {
  if (mode === "ws") return post(`/api/patients/${id}/crash`);
  clientCrash(id);
}

export async function resetSim() {
  if (mode === "ws") return post("/api/reset");
  clientReset();
}
