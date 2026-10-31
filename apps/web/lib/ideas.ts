// Detector de ideas para principiantes sobre velas de 5 minutos del bot de práctica.
// No es una recomendación: son dos configuraciones de manual, explicadas paso a paso.
import type { Candles } from "@/lib/ft";

export type Check = { ok: boolean; label: string; why: string };
export type Idea = {
  setup: string;
  title: string;
  summary: string;
  checks: Check[];
  ready: boolean;
  entry: number;
  stop: number;
  target: number;
};

function lastRows(c: Candles, n: number) {
  const idx = (name: string) => c.columns.indexOf(name);
  const cols = ["close", "high", "low", "volume", "ema20", "ema50", "vwap", "atr", "volume_ma"];
  return c.data.slice(-n).map((row) =>
    Object.fromEntries(cols.map((k) => [k, typeof row[idx(k)] === "number" ? (row[idx(k)] as number) : NaN])),
  ) as Record<string, number>[];
}

const round = (v: number) => Math.round(v * 100) / 100;

export function detectIdeas(c: Candles | null, price: number | null): Idea[] {
  if (!c || c.data.length < 30) return [];
  const rows = lastRows(c, 13);
  const last = rows[rows.length - 1];
  const prev = rows.slice(0, -1);
  const entry = price ?? last.close;
  if (![last.ema20, last.ema50, last.vwap, last.atr].every(Number.isFinite)) return [];

  const trendUp: Check = {
    ok: last.ema20 > last.ema50,
    label: "Tendencia corta al alza (EMA20 > EMA50)",
    why:
      last.ema20 > last.ema50
        ? "El promedio rápido está sobre el lento: en las últimas horas dominan los compradores."
        : "El promedio rápido está bajo el lento: en las últimas horas dominan los vendedores. Comprar aquí es ir contra la corriente.",
  };
  const aboveVwap: Check = {
    ok: last.close > last.vwap,
    label: "Precio sobre el VWAP del día",
    why:
      last.close > last.vwap
        ? "Quien compró hoy en promedio va ganando: suele haber apoyo comprador."
        : "Bajo el VWAP, el comprador promedio de hoy va perdiendo: tienden a vender en cada subida.",
  };

  // Idea 1: retroceso a la EMA20 dentro de una tendencia
  const touched = prev.slice(-3).some((r) => r.low <= r.ema20 * 1.001) || last.low <= last.ema20 * 1.001;
  const pullbackStop = Math.min(...rows.slice(-3).map((r) => r.low)) - 0.2 * last.atr;
  const pullback: Idea = {
    setup: "pullback a EMA",
    title: "Retroceso a la EMA20 en tendencia",
    summary:
      "En una subida, el precio suele 'respirar' y volver a su promedio de 20 velas antes de seguir. La idea es comprar ese retroceso con un stop justo bajo el mínimo reciente.",
    checks: [
      trendUp,
      aboveVwap,
      {
        ok: touched && last.close > last.ema20,
        label: "Tocó la EMA20 y cerró sobre ella",
        why:
          touched && last.close > last.ema20
            ? "En las últimas velas el precio bajó hasta el promedio y rebotó: señal de que los compradores lo defendieron."
            : "Todavía no hay un retroceso al promedio con rebote. Entrar ahora sería comprar lejos del soporte.",
      },
    ],
    ready: false,
    entry,
    stop: round(pullbackStop),
    target: round(entry + 2 * (entry - pullbackStop)),
  };
  pullback.ready = pullback.checks.every((x) => x.ok) && pullbackStop < entry;

  // Idea 2: ruptura del máximo de la última hora con volumen
  const hourHigh = Math.max(...prev.map((r) => r.high));
  const breakoutStop = entry - 1.5 * last.atr;
  const breakout: Idea = {
    setup: "ruptura",
    title: "Ruptura del máximo de la última hora con volumen",
    summary:
      "Cuando el precio supera el techo reciente con mucho volumen, suele ser porque entraron compradores con fuerza. La idea es subirse a ese impulso con un stop de 1,5×ATR.",
    checks: [
      aboveVwap,
      {
        ok: last.close > hourHigh,
        label: `Cerró sobre el máximo de la última hora (${round(hourHigh)})`,
        why:
          last.close > hourHigh
            ? "Superó el techo de la última hora: los vendedores de esa zona ya no lo frenaron."
            : "Aún no supera el techo de la última hora. Sin ruptura no hay idea.",
      },
      {
        ok: last.volume > 1.5 * last.volume_ma,
        label: "Volumen 1,5× sobre lo normal",
        why:
          last.volume > 1.5 * last.volume_ma
            ? "Hubo mucho más volumen que el promedio: el movimiento tiene participación real."
            : "Volumen normal o bajo: las rupturas sin volumen suelen fallar y devolverse.",
      },
    ],
    ready: false,
    entry,
    stop: round(breakoutStop),
    target: round(entry + 2 * (entry - breakoutStop)),
  };
  breakout.ready = breakout.checks.every((x) => x.ok);

  return [pullback, breakout];
}

export const GLOSSARY: [string, string][] = [
  ["Stop (stop loss)", "Precio en que la operación se cierra sola para limitar la pérdida. Se decide ANTES de entrar, nunca después."],
  ["Objetivo", "Precio en que se toma la ganancia. Aquí se propone a 2R: ganar el doble de lo que se arriesga."],
  ["R", "Lo que arriesgas en una operación (de la entrada al stop). Ganar 2R = ganar el doble de lo arriesgado; perder 1R = perder lo planeado."],
  ["Riesgo %", "Cuánto de tu capital pierdes si toca el stop. Con 0,5% necesitas 40 pérdidas seguidas para perder el 20%."],
  ["EMA20 / EMA50", "Promedios del precio de las últimas 20 y 50 velas (de 5 min). Si la de 20 está arriba, la tendencia corta es alcista."],
  ["VWAP", "Precio promedio del día ponderado por volumen. Sobre el VWAP, quien compró hoy va ganando; bajo él, va perdiendo."],
  ["ATR", "Cuánto se mueve el precio en una vela normal. Sirve para poner stops que no salten por ruido."],
  ["Volumen", "Cuánto se negoció. Los movimientos con volumen alto son más confiables."],
  ["Expectativa", "Lo que ganas en promedio por operación, en R. Si es positiva tras muchas operaciones, tu método tiene ventaja."],
];
