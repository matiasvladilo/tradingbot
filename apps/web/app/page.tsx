"use client";

import { Balance, Profit, ShowConfig, Trade, pct, signClass, usd, usePoll } from "@/lib/ft";

function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${cls}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function ResumenPage() {
  const cfg = usePoll<ShowConfig>("show_config", 15_000);
  const balance = usePoll<Balance>("balance");
  const profit = usePoll<Profit>("profit");
  const open = usePoll<Trade[]>("status", 5_000);

  const equity = balance.data?.total_bot ?? null;
  const start = balance.data?.starting_capital ?? null;
  const exposure = (open.data ?? []).reduce((s, t) => s + t.amount * (t.current_rate ?? t.open_rate), 0);
  const unrealized = (open.data ?? []).reduce((s, t) => s + t.profit_abs, 0);
  const online = !cfg.error && cfg.data;

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Resumen</h1>
        <span className="spacer" />
        <span className={`badge ${online ? "ok" : "bad"}`}>{online ? "Bot conectado" : "Bot sin conexión"}</span>
        {cfg.data && (
          <span className={`badge ${cfg.data.state === "running" ? "ok" : "warn"}`}>
            Estado: {cfg.data.state === "running" ? "operando" : cfg.data.state}
          </span>
        )}
        {cfg.data && (
          <span className="badge">
            {cfg.data.strategy} · {cfg.data.timeframe} · {cfg.data.exchange}
          </span>
        )}
      </div>

      {cfg.error && <p className="error">No hay conexión con Freqtrade. ¿Corre scripts/sim.ps1?</p>}

      <div className="grid kpis">
        <Kpi label="Patrimonio virtual (USDT)" value={usd(equity)} sub={`Inicial ${usd(start)}`} />
        <Kpi
          label="Resultado neto total"
          value={usd(profit.data?.profit_all_coin)}
          sub={pct(profit.data?.profit_all_ratio)}
          cls={signClass(profit.data?.profit_all_coin)}
        />
        <Kpi
          label="Realizado (cerradas)"
          value={usd(profit.data?.profit_closed_coin)}
          cls={signClass(profit.data?.profit_closed_coin)}
        />
        <Kpi label="No realizado (abiertas)" value={usd(unrealized)} cls={signClass(unrealized)} />
        <Kpi
          label="Exposición"
          value={usd(exposure)}
          sub={equity ? `${pct(exposure / equity, 1)} del patrimonio · máx 40%` : undefined}
        />
        <Kpi
          label="Operaciones"
          value={`${profit.data?.closed_trade_count ?? 0} cerradas`}
          sub={`${profit.data?.winning_trades ?? 0} ganadas · ${profit.data?.losing_trades ?? 0} perdidas · acierto ${pct(profit.data?.winrate, 0)}`}
        />
        <Kpi
          label="Máx. drawdown"
          value={pct(profit.data?.max_drawdown)}
          sub={usd(profit.data?.max_drawdown_abs)}
          cls={profit.data?.max_drawdown ? "neg" : ""}
        />
        <Kpi label="Profit factor" value={profit.data?.profit_factor?.toFixed(2) ?? "—"} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Posiciones abiertas</h2>
        {open.data && open.data.length === 0 && <p className="muted">Sin posiciones. El bot espera una señal.</p>}
        {open.data && open.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Par</th>
                  <th>Abierta</th>
                  <th className="num">Entrada</th>
                  <th className="num">Actual</th>
                  <th className="num">Stop</th>
                  <th className="num">Importe</th>
                  <th className="num">P&L</th>
                </tr>
              </thead>
              <tbody>
                {open.data.map((t) => (
                  <tr key={t.trade_id}>
                    <td>{t.pair}</td>
                    <td>{t.open_date}</td>
                    <td className="num">{usd(t.open_rate)}</td>
                    <td className="num">{usd(t.current_rate)}</td>
                    <td className="num">{usd(t.stop_loss_abs)}</td>
                    <td className="num">{usd(t.stake_amount)}</td>
                    <td className={`num ${signClass(t.profit_abs)}`}>
                      {usd(t.profit_abs)} ({pct(t.profit_ratio)})
                    </td>
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
