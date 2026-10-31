"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { pct, signClass, usd } from "@/lib/ft";

type Scenario = {
  strategy: string;
  base: string;
  risk: number | null;
  trades: number;
  start: string;
  end: string;
  final: number;
  total_return: number;
  cagr: number;
  max_drawdown: number;
  lowest_equity: number;
  worst_peak_to_trough: { peak: number; trough: number; date: string };
  return_2020_2024: number;
  return_2025_now: number;
  yearly: { year: number; return: number }[];
  curve: { t: string; equity: number }[];
};

const BASES: Record<string, string> = {
  TrendDaily: "TrendDaily (ruptura de 20 días)",
  DualMomentum: "DualMomentum (el más fuerte de BTC/ETH)",
};
const RISK_COLORS = ["#3fb950", "#58a6ff", "#d29922", "#f85149"];
const axis = { stroke: "#8b96a5", fontSize: 11 };
const tooltip = { contentStyle: { background: "#1c2330", border: "1px solid #2a3240" } };
const riskLabel = (r: number | null) => (r == null ? "100% invertido" : `${pct(r, r < 0.01 ? 2 : 0)} por operación`);

export default function RiesgoPage() {
  const [all, setAll] = useState<Scenario[]>([]);
  const [base, setBase] = useState("TrendDaily");
  const [idx, setIdx] = useState(1);

  useEffect(() => {
    fetch("/api/risk")
      .then((r) => r.json())
      .then((d: { scenarios: Scenario[] }) => setAll(d.scenarios));
  }, []);

  const levels = all.filter((s) => s.base === base).sort((a, b) => (a.risk ?? 1) - (b.risk ?? 1));
  const hold = all.find((s) => s.base === "BuyAndHold");
  const sel = levels[Math.min(idx, levels.length - 1)];

  const curves = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    for (const s of [...levels, ...(hold ? [hold] : [])])
      for (const p of s.curve) {
        const row = rows.get(p.t) ?? { t: p.t };
        row[riskLabel(s.risk)] = p.equity;
        rows.set(p.t, row);
      }
    return [...rows.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [levels, hold]);

  if (!all.length) return <p className="muted">Sin datos. Ejecuta scripts/risk_scenarios.py.</p>;

  return (
    <>
      <h1>Riesgo vs. ganancia</h1>
      <p className="note" style={{ marginTop: 0 }}>
        Mismas señales, mismo período ({sel?.start.slice(0, 10)} → {sel?.end.slice(0, 10)}), mismas comisiones. Lo único que
        cambia es cuánto se arriesga en cada operación. Empieza siempre con 1.000 USDT virtuales. Es el pasado: no garantiza
        el futuro.
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <select value={base} onChange={(e) => setBase(e.target.value)}>
          {Object.entries(BASES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="muted">Riesgo por operación:</span>
        {levels.map((s, i) => (
          <button key={s.strategy} className={i === idx ? "active-btn" : ""} onClick={() => setIdx(i)}>
            {pct(s.risk, (s.risk ?? 1) < 0.01 ? 2 : 0)}
          </button>
        ))}
      </div>

      {sel && hold && (
        <div className="grid two" style={{ marginBottom: 16 }}>
          <div className="card">
            <h2>{BASES[base]} · {riskLabel(sel.risk)}</h2>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Con 1.000 USDT en enero de 2020 habrías terminado con{" "}
              <strong className={signClass(sel.total_return)}>{usd(sel.final, 0)} USDT</strong> ({pct(sel.total_return, 0)},
              unos {pct(sel.cagr, 1)} al año).
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              En su peor momento la cuenta cayó <strong className="neg">{pct(sel.max_drawdown, 1)}</strong>: de{" "}
              {usd(sel.worst_peak_to_trough.peak, 0)} a {usd(sel.worst_peak_to_trough.trough, 0)} USDT (
              {sel.worst_peak_to_trough.date}).
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              2020–2024: <span className={signClass(sel.return_2020_2024)}>{pct(sel.return_2020_2024, 0)}</span> · 2025–hoy:{" "}
              <span className={signClass(sel.return_2025_now)}>{pct(sel.return_2025_now, 1)}</span> · {sel.trades} operaciones
            </p>
          </div>
          <div className="card">
            <h2>Comparación: comprar y mantener (100% invertido)</h2>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Habrías terminado con <strong className="pos">{usd(hold.final, 0)} USDT</strong> ({pct(hold.total_return, 0)}).
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Pero en su peor momento la cuenta cayó <strong className="neg">{pct(hold.max_drawdown, 1)}</strong>: de{" "}
              {usd(hold.worst_peak_to_trough.peak, 0)} a {usd(hold.worst_peak_to_trough.trough, 0)} USDT (
              {hold.worst_peak_to_trough.date}). Para ganar eso había que no vender durante esa caída.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              2020–2024: <span className="pos">{pct(hold.return_2020_2024, 0)}</span> · 2025–hoy:{" "}
              <span className={signClass(hold.return_2025_now)}>{pct(hold.return_2025_now, 1)}</span>
            </p>
          </div>
        </div>
      )}

      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <h2>Todos los niveles</h2>
        <table>
          <thead>
            <tr>
              <th>Estrategia</th><th>Riesgo</th><th className="num">1.000 USDT se volvieron</th><th className="num">Por año</th>
              <th className="num">Peor caída</th><th className="num">2020–2024</th><th className="num">2025–hoy</th><th className="num">Peor año</th>
            </tr>
          </thead>
          <tbody>
            {[...all].map((s) => {
              const worst = Math.min(...s.yearly.map((y) => y.return));
              return (
                <tr key={s.strategy} style={s.strategy === sel?.strategy ? { background: "#1c2330" } : undefined}>
                  <td>{s.base === "BuyAndHold" ? "Comprar y mantener" : s.base}</td>
                  <td>{riskLabel(s.risk)}</td>
                  <td className={`num ${signClass(s.total_return)}`}>{usd(s.final, 0)}</td>
                  <td className="num">{pct(s.cagr, 1)}</td>
                  <td className="num neg">{pct(-s.max_drawdown, 1)}</td>
                  <td className={`num ${signClass(s.return_2020_2024)}`}>{pct(s.return_2020_2024, 0)}</td>
                  <td className={`num ${signClass(s.return_2025_now)}`}>{pct(s.return_2025_now, 1)}</td>
                  <td className={`num ${signClass(worst)}`}>{pct(worst, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">
          Fíjate en la regla que se repite: cada vez que sube la ganancia, sube también la peor caída. No hay fila con
          mucha ganancia y poca caída.
        </p>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Evolución de 1.000 USDT (escala logarítmica)</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={curves}>
                <CartesianGrid stroke="#1f2632" />
                <XAxis dataKey="t" {...axis} minTickGap={40} />
                <YAxis {...axis} scale="log" domain={["auto", "auto"]} tickFormatter={(v) => usd(v, 0)} />
                <Tooltip {...tooltip} formatter={(v) => usd(Number(v), 0)} />
                <Legend />
                {levels.map((s, i) => (
                  <Line key={s.strategy} dataKey={riskLabel(s.risk)} stroke={RISK_COLORS[i]} dot={false} strokeWidth={i === idx ? 3 : 1.5} isAnimationActive={false} />
                ))}
                {hold && <Line dataKey={riskLabel(null)} stroke="#8b96a5" dot={false} strokeDasharray="4 4" isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Resultado por año · {riskLabel(sel?.risk ?? null)}</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={(sel?.yearly ?? []).map((y) => ({ ...y, pct: y.return * 100, hold: (hold?.yearly.find((h) => h.year === y.year)?.return ?? 0) * 100 }))}>
                <CartesianGrid stroke="#1f2632" />
                <XAxis dataKey="year" {...axis} />
                <YAxis {...axis} unit="%" />
                <Tooltip {...tooltip} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <ReferenceLine y={0} stroke="#8b96a5" />
                <Bar dataKey="pct" name={base} isAnimationActive={false}>
                  {(sel?.yearly ?? []).map((y) => (
                    <Cell key={y.year} fill={y.return >= 0 ? "#3fb950" : "#f85149"} />
                  ))}
                </Bar>
                <Bar dataKey="hold" name="Comprar y mantener" fill="#8b96a566" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
