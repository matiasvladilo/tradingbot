"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import type { Candles, Trade } from "@/lib/ft";

const HOUR = 3600;

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

export default function CandleChart({ candles, trades }: { candles: Candles; trades: Trade[] }) {
  const ref = useRef<HTMLDivElement>(null);

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

    const times = column(candles, "__date_ts").map((ms) => Math.floor((ms ?? 0) / 1000) as UTCTimestamp);
    const [open, high, low, close, volume] = ["open", "high", "low", "close", "volume"].map((n) =>
      column(candles, n),
    );

    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#3fb950",
      downColor: "#f85149",
      wickUpColor: "#3fb950",
      wickDownColor: "#f85149",
      borderVisible: false,
    });
    price.setData(
      times.map((time, i) => ({ time, open: open[i]!, high: high[i]!, low: low[i]!, close: close[i]! })),
    );

    const overlay = (name: string, color: string, style = LineStyle.Solid, width: 1 | 2 = 1) => {
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: name,
      });
      s.setData(line(times, column(candles, name)));
    };
    overlay("ema50_4h", "#58a6ff", LineStyle.Solid, 2);
    overlay("ema200_4h", "#d29922", LineStyle.Solid, 2);
    overlay("breakout_level", "#8b96a5", LineStyle.Dotted);
    overlay("stop_price", "#f8514988", LineStyle.Dashed);

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: "volumen" }, 1);
    vol.setData(
      times.map((time, i) => ({
        time,
        value: volume[i] ?? 0,
        color: (close[i] ?? 0) >= (open[i] ?? 0) ? "#3fb95066" : "#f8514966",
      })),
    );
    const volMa = chart.addSeries(
      LineSeries,
      { color: "#e6edf3", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "vol media" },
      1,
    );
    volMa.setData(line(times, column(candles, "volume_ma")));

    const atr = chart.addSeries(LineSeries, { color: "#a371f7", lineWidth: 1, title: "ATR 14" }, 2);
    atr.setData(line(times, column(candles, "atr")));

    const panes = chart.panes();
    panes[0]?.setHeight(340);
    panes[1]?.setHeight(80);
    panes[2]?.setHeight(80);

    const first = times[0] ?? 0;
    const enter = column(candles, "enter_long");
    const markers: SeriesMarker<Time>[] = times.flatMap((time, i) =>
      enter[i] === 1
        ? [{ time, position: "belowBar" as const, shape: "arrowUp" as const, color: "#a371f7", text: "señal" }]
        : [],
    );
    for (const t of trades) {
      const entry = toBar(t.open_timestamp);
      if (entry >= first)
        markers.push({ time: entry, position: "belowBar", shape: "circle", color: "#58a6ff", text: `#${t.trade_id}` });
      if (t.close_timestamp && toBar(t.close_timestamp) >= first)
        markers.push({
          time: toBar(t.close_timestamp),
          position: "aboveBar",
          shape: "arrowDown",
          color: t.profit_abs >= 0 ? "#3fb950" : "#f85149",
          text: t.exit_reason ?? "salida",
        });
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(price, markers);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, trades]);

  return <div ref={ref} className="chart-box" />;
}
