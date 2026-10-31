"use client";

import { useState } from "react";
import { Locks, ShowConfig, ftAction, usePoll } from "@/lib/ft";

const LIMITS = [
  ["Riesgo por operación", "0,25% del patrimonio hasta el stop"],
  ["Máximo por activo", "20% del patrimonio"],
  ["Exposición total", "40% (2 posiciones × 20%)"],
  ["Pérdida diaria (UTC)", "1% → se bloquean nuevas entradas"],
  ["StoplossGuard", "3 stops en 24 h → pausa 12 h"],
  ["MaxDrawdown", "5% en 7 días → pausa 24 h"],
  ["Plazo máximo", "72 h por posición"],
];

export default function ControlesPage() {
  const cfg = usePoll<ShowConfig>("show_config", 5_000);
  const locks = usePoll<Locks>("locks", 15_000);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = (await ftAction(path, body)) as { status?: string; result?: string };
      setMsg(res.status ?? res.result ?? "Hecho");
      cfg.reload();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  const state = cfg.data?.state;
  const activeLocks = (locks.data?.locks ?? []).filter((l) => l.active);

  return (
    <>
      <h1>Controles</h1>
      <div className="grid two">
        <div className="card">
          <h2>Acciones</h2>
          <p>
            Estado del bot:{" "}
            <span className={`badge ${state === "running" ? "ok" : "warn"}`}>{state ?? "sin conexión"}</span>
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={busy || state !== "running"} onClick={() => run("stopentry")}>
              Pausar entradas
            </button>
            <button disabled={busy || state === "running"} onClick={() => run("start")}>
              Reanudar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                run("forceexit", { tradeid: "all" }, "¿Cerrar TODAS las posiciones simuladas a precio de mercado?")
              }
            >
              Cerrar posiciones
            </button>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            «Pausar entradas» solo impide abrir posiciones nuevas: los stops y salidas de las abiertas siguen
            activos. «Cerrar posiciones» vende todo a mercado.
          </p>
          {msg && <p className="note">Respuesta: {msg}</p>}
        </div>

        <div className="card">
          <h2>Límites de riesgo (estrategia v1)</h2>
          <table>
            <tbody>
              {LIMITS.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Bloqueos activos (protecciones)</h2>
          {!activeLocks.length && <p className="muted">Ninguno.</p>}
          {activeLocks.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Par</th>
                  <th>Hasta</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {activeLocks.map((l, i) => (
                  <tr key={i}>
                    <td>{l.pair}</td>
                    <td>{l.lock_end_time}</td>
                    <td>{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
