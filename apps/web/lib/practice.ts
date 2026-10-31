// Lógica del modo práctica manual: plan de la orden, tamaño por riesgo y estadísticas.
// Las reglas duras viven en el bot (freqtrade/user_data/strategies/lib/manual.py);
// aquí se repiten para avisar antes de enviar.
import type { Trade } from "@/lib/ft";

export const RULES = {
  maxRiskPerTrade: 0.02,
  maxTradesPerDay: 6,
  maxDailyLoss: 0.03,
  maxPositionFraction: 0.5,
};

export const SETUPS = ["ruptura", "rebote en soporte", "pullback a EMA", "VWAP", "tendencia", "otro"];

export type JournalEntry = {
  setup: string;
  reason: string;
  review?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Plan = { stop?: number; target?: number; setup?: string };

export function buildTag(stop: number, target: number | null, setup: string): string {
  const parts = ["m", `s=${stop}`];
  if (target) parts.push(`t=${target}`);
  parts.push(`k=${setup.replace(/[;=]/g, " ").slice(0, 30)}`);
  return parts.join(";");
}

export function parseTag(tag: string | null | undefined): Plan {
  const out: Plan = {};
  if (!tag?.startsWith("m;")) return out;
  for (const part of tag.split(";").slice(1)) {
    const [k, v] = part.split("=");
    if (k === "s" && Number.isFinite(+v)) out.stop = +v;
    if (k === "t" && Number.isFinite(+v)) out.target = +v;
    if (k === "k" && v) out.setup = v;
  }
  return out;
}

/** Importe a invertir para arriesgar `riskFraction` del patrimonio hasta el stop. */
export function sizeOrder(equity: number, price: number, stop: number, riskFraction: number, freeCash: number) {
  if (!(price > 0) || !(stop > 0) || stop >= price || !(equity > 0)) return null;
  const riskAmount = equity * riskFraction;
  const qty = riskAmount / (price - stop);
  // margen del 2% bajo los topes: el precio de ejecución puede moverse respecto al mostrado
  const stake = Math.min(qty * price * 0.98, equity * RULES.maxPositionFraction * 0.98, freeCash * 0.98);
  const finalQty = stake / price;
  return {
    stake: Math.floor(stake * 100) / 100,
    qty: finalQty,
    risk: finalQty * (price - stop),
    riskPct: (finalQty * (price - stop)) / equity,
    capped: stake < qty * price,
  };
}

/** Resultado en múltiplos del riesgo inicial (R). */
export function rMultiple(t: Trade): number | null {
  const stop = parseTag(t.enter_tag).stop;
  const exit = t.close_rate ?? t.current_rate;
  if (!stop || exit == null || t.open_rate <= stop) return null;
  return (exit - t.open_rate) / (t.open_rate - stop);
}

export type Stats = {
  n: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  expectancyR: number;
  totalR: number;
  netUsd: number;
  feesUsd: number;
  worstStreak: number;
  bySetup: { setup: string; n: number; expectancyR: number; netUsd: number }[];
};

export function computeStats(trades: Trade[], journal: Record<string, JournalEntry>): Stats | null {
  const closed = trades.filter((t) => !t.is_open && rMultiple(t) != null);
  if (!closed.length) return null;
  const rs = closed.map((t) => rMultiple(t) as number);
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r <= 0);
  const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  let streak = 0;
  let worst = 0;
  for (const t of [...closed].sort((a, b) => (a.close_timestamp ?? 0) - (b.close_timestamp ?? 0))) {
    streak = t.profit_abs <= 0 ? streak + 1 : 0;
    worst = Math.max(worst, streak);
  }
  const groups = new Map<string, Trade[]>();
  for (const t of closed) {
    const setup = journal[t.trade_id]?.setup || parseTag(t.enter_tag).setup || "sin setup";
    groups.set(setup, [...(groups.get(setup) ?? []), t]);
  }
  return {
    n: closed.length,
    winRate: wins.length / rs.length,
    avgWinR: mean(wins),
    avgLossR: mean(losses),
    expectancyR: mean(rs),
    totalR: rs.reduce((s, x) => s + x, 0),
    netUsd: closed.reduce((s, t) => s + t.profit_abs, 0),
    feesUsd: closed.reduce((s, t) => s + t.stake_amount * t.fee_open + (t.close_rate ?? 0) * t.amount * t.fee_close, 0),
    worstStreak: worst,
    bySetup: [...groups.entries()].map(([setup, ts]) => ({
      setup,
      n: ts.length,
      expectancyR: mean(ts.map((t) => rMultiple(t) as number)),
      netUsd: ts.reduce((s, t) => s + t.profit_abs, 0),
    })),
  };
}

/** Bootstrap: probabilidad de que la expectativa real sea ≤ 0 dados tus resultados en R. */
export function bootstrapEdge(rs: number[], sims = 5000, seed = 42) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const means: number[] = [];
  for (let i = 0; i < sims; i++) {
    let sum = 0;
    for (let j = 0; j < rs.length; j++) sum += rs[Math.floor(rand() * rs.length)];
    means.push(sum / rs.length);
  }
  means.sort((a, b) => a - b);
  return {
    probNoEdge: means.filter((m) => m <= 0).length / sims,
    p5: means[Math.floor(sims * 0.05)],
    p95: means[Math.floor(sims * 0.95)],
  };
}
