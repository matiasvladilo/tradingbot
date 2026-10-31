"use client";

import { Trade, pct, signClass, usd, usePoll } from "@/lib/ft";

const CSV_COLUMNS: (keyof Trade)[] = [
  "trade_id",
  "pair",
  "open_date",
  "close_date",
  "open_rate",
  "close_rate",
  "amount",
  "stake_amount",
  "profit_abs",
  "profit_ratio",
  "fee_open",
  "fee_close",
  "enter_tag",
  "exit_reason",
];

function downloadCsv(trades: Trade[]) {
  const rows = [CSV_COLUMNS.join(","), ...trades.map((t) => CSV_COLUMNS.map((c) => t[c] ?? "").join(","))];
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `trading-lab-simulacion-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistorialPage() {
  const { data, error } = usePoll<{ trades: Trade[]; total_trades: number }>("trades?limit=500", 30_000);
  const trades = [...(data?.trades ?? [])].reverse();
  const fees = trades.reduce(
    (s, t) => s + t.stake_amount * t.fee_open + (t.close_rate ?? 0) * t.amount * (t.fee_close ?? 0),
    0,
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Historial</h1>
        <span className="badge">{data?.total_trades ?? 0} operaciones</span>
        <span className="badge">Comisiones estimadas {usd(fees)} USDT</span>
        <span className="spacer" />
        <button disabled={!trades.length} onClick={() => downloadCsv(trades)}>
          Exportar CSV
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        {!trades.length && <p className="muted">Aún no hay operaciones cerradas en la simulación.</p>}
        {trades.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Par</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th className="num">Entrada</th>
                <th className="num">Salida</th>
                <th className="num">Importe</th>
                <th className="num">P&L</th>
                <th>Motivo salida</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.trade_id}>
                  <td>{t.trade_id}</td>
                  <td>{t.pair}</td>
                  <td>{t.open_date}</td>
                  <td>{t.close_date ?? "abierta"}</td>
                  <td className="num">{usd(t.open_rate)}</td>
                  <td className="num">{usd(t.close_rate)}</td>
                  <td className="num">{usd(t.stake_amount)}</td>
                  <td className={`num ${signClass(t.profit_abs)}`}>
                    {usd(t.profit_abs)} ({pct(t.profit_ratio)})
                  </td>
                  <td>{t.exit_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
