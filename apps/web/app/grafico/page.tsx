"use client";

import { useEffect, useMemo, useState } from "react";
import CandleChart from "@/components/CandleChart";
import {
  Candles,
  ChartTrade,
  Trade,
  duration,
  exitLabel,
  fmtTime,
  pct,
  signClass,
  usd,
  usePoll,
} from "@/lib/ft";
import { useBot } from "@/lib/bot-context";

const PAIRS = ["BTC/USDT", "ETH/USDT"];
const LIVE = "live";
// Estrategias de velas diarias: sus backtests se muestran con el bot diario
const DAILY = new Set(["TrendDaily", "MomentumVotes", "DualMomentum", "RSI2Reversion"]);

type BacktestRun = {
  id: string;
  start: string;
  end: string;
  strategies: { name: string; fee: number | null; trades: ChartTrade[] }[];
};

const toChart = (t: Trade): ChartTrade => ({ ...t, is_open: t.is_open });

export default function GraficoPage() {
  const [pair, setPair] = useState(PAIRS[0]);
  const [source, setSource] = useState(LIVE);
  const [showSignals, setShowSignals] = useState(true);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const { bot } = useBot();

  useEffect(() => {
    setSource(LIVE);
    setFocusId(null);
  }, [bot.id]);

  const candles = usePoll<Candles>(
    `pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${bot.timeframe}&limit=${bot.candleLimit}`,
    60_000,
  );
  const closed = usePoll<{ trades: Trade[] }>("trades?limit=500", 30_000);
  const open = usePoll<Trade[]>("status", 15_000);

  useEffect(() => {
    fetch("/api/backtests")
      .then((r) => r.json())
      .then((d: { runs: BacktestRun[] }) => setRuns(d.runs));
  }, []);

  const backtests = runs.flatMap((r) =>
    r.strategies
      .filter((s) => !s.name.startsWith("BuyAndHold") && DAILY.has(s.name) === (bot.timeframe === "1d"))
      .map((s) => ({
        key: `${r.id}:${s.name}`,
        label: `${s.name} · backtest ${r.start.slice(0, 10)} → ${r.end.slice(0, 10)} · fee ${s.fee != null ? pct(s.fee) : "?"}`,
        trades: s.trades.map((t) => ({ ...t, is_open: false })),
      })),
  );

  const liveKey = JSON.stringify([closed.data?.trades, open.data]);
  const allTrades: ChartTrade[] = useMemo(() => {
    if (source === LIVE) return [...(closed.data?.trades ?? []), ...(open.data ?? [])].map(toChart);
    return backtests.find((b) => b.key === source)?.trades ?? [];
  }, [source, liveKey, runs, bot.strategy]);

  const range = useMemo(() => {
    const i = candles.data?.columns.indexOf("__date_ts") ?? -1;
    const rows = candles.data?.data ?? [];
    if (i < 0 || !rows.length) return null;
    return { from: rows[0][i] as number, to: (rows[rows.length - 1][i] as number) + bot.barSeconds * 1000 };
  }, [candles.data, bot.barSeconds]);

  const trades = useMemo(
    () =>
      allTrades.filter(
        (t) => t.pair === pair && (!range || ((t.close_timestamp ?? Date.now()) >= range.from && t.open_timestamp <= range.to)),
      ),
    [allTrades, pair, range],
  );

  const totalPnl = trades.reduce((s, t) => s + t.profit_abs, 0);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Gráfico {bot.timeframe} · {bot.strategy}</h1>
        <select value={pair} onChange={(e) => (setPair(e.target.value), setFocusId(null))}>
          {PAIRS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => (setSource(e.target.value), setFocusId(null))}>
          <option value={LIVE}>Operaciones: paper en vivo</option>
          {backtests.map((b) => (
            <option key={b.key} value={b.key}>
              Operaciones: {b.label}
            </option>
          ))}
        </select>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={showSignals} onChange={(e) => setShowSignals(e.target.checked)} />
          Mostrar señales
        </label>
      </div>

      <p className="note" style={{ marginTop: 0 }}>
        <span style={{ color: "#58a6ff" }}>▲ C12</span> = compra de la operación #12 ·{" "}
        <span className="pos">▼ V12 +1,2%</span> / <span className="neg">▼ V12 −0,8%</span> = venta que la cierra
        con ganancia / pérdida ·
        la línea une entrada y salida · línea punteada = posición aún abierta (con su stop) ·{" "}
        <span style={{ color: "#a371f7" }}>● señal</span> = la regla se cumplió; no siempre hay compra (límites de
        riesgo, posición ya abierta, bot detenido o señal anterior al inicio del bot). {bot.factors}
      </p>

      {candles.error && <p className="error">{candles.error}</p>}
      <div className="card">
        {candles.data ? (
          <CandleChart
            candles={candles.data}
            trades={trades}
            showSignals={showSignals}
            focusId={focusId}
            barSeconds={bot.barSeconds}
          />
        ) : (
          <p className="muted">Cargando…</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Operaciones en este gráfico · {pair}</h2>
          <span className="badge">{trades.length}</span>
          <span className={`badge ${signClass(totalPnl)}`}>Total {usd(totalPnl)} USDT</span>
          <span className="spacer" />
          <span className="note">Clic en una fila para ir a esa operación</span>
        </div>
        {!trades.length && (
          <p className="muted">
            {source === LIVE
              ? "El bot en vivo aún no ha operado en este par. Elige un backtest para ver ejemplos de entradas y salidas."
              : "Ninguna operación del backtest cae en este rango de velas."}
          </p>
        )}
        {trades.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Compra</th>
                  <th>Venta</th>
                  <th>Duración</th>
                  <th className="num">Precio entrada</th>
                  <th className="num">Precio salida</th>
                  <th className="num">Importe</th>
                  <th className="num">Resultado</th>
                  <th>Motivo de cierre</th>
                </tr>
              </thead>
              <tbody>
                {[...trades].reverse().map((t) => (
                  <tr
                    key={t.trade_id}
                    onClick={() => setFocusId(t.trade_id)}
                    style={{ cursor: "pointer", background: focusId === t.trade_id ? "#1c2330" : undefined }}
                  >
                    <td>{t.trade_id}</td>
                    <td>{fmtTime(t.open_timestamp)}</td>
                    <td>{t.close_timestamp ? fmtTime(t.close_timestamp) : <span className="badge warn">abierta</span>}</td>
                    <td>{duration(t.open_timestamp, t.close_timestamp ?? Date.now())}</td>
                    <td className="num">{usd(t.open_rate)}</td>
                    <td className="num">{usd(t.close_rate ?? t.current_rate)}</td>
                    <td className="num">{usd(t.stake_amount)}</td>
                    <td className={`num ${signClass(t.profit_abs)}`}>
                      {usd(t.profit_abs)} ({pct(t.profit_ratio)})
                    </td>
                    <td>{exitLabel(t.exit_reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
