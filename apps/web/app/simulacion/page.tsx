"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Daily, pct, signClass, usd, usePoll } from "@/lib/ft";

type StrategyRun = {
  name: string;
  fee: number | null;
  metrics: Record<string, number | null>;
  equity: { t: string; equity: number; drawdown: number }[];
  exit_reasons: { reason: string; trades: number; profit_abs: number }[];
};
type Run = { id: string; start: string; end: string; timerange: string | null; strategies: StrategyRun[] };

const COLORS: Record<string, string> = {
  BreakoutTrend: "#a371f7",
  BreakoutTrendV2: "#58a6ff",
  V2Breakeven: "#79c0ff",
  V2Filtro: "#f778ba",
  V2Regimen: "#56d4dd",
  TrendDaily: "#3fb950",
  BuyAndHold: "#d29922",
};
const color = (name: string) => COLORS[name] ?? "#58a6ff";

const axis = { stroke: "#8b96a5", fontSize: 11 };
const tooltip = { contentStyle: { background: "#1c2330", border: "1px solid #2a3240" } };

function runLabel(r: Run) {
  const fee = r.strategies[0]?.fee;
  return `${r.start.slice(0, 10)} → ${r.end.slice(0, 10)} · fee ${fee != null ? pct(fee, 2) : "?"} · ${r.strategies
    .map((s) => s.name)
    .join(" vs ")}`;
}

function merge(strats: StrategyRun[], key: "equity" | "drawdown") {
  const rows = new Map<string, Record<string, number | string>>();
  for (const s of strats)
    for (const p of s.equity) {
      const row = rows.get(p.t) ?? { t: p.t };
      row[s.name] = key === "equity" ? p.equity : p.drawdown * 100;
      rows.set(p.t, row);
    }
  return [...rows.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
}

const METRIC_ROWS: [string, string, (v: number | null) => string][] = [
  ["Operaciones", "total_trades", (v) => String(v ?? "—")],
  ["Resultado neto", "profit_total", (v) => pct(v)],
  ["Resultado (USDT)", "profit_total_abs", (v) => usd(v)],
  ["CAGR", "cagr", (v) => pct(v)],
  ["Máx. drawdown (patrimonio diario)", "equity_max_drawdown", (v) => pct(v)],
  ["Máx. drawdown (op. cerradas)", "max_drawdown_account", (v) => pct(v)],
  ["Tasa de acierto", "winrate", (v) => pct(v, 1)],
  ["Profit factor", "profit_factor", (v) => (v == null ? "—" : v.toFixed(2))],
  ["Expectativa / op. (USDT)", "expectancy", (v) => usd(v)],
  ["Sharpe (op. cerradas)", "sharpe", (v) => (v == null ? "—" : v.toFixed(2))],
  ["Cambio del mercado", "market_change", (v) => pct(v)],
];

export default function SimulacionPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<string>("");
  const daily = usePoll<Daily>("daily?timescale=30", 60_000);

  useEffect(() => {
    fetch("/api/backtests")
      .then((r) => r.json())
      .then((d: { runs: Run[] }) => {
        setRuns(d.runs);
        setSel(d.runs[0]?.id ?? "");
      });
  }, []);

  const run = runs.find((r) => r.id === sel);
  const equity = useMemo(() => (run ? merge(run.strategies, "equity") : []), [run]);
  const dd = useMemo(() => (run ? merge(run.strategies, "drawdown") : []), [run]);
  const dailyData = [...(daily.data?.data ?? [])].reverse();

  return (
    <>
      <h1>Simulación</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Backtests históricos</h2>
          <select value={sel} onChange={(e) => setSel(e.target.value)}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {runLabel(r)}
              </option>
            ))}
          </select>
        </div>
        {!runs.length && (
          <p className="muted">Sin backtests. Ejecuta un backtest y luego scripts/export_backtests.py.</p>
        )}
        {run && (
          <>
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={equity}>
                  <CartesianGrid stroke="#1f2632" />
                  <XAxis dataKey="t" {...axis} minTickGap={40} />
                  <YAxis {...axis} scale="log" domain={["auto", "auto"]} tickFormatter={(v) => usd(v, 0)} />
                  <Tooltip {...tooltip} formatter={(v) => usd(Number(v))} />
                  <Legend />
                  {run.strategies.map((s) => (
                    <Line key={s.name} dataKey={s.name} stroke={color(s.name)} dot={false} strokeWidth={2} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="note">Patrimonio diario en USDT, escala logarítmica. Capital inicial 1.000 USDT.</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={dd}>
                  <CartesianGrid stroke="#1f2632" />
                  <XAxis dataKey="t" {...axis} minTickGap={40} />
                  <YAxis {...axis} unit="%" />
                  <Tooltip {...tooltip} formatter={(v) => `${Number(v).toFixed(2)}%`} />
                  {run.strategies.map((s) => (
                    <Area
                      key={s.name}
                      dataKey={s.name}
                      stroke={color(s.name)}
                      fill={color(s.name)}
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="note">Drawdown: caída desde el máximo de patrimonio.</p>

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Métrica</th>
                    {run.strategies.map((s) => (
                      <th key={s.name} className="num" style={{ color: color(s.name) }}>
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map(([label, key, fmt]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {run.strategies.map((s) => (
                        <td
                          key={s.name}
                          className={`num ${key.startsWith("profit_total") ? signClass(s.metrics[key]) : ""}`}
                        >
                          {fmt(s.metrics[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Paper trading en vivo · resultado diario (USDT)</h2>
        {daily.error && <p className="error">{daily.error}</p>}
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={dailyData}>
              <CartesianGrid stroke="#1f2632" />
              <XAxis dataKey="date" {...axis} minTickGap={30} />
              <YAxis {...axis} />
              <Tooltip {...tooltip} formatter={(v) => usd(Number(v))} />
              <Bar dataKey="abs_profit" name="Resultado" fill="#a371f7" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="note">
          Los fills del paper son simulados con precios reales; no garantizan fills iguales con dinero real.
        </p>
      </div>
    </>
  );
}
