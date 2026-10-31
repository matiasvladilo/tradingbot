"use client";

import { useEffect, useMemo, useState } from "react";
import CandleChart from "@/components/CandleChart";
import { Balance, Candles, ChartTrade, Trade, exitLabel, fmtTime, ftAction, pct, signClass, usd, usePoll } from "@/lib/ft";
import { GLOSSARY, Idea, detectIdeas } from "@/lib/ideas";
import {
  JournalEntry,
  RULES,
  SETUPS,
  bootstrapEdge,
  buildTag,
  computeStats,
  parseTag,
  rMultiple,
  sizeOrder,
} from "@/lib/practice";

const BOT = "manual";
const PAIRS = ["BTC/USDT", "ETH/USDT"];
const RISKS = [0.0025, 0.005, 0.01, 0.02];
const MIN_TRADES_FOR_VERDICT = 20;

function usePrice(pair: string) {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/price?pair=${encodeURIComponent(pair)}`)
        .then((r) => r.json())
        .then((d) => alive && Number.isFinite(d.price) && setPrice(d.price))
        .catch(() => {});
    setPrice(null);
    load();
    const id = setInterval(load, 5_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pair]);
  return price;
}

function useJournal() {
  const [journal, setJournal] = useState<Record<string, JournalEntry>>({});
  const reload = () =>
    fetch("/api/journal")
      .then((r) => r.json())
      .then(setJournal);
  useEffect(() => {
    reload();
  }, []);
  const save = async (tradeId: number, data: Partial<JournalEntry>) => {
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId, ...data }),
    });
    reload();
  };
  return { journal, save };
}

function IdeaCard({ idea, onUse }: { idea: Idea; onUse: (i: Idea) => void }) {
  return (
    <div className="card" style={{ background: "var(--panel-2)" }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <strong>{idea.title}</strong>
        <span className="spacer" />
        <span className={`badge ${idea.ready ? "ok" : ""}`}>{idea.ready ? "Condiciones cumplidas" : "Aún no"}</span>
      </div>
      <p className="note" style={{ marginTop: 0 }}>{idea.summary}</p>
      <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
        {idea.checks.map((c) => (
          <li key={c.label} style={{ marginBottom: 6 }}>
            <span className={c.ok ? "pos" : "neg"}>{c.ok ? "✓" : "✗"}</span> {c.label}
            <div className="note">{c.why}</div>
          </li>
        ))}
      </ul>
      {idea.ready && (
        <button onClick={() => onUse(idea)}>
          Cargar en el ticket · stop {usd(idea.stop)} · objetivo {usd(idea.target)}
        </button>
      )}
    </div>
  );
}

export default function PracticaPage() {
  const [pair, setPair] = useState(PAIRS[0]);
  const price = usePrice(pair);
  const candles = usePoll<Candles>(`pair_candles?pair=${encodeURIComponent(pair)}&timeframe=5m&limit=300`, 30_000, BOT);
  const open = usePoll<Trade[]>("status", 5_000, BOT);
  const closed = usePoll<{ trades: Trade[] }>("trades?limit=500", 15_000, BOT);
  const balance = usePoll<Balance>("balance", 15_000, BOT);
  const { journal, save } = useJournal();

  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [risk, setRisk] = useState(0.005);
  const [setup, setSetup] = useState(SETUPS[0]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);

  const equity = balance.data?.total_bot ?? 0;
  const free = balance.data?.currencies.find((c) => c.currency === "USDT")?.free ?? 0;
  const stopN = parseFloat(stop.replace(",", "."));
  const targetN = target ? parseFloat(target.replace(",", ".")) : null;
  const size = price ? sizeOrder(equity, price, stopN, risk, free) : null;
  const rr = price && targetN && stopN < price ? (targetN - price) / (price - stopN) : null;
  const ideas = useMemo(() => detectIdeas(candles.data, price), [candles.data, price]);

  const all = useMemo(() => [...(closed.data?.trades ?? []), ...(open.data ?? [])], [closed.data, open.data]);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const today = all.filter((t) => t.open_timestamp >= dayStart.getTime());
  const pnlToday = (closed.data?.trades ?? [])
    .filter((t) => (t.close_timestamp ?? 0) >= dayStart.getTime())
    .reduce((s, t) => s + t.profit_abs, 0);
  const stats = computeStats(closed.data?.trades ?? [], journal);
  const edge = stats && stats.n >= MIN_TRADES_FOR_VERDICT
    ? bootstrapEdge((closed.data?.trades ?? []).map(rMultiple).filter((r): r is number => r != null))
    : null;

  const chartTrades: ChartTrade[] = all
    .filter((t) => t.pair === pair)
    .map((t) => ({ ...t, target: parseTag(t.enter_tag).target ?? null }));

  const problems: string[] = [];
  if (!price) problems.push("esperando precio");
  if (!(stopN > 0)) problems.push("define el stop");
  else if (price && stopN >= price) problems.push("el stop debe estar bajo el precio");
  if (targetN != null && price && targetN <= price) problems.push("el objetivo debe estar sobre el precio");
  if (reason.trim().length < 10) problems.push("escribe por qué entras (mín. 10 letras)");
  if (today.length >= RULES.maxTradesPerDay) problems.push(`ya hiciste ${RULES.maxTradesPerDay} operaciones hoy`);
  if (equity && -pnlToday / (equity - pnlToday) >= RULES.maxDailyLoss) problems.push("límite de pérdida diaria alcanzado");

  function applyIdea(i: Idea) {
    setStop(String(i.stop));
    setTarget(String(i.target));
    setSetup(i.setup);
    setReason(`Idea del sistema: ${i.title}. `);
    setMsg(null);
  }

  async function buy() {
    if (!size || problems.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = (await ftAction(BOT, "forceenter", {
        pair,
        side: "long",
        ordertype: "market",
        stakeamount: size.stake,
        entry_tag: buildTag(stopN, targetN, setup),
      })) as { trade_id?: number; status?: string };
      if (res.trade_id) {
        await save(res.trade_id, { setup, reason: reason.trim() });
        setMsg({ ok: true, text: `Compra simulada #${res.trade_id} registrada en el diario.` });
        setReason("");
        open.reload();
      } else {
        setMsg({ ok: false, text: `El bot rechazó la orden: ${res.status ?? "revisa las reglas de práctica"}` });
      }
    } catch {
      setMsg({
        ok: false,
        text: "El bot rechazó la orden por sus reglas de práctica (riesgo, tamaño, límite diario) o porque el precio se movió. Revisa el ticket y vuelve a intentar.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function close(t: Trade) {
    if (!window.confirm(`¿Cerrar la operación #${t.trade_id} a precio de mercado?`)) return;
    await ftAction(BOT, "forceexit", { tradeid: String(t.trade_id) });
    open.reload();
    closed.reload();
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Práctica manual · 5 min</h1>
        <select value={pair} onChange={(e) => setPair(e.target.value)}>
          {PAIRS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="badge">Precio {usd(price)}</span>
        <span className="badge">Patrimonio virtual {usd(equity)} USDT</span>
        <span className="spacer" />
        <button onClick={() => setShowGlossary((v) => !v)}>{showGlossary ? "Ocultar glosario" : "¿Qué significa cada término?"}</button>
      </div>
      {open.error && <p className="error">El bot de práctica no responde. Arráncalo con scripts\sim.ps1 -Bot manual.</p>}

      {showGlossary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Glosario</h2>
          <table>
            <tbody>
              {GLOSSARY.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{k}</td>
                  <td style={{ whiteSpace: "normal" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)", alignItems: "start" }}>
        <div className="grid">
          <div className="card">
            {candles.data ? (
              <CandleChart candles={candles.data} trades={chartTrades} showSignals={false} focusId={null} barSeconds={300} />
            ) : (
              <p className="muted">Cargando velas…</p>
            )}
            <p className="note">
              <span style={{ color: "#58a6ff" }}>EMA20</span> · <span style={{ color: "#d29922" }}>EMA50</span> · VWAP
              (punteada blanca). Las posiciones abiertas muestran su stop (rojo) y objetivo (verde).
            </p>
          </div>

          <div className="card">
            <h2>Ideas del sistema ahora · {pair}</h2>
            <p className="note" style={{ marginTop: 0 }}>
              El sistema revisa dos configuraciones clásicas y te explica cada condición. No son recomendaciones: son
              ejemplos para aprender a leer el gráfico. Tú decides si tomarlas; el diario medirá si tu criterio agrega valor.
            </p>
            <div className="grid">
              {ideas.map((i) => (
                <IdeaCard key={i.setup} idea={i} onUse={applyIdea} />
              ))}
              {!ideas.length && <p className="muted">Esperando suficientes velas…</p>}
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <h2>Ticket de compra (simulado)</h2>
            <label className="kpi-label">Stop (precio de salida si sale mal) *</label>
            <input className="input" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="ej. 76500" />
            <label className="kpi-label">Objetivo (opcional)</label>
            <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="ej. 79000" />
            <label className="kpi-label">Riesgo si toca el stop</label>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {RISKS.map((r) => (
                <button key={r} className={risk === r ? "active-btn" : ""} onClick={() => setRisk(r)}>
                  {pct(r, r < 0.01 ? 2 : 0)}
                </button>
              ))}
            </div>
            <label className="kpi-label">Tipo de entrada</label>
            <select value={setup} onChange={(e) => setSetup(e.target.value)} style={{ width: "100%", marginBottom: 10 }}>
              {SETUPS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="kpi-label">¿Por qué entras? *</label>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Qué viste en el gráfico" />

            <table style={{ margin: "10px 0" }}>
              <tbody>
                <tr><td>Importe a comprar</td><td className="num">{size ? `${usd(size.stake)} USDT` : "—"}</td></tr>
                <tr><td>Pérdida si toca el stop</td><td className="num neg">{size ? `−${usd(size.risk)} (${pct(size.riskPct)})` : "—"}</td></tr>
                <tr><td>Ganancia si llega al objetivo</td><td className="num pos">{size && rr ? `+${usd(size.risk * rr)} (${rr.toFixed(1)}R)` : "—"}</td></tr>
              </tbody>
            </table>
            {size?.capped && <p className="note">Importe limitado al 50% del patrimonio o al efectivo libre.</p>}
            {rr != null && rr < 1.5 && <p className="note" style={{ color: "var(--warn)" }}>Ojo: ganarías menos de 1,5 veces lo que arriesgas.</p>}
            {problems.length > 0 && <p className="note">Falta: {problems.join(" · ")}</p>}
            <button disabled={busy || !size || problems.length > 0} onClick={buy} style={{ width: "100%" }}>
              Comprar {pair.split("/")[0]} (simulado)
            </button>
            {msg && <p className={msg.ok ? "note pos" : "error"}>{msg.text}</p>}
          </div>

          <div className="card">
            <h2>Sesión de hoy (UTC)</h2>
            <table>
              <tbody>
                <tr><td>Operaciones</td><td className="num">{today.length} / {RULES.maxTradesPerDay}</td></tr>
                <tr><td>Resultado cerrado</td><td className={`num ${signClass(pnlToday)}`}>{usd(pnlToday)} USDT</td></tr>
                <tr><td>Límite de pérdida diaria</td><td className="num">{pct(RULES.maxDailyLoss, 0)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Posiciones abiertas</h2>
            {!open.data?.length && <p className="muted">Ninguna.</p>}
            {open.data?.map((t) => {
              const plan = parseTag(t.enter_tag);
              const r = rMultiple(t);
              return (
                <div key={t.trade_id} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                  <div className="row">
                    <strong>#{t.trade_id} {t.pair}</strong>
                    <span className={`badge ${signClass(t.profit_abs)}`}>{usd(t.profit_abs)} · {r != null ? `${r.toFixed(2)}R` : "—"}</span>
                    <span className="spacer" />
                    <button className="danger" onClick={() => close(t)}>Cerrar</button>
                  </div>
                  <div className="note">
                    Entrada {usd(t.open_rate)} · actual {usd(t.current_rate)} · stop {usd(plan.stop)} · objetivo {usd(plan.target)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>¿Tengo habilidad? · tus estadísticas</h2>
        {!stats && <p className="muted">Aún no cierras operaciones. Las estadísticas aparecen desde la primera.</p>}
        {stats && (
          <>
            <div className="grid kpis" style={{ marginBottom: 12 }}>
              <div className="card"><div className="kpi-label">Operaciones cerradas</div><div className="kpi-value">{stats.n}</div></div>
              <div className="card"><div className="kpi-label">Acierto</div><div className="kpi-value">{pct(stats.winRate, 0)}</div></div>
              <div className="card"><div className="kpi-label">Ganancia / pérdida media</div><div className="kpi-value">{stats.avgWinR.toFixed(2)}R / {stats.avgLossR.toFixed(2)}R</div></div>
              <div className="card"><div className="kpi-label">Expectativa por operación</div><div className={`kpi-value ${signClass(stats.expectancyR)}`}>{stats.expectancyR.toFixed(2)}R</div></div>
              <div className="card"><div className="kpi-label">Resultado neto</div><div className={`kpi-value ${signClass(stats.netUsd)}`}>{usd(stats.netUsd)}</div><div className="kpi-sub">comisiones {usd(stats.feesUsd)}</div></div>
              <div className="card"><div className="kpi-label">Peor racha de pérdidas</div><div className="kpi-value">{stats.worstStreak}</div></div>
            </div>
            <p>
              {edge ? (
                <>
                  <span className={`badge ${edge.probNoEdge < 0.1 ? "ok" : "bad"}`}>
                    {edge.probNoEdge < 0.1 ? "Hay señales de habilidad" : "Aún no se distingue de la suerte"}
                  </span>{" "}
                  Probabilidad de que tu expectativa real sea ≤ 0: {pct(edge.probNoEdge, 1)} · rango probable{" "}
                  {edge.p5.toFixed(2)}R a {edge.p95.toFixed(2)}R.
                </>
              ) : (
                <span className="note">
                  Con menos de {MIN_TRADES_FOR_VERDICT} operaciones cualquier resultado puede ser suerte. Llevas {stats.n}.
                </span>
              )}
            </p>
            <h2 style={{ marginTop: 12 }}>Por tipo de entrada</h2>
            <table>
              <thead><tr><th>Tipo</th><th className="num">Ops.</th><th className="num">Expectativa</th><th className="num">Neto USDT</th></tr></thead>
              <tbody>
                {stats.bySetup.map((s) => (
                  <tr key={s.setup}>
                    <td>{s.setup}</td>
                    <td className="num">{s.n}</td>
                    <td className={`num ${signClass(s.expectancyR)}`}>{s.expectancyR.toFixed(2)}R</td>
                    <td className={`num ${signClass(s.netUsd)}`}>{usd(s.netUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card table-wrap" style={{ marginTop: 16 }}>
        <h2>Diario</h2>
        <table>
          <thead>
            <tr><th>#</th><th>Par</th><th>Apertura</th><th>Tipo</th><th>Por qué entré</th><th className="num">Resultado</th><th>Cierre</th><th>Qué aprendí</th></tr>
          </thead>
          <tbody>
            {[...(closed.data?.trades ?? [])].reverse().map((t) => {
              const j = journal[t.trade_id];
              const r = rMultiple(t);
              return (
                <tr key={t.trade_id}>
                  <td>{t.trade_id}</td>
                  <td>{t.pair}</td>
                  <td>{fmtTime(t.open_timestamp)}</td>
                  <td>{j?.setup ?? parseTag(t.enter_tag).setup ?? "—"}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: 260 }}>{j?.reason ?? "—"}</td>
                  <td className={`num ${signClass(t.profit_abs)}`}>{usd(t.profit_abs)} {r != null ? `(${r.toFixed(2)}R)` : ""}</td>
                  <td>{exitLabel(t.exit_reason)}</td>
                  <td>
                    <input
                      className="input"
                      defaultValue={j?.review ?? ""}
                      placeholder="Revisión…"
                      onBlur={(e) => e.target.value !== (j?.review ?? "") && save(t.trade_id, { review: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
