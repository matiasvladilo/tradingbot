"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  IChartApi,
  LineSeries,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import type { Candles, ChartTrade } from "@/lib/ft";

const HOUR = 3600;
const WIN = "#3fb950";
const LOSS = "#f85149";
const ENTRY = "#58a6ff";

function column(c: Candles, name: string): (number | null)[] {
  const i = c.columns.indexOf(name);
  if (i < 0) return c.data.map(() => null);
  return c.data.map((row) => {
    const v = row[i];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}

function line(times: UTCTimestamp[], values: (number | null)[]) {
  return times.flatMap((time, i) => (values[i] == null ? [] : [{ time, value: values[i] as number }]));
}

const toBar = (ms: number) => (Math.floor(ms / 1000 / HOUR) * HOUR) as UTCTimestamp;
const sign = (v: number) => (v >= 0 ? "+" : "");

type Props = {
  candles: Candles;
  trades: ChartTrade[];
  showSignals: boolean;
  focusId: number | null;
};

export default function CandleChart({ candles, trades, showSignals, focusId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#161b22" },
        textColor: "#8b96a5",
        panes: { separatorColor: "#2a3240" },
      },
      grid: { vertLines: { color: "#1f2632" }, horzLines: { color: "#1f2632" } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#2a3240" },
      rightPriceScale: { borderColor: "#2a3240" },
    });
    chartRef.current = chart;

    const times = column(candles, "__date_ts").map((ms) => Math.floor((ms ?? 0) / 1000) as UTCTimestamp);
    const [open, high, low, close, volume] = ["open", "high", "low", "close", "volume"].map((n) =>
      column(candles, n),
    );
    const first = times[0] ?? 0;
    const last = times[times.length - 1] ?? 0;

    const price = chart.addSeries(CandlestickSeries, {
      upColor: WIN,
      downColor: LOSS,
      wickUpColor: WIN,
      wickDownColor: LOSS,
      borderVisible: false,
    });
    price.setData(
      times.map((time, i) => ({ time, open: open[i]!, high: high[i]!, low: low[i]!, close: close[i]! })),
    );

    const overlay = (name: string, title: string, color: string, style = LineStyle.Solid, width: 1 | 2 = 1) => {
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title,
      });
      s.setData(line(times, column(candles, name)));
    };
    overlay("ema50_4h", "EMA50 4h", "#58a6ff66", LineStyle.Solid, 2);
    overlay("ema200_4h", "EMA200 4h", "#d2992266", LineStyle.Solid, 2);
    overlay("breakout_level", "ruptura", "#8b96a555", LineStyle.Dotted);

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: "volumen" }, 1);
    vol.setData(
      times.map((time, i) => ({
        time,
        value: volume[i] ?? 0,
        color: (close[i] ?? 0) >= (open[i] ?? 0) ? "#3fb95066" : "#f8514966",
      })),
    );
    const atr = chart.addSeries(LineSeries, { color: "#a371f7", lineWidth: 1, title: "ATR 14" }, 2);
    atr.setData(line(times, column(candles, "atr")));

    const panes = chart.panes();
    panes[0]?.setHeight(380);
    panes[1]?.setHeight(60);
    panes[2]?.setHeight(60);

    const markers: SeriesMarker<Time>[] = [];
    if (showSignals) {
      const enter = column(candles, "enter_long");
      times.forEach((time, i) => {
        if (enter[i] === 1) markers.push({ time, position: "belowBar", shape: "circle", color: "#a371f777", size: 0.5 });
      });
    }

    // Cada operación: flecha de compra, flecha de venta y una línea que une entrada y salida
    for (const t of trades) {
      const entry = toBar(t.open_timestamp);
      const exit = t.close_timestamp ? toBar(t.close_timestamp) : last;
      if (exit < first || entry > last) continue;
      const exitPrice = t.close_rate ?? t.current_rate ?? t.open_rate;
      const color = t.is_open ? ENTRY : t.profit_abs >= 0 ? WIN : LOSS;

      if (entry >= first)
        markers.push({ time: entry, position: "belowBar", shape: "arrowUp", color: ENTRY, text: `C${t.trade_id}` });
      if (!t.is_open && exit <= last)
        markers.push({
          time: exit,
          position: "aboveBar",
          shape: "arrowDown",
          color,
          text: `V${t.trade_id} ${sign(t.profit_ratio)}${(t.profit_ratio * 100).toFixed(1)}%`,
        });

      if (exit > entry) {
        const seg = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: t.is_open ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        seg.setData([
          { time: entry, value: t.open_rate },
          { time: exit, value: exitPrice },
        ]);
      }

      if (t.is_open) {
        price.createPriceLine({ price: t.open_rate, color: ENTRY, lineStyle: LineStyle.Dashed, lineWidth: 1, title: `Entrada #${t.trade_id}` });
        if (t.stop_loss_abs)
          price.createPriceLine({ price: t.stop_loss_abs, color: LOSS, lineStyle: LineStyle.Dashed, lineWidth: 1, title: `Stop #${t.trade_id}` });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(price, markers);

    chart.timeScale().fitContent();
    return () => {
      chartRef.current = null;
      chart.remove();
    };
  }, [candles, trades, showSignals]);

  useEffect(() => {
    const t = trades.find((x) => x.trade_id === focusId);
    const chart = chartRef.current;
    if (!t || !chart) return;
    const from = toBar(t.open_timestamp) - 24 * HOUR;
    const to = (t.close_timestamp ? toBar(t.close_timestamp) : toBar(Date.now())) + 24 * HOUR;
    try {
      chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
    } catch {
      // la operación cae fuera de las velas cargadas
    }
  }, [focusId, trades]);

  return <div ref={ref} className="chart-box" />;
}
