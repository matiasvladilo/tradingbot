"use client";

import { useCallback, useEffect, useState } from "react";
import { useBot } from "@/lib/bot-context";

export type Trade = {
  trade_id: number;
  pair: string;
  is_open: boolean;
  open_date: string;
  close_date: string | null;
  open_timestamp: number;
  close_timestamp: number | null;
  open_rate: number;
  close_rate: number | null;
  current_rate?: number;
  amount: number;
  stake_amount: number;
  profit_abs: number;
  profit_ratio: number;
  stop_loss_abs: number | null;
  exit_reason: string | null;
  enter_tag: string | null;
  fee_open: number;
  fee_close: number;
};

export type Profit = {
  profit_all_coin: number;
  profit_all_ratio: number;
  profit_closed_coin: number;
  trade_count: number;
  closed_trade_count: number;
  winning_trades: number;
  losing_trades: number;
  winrate: number;
  profit_factor: number | null;
  max_drawdown: number;
  max_drawdown_abs: number;
};

export type Balance = {
  total: number;
  total_bot: number;
  starting_capital: number;
  stake: string;
  currencies: { currency: string; free: number; used: number; balance: number; est_stake: number }[];
};

export type ShowConfig = {
  state: string;
  dry_run: boolean;
  strategy: string;
  timeframe: string;
  max_open_trades: number;
  stake_currency: string;
  exchange: string;
};

export type Candles = {
  pair: string;
  timeframe: string;
  columns: string[];
  data: (number | string | null)[][];
};

export type Daily = {
  data: { date: string; abs_profit: number; starting_balance: number; rel_profit: number; trade_count: number }[];
};

export type Locks = {
  lock_count: number;
  locks: { pair: string; lock_end_time: string; reason: string; active: boolean }[];
};

/** Operación mínima para dibujar en el gráfico; sirve para paper en vivo y para backtests. */
export type ChartTrade = {
  trade_id: number;
  pair: string;
  is_open: boolean;
  open_timestamp: number;
  close_timestamp: number | null;
  open_rate: number;
  close_rate: number | null;
  current_rate?: number;
  stake_amount: number;
  profit_abs: number;
  profit_ratio: number;
  stop_loss_abs?: number | null;
  target?: number | null;
  exit_reason: string | null;
};

const EXIT_REASONS: Record<string, string> = {
  trailing_stop_loss: "stop móvil",
  stop_loss: "stop",
  stoploss_on_exchange: "stop",
  max_hold: "plazo máximo",
  trend_invalidated: "tendencia perdida",
  force_exit: "cierre manual",
  exit_signal: "señal de salida",
  roi: "objetivo",
  target: "objetivo",
};

export const exitLabel = (reason: string | null | undefined) =>
  reason ? (EXIT_REASONS[reason] ?? reason) : "abierta";

export function duration(fromMs: number, toMs: number) {
  const h = Math.round((toMs - fromMs) / 3_600_000);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`;
}

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

export async function ftGet<T>(bot: string, path: string): Promise<T> {
  const res = await fetch(`/api/ft/${bot}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export async function ftAction(bot: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`/api/ft/${bot}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Consulta una ruta de la API del bot seleccionado (o de `botId`) y la refresca cada `intervalMs`. */
export function usePoll<T>(path: string | null, intervalMs = 10_000, botId?: string) {
  const selected = useBot().bot;
  const bot = botId ? { id: botId } : selected;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      setData(await ftGet<T>(bot.id, path));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [bot.id, path]);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [bot.id]);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { data, error, reload: load };
}

export const usd = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : v.toLocaleString("es-CL", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : `${(v * 100).toLocaleString("es-CL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const signClass = (v: number | null | undefined) => (v == null || v === 0 ? "" : v > 0 ? "pos" : "neg");
