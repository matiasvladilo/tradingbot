"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { pct, signClass } from "@/lib/ft";

type Pcts = Record<"5" | "25" | "50" | "75" | "95", number>;
type Result = {
  strategy: string;
  start: string;
  end: string;
  fee: number | null;
  trades: number;
  actual_return: number;
  actual_max_drawdown: number;
  win_rate: number;
  prob_loss: number;
  final_pct: Pcts;
  drawdown_pct: Pcts;
  histogram: { from: number; to: number; count: number }[];
  bands: { trade: number; p5: number; p25: number; p50: number; p75: number; p95: number }[];
  without_best: { k: number; return: number }[];
  prob_loss_without_top2: number | null;
  median_without_top2: number | null;
};

const axis = { stroke: "#8b96a5", fontSize: 11 };
const tooltip = { contentStyle: { background: "#1c2330", border: "1px solid #2a3240" } };

function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${cls}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function verdict(r: Result) {
  const robust = r.prob_loss < 0.1 && (r.prob_loss_without_top2 ?? 1) < 0.25 && r.final_pct["5"] > 0;
  return robust
    ? { cls: "ok", text: "Robusta en la muestra: gana en casi todos los escenarios, incluso sin sus 2 mejores operaciones." }
    : { cls: "bad", text: "Frágil: una parte importante de los escenarios termina en pérdida." };
}

export default function RobustezPage() {
  const [data, setData] = useState<{ sims: number; results: Result[] } | null>(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    fetch("/api/montecarlo")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const r = data?.results[sel];
  const bands = (r?.bands ?? []).map((b) => ({
    trade: b.trade,
    outer: [(b.p5 - 1) * 100, (b.p95 - 1) * 100],
    inner: [(b.p25 - 1) * 100, (b.p75 - 1) * 100],
    median: (b.p50 - 1) * 100,
  }));
  const v = r && verdict(r);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Robustez · Monte Carlo</h1>
        <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
          {data?.results.map((x, i) => (
            <option key={i} value={i}>
              {x.strategy} · {x.start.slice(0, 10)} → {x.end.slice(0, 10)} · fee {x.fee != null ? pct(x.fee) : "?"}
            </option>
          ))}
        </select>
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        Se toman las operaciones reales del backtest y se arman {data?.sims.toLocaleString("es-CL")} historias
        alternativas eligiéndolas al azar (pueden repetirse u omitirse). Responde: ¿el resultado fue suerte de unas pocas
        operaciones o se sostiene? Supone operaciones independientes y que el futuro se parece a la muestra.
      </p>

      {!data?.results.length && (
        <p className="muted">Sin datos. Ejecuta scripts/monte_carlo.py &lt;zip&gt; &lt;estrategia&gt;.</p>
      )}

      {r && v && (
        <>
          <div className={`card`} style={{ marginBottom: 16 }}>
            <span className={`badge ${v.cls}`}>{v.cls === "ok" ? "Robusta" : "Frágil"}</span>{" "}
            <span>{v.text}</span>
          </div>

          <div className="grid kpis">
            <Kpi label="Resultado real del backtest" value={pct(r.actual_return, 1)} sub={`${r.trades} operaciones · acierto ${pct(r.win_rate, 0)}`} cls={signClass(r.actual_return)} />
            <Kpi label="Probabilidad de terminar en pérdida" value={pct(r.prob_loss, 1)} cls={r.prob_loss > 0.2 ? "neg" : "pos"} />
            <Kpi label="Escenario malo (5%)" value={pct(r.final_pct["5"], 1)} sub="1 de cada 20 historias termina peor" cls={signClass(r.final_pct["5"])} />
            <Kpi label="Escenario típico (mediana)" value={pct(r.final_pct["50"], 1)} cls={signClass(r.final_pct["50"])} />
            <Kpi label="Escenario bueno (95%)" value={pct(r.final_pct["95"], 1)} cls={signClass(r.final_pct["95"])} />
            <Kpi label="Caída máxima probable" value={pct(r.drawdown_pct["5"], 1)} sub={`típica ${pct(r.drawdown_pct["50"], 1)} · entre cierres de operaciones`} cls="neg" />
            <Kpi
              label="Sin sus 2 mejores operaciones"
              value={pct(r.median_without_top2, 1)}
              sub={`prob. de pérdida ${pct(r.prob_loss_without_top2, 1)}`}
              cls={signClass(r.median_without_top2)}
            />
          </div>

          <div className="grid two" style={{ marginTop: 16 }}>
            <div className="card">
              <h2>Abanico de resultados según avanzan las operaciones (%)</h2>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <ComposedChart data={bands}>
                    <CartesianGrid stroke="#1f2632" />
                    <XAxis dataKey="trade" {...axis} label={{ value: "operación nº", fill: "#8b96a5", fontSize: 11, position: "insideBottom", offset: -2 }} />
                    <YAxis {...axis} unit="%" />
                    <Tooltip {...tooltip} formatter={(val) => (Array.isArray(val) ? val.map((x) => `${Number(x).toFixed(1)}%`).join(" a ") : `${Number(val).toFixed(1)}%`)} />
                    <ReferenceLine y={0} stroke="#8b96a5" strokeDasharray="4 4" />
                    <Area dataKey="outer" name="90% de las historias" fill="#58a6ff" fillOpacity={0.15} stroke="none" isAnimationActive={false} />
                    <Area dataKey="inner" name="50% de las historias" fill="#58a6ff" fillOpacity={0.3} stroke="none" isAnimationActive={false} />
                    <Line dataKey="median" name="mediana" stroke="#58a6ff" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2>Distribución del resultado final (%)</h2>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={r.histogram.map((h) => ({ ...h, mid: (h.from + h.to) / 2 }))}>
                    <CartesianGrid stroke="#1f2632" />
                    <XAxis dataKey="mid" {...axis} tickFormatter={(x) => `${Number(x).toFixed(0)}%`} minTickGap={20} />
                    <YAxis {...axis} />
                    <Tooltip
                      {...tooltip}
                      labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.from}% a ${p[0].payload.to}%` : "")}
                      formatter={(val) => [`${val} historias`, ""]}
                    />
                    <Bar dataKey="count" isAnimationActive={false}>
                      {r.histogram.map((h, i) => (
                        <Cell key={i} fill={h.to <= 0 ? "#f85149" : h.from >= 0 ? "#3fb950" : "#d29922"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2>¿Depende de unas pocas operaciones?</h2>
            <table>
              <thead>
                <tr>
                  <th>Quitando las mejores…</th>
                  <th className="num">Resultado total</th>
                </tr>
              </thead>
              <tbody>
                {r.without_best.map((w) => (
                  <tr key={w.k}>
                    <td>{w.k === 0 ? "Ninguna (real)" : `${w.k} mejor${w.k > 1 ? "es" : ""}`}</td>
                    <td className={`num ${signClass(w.return)}`}>{pct(w.return, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Si el resultado se da vuelta al quitar 1 o 2 operaciones, la estrategia depende de la suerte de pocos eventos.
            </p>
          </div>
        </>
      )}
    </>
  );
}
