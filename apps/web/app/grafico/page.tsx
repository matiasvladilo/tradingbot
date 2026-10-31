"use client";

import { useState } from "react";
import CandleChart from "@/components/CandleChart";
import { Candles, Trade, usePoll } from "@/lib/ft";

const PAIRS = ["BTC/USDT", "ETH/USDT"];

export default function GraficoPage() {
  const [pair, setPair] = useState(PAIRS[0]);
  const candles = usePoll<Candles>(`pair_candles?pair=${encodeURIComponent(pair)}&timeframe=1h&limit=500`, 60_000);
  const closed = usePoll<{ trades: Trade[] }>("trades?limit=500", 60_000);
  const open = usePoll<Trade[]>("status", 15_000);

  const trades = [...(closed.data?.trades ?? []), ...(open.data ?? [])].filter((t) => t.pair === pair);

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Gráfico 1h</h1>
        <select value={pair} onChange={(e) => setPair(e.target.value)}>
          {PAIRS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="spacer" />
        <span className="note">
          Factores: EMA50/EMA200 de 4h (tendencia), nivel de ruptura 20 velas, stop 2×ATR, volumen. ▲ señal ·
          ● entrada · ✕ salida
        </span>
      </div>
      {candles.error && <p className="error">{candles.error}</p>}
      <div className="card">
        {candles.data ? <CandleChart candles={candles.data} trades={trades} /> : <p className="muted">Cargando…</p>}
      </div>
    </>
  );
}
