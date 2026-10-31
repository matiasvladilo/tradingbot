// Simulaciones disponibles. El servidor resuelve la URL de cada una (lib/ft-server.ts).
export type Bot = {
  id: string;
  label: string;
  strategy: string;
  timeframe: string;
  barSeconds: number;
  candleLimit: number;
  factors: string;
  limits: [string, string][];
};

export const BOTS: Bot[] = [
  {
    id: "daily",
    label: "TrendDaily · 1d",
    strategy: "TrendDaily",
    timeframe: "1d",
    barSeconds: 86_400,
    candleLimit: 500,
    factors: "Factores: SMA200 diaria (tendencia), máximo de 20 días (entrada), mínimo de 10 días (salida), stop 2×ATR(20).",
    limits: [
      ["Riesgo por operación", "0,25% del patrimonio hasta el stop"],
      ["Máximo por activo", "20% del patrimonio"],
      ["Exposición total", "40% (2 posiciones × 20%)"],
      ["Stop", "2×ATR(20) fijo desde la entrada"],
      ["Salida", "cierre bajo el mínimo de 10 días o bajo la SMA200"],
      ["CooldownPeriod", "1 día tras cerrar una operación"],
    ],
  },
  {
    id: "dual",
    label: "DualMomentum · 1d",
    strategy: "DualMomentum",
    timeframe: "1d",
    barSeconds: 86_400,
    candleLimit: 500,
    factors:
      "Factores: retorno de 30 días del par y del otro par (mom / other_mom). Mantiene el más fuerte solo si su retorno es positivo; stop 3×ATR(20).",
    limits: [
      ["Riesgo por operación", "0,25% del patrimonio hasta el stop"],
      ["Máximo por activo", "20% del patrimonio"],
      ["Exposición total", "40% (2 posiciones × 20%)"],
      ["Stop", "3×ATR(20) fijo desde la entrada"],
      ["Salida", "retorno 30 d ≤ 0 o el otro par lo supera"],
      ["CooldownPeriod", "1 día tras cerrar una operación"],
    ],
  },
  {
    id: "breakout",
    label: "BreakoutTrend v1 · 1h (descartada)",
    strategy: "BreakoutTrend",
    timeframe: "1h",
    barSeconds: 3_600,
    candleLimit: 1000,
    factors: "Factores: EMA50/EMA200 de 4h (tendencia), nivel de ruptura 20 velas, stop 2×ATR, volumen.",
    limits: [
      ["Riesgo por operación", "0,25% del patrimonio hasta el stop"],
      ["Máximo por activo", "20% del patrimonio"],
      ["Exposición total", "40% (2 posiciones × 20%)"],
      ["Pérdida diaria (UTC)", "1% → se bloquean nuevas entradas"],
      ["StoplossGuard", "3 stops en 24 h → pausa 12 h"],
      ["MaxDrawdown", "5% en 7 días → pausa 24 h"],
      ["Plazo máximo", "72 h por posición"],
    ],
  },
  {
    id: "manual",
    label: "Práctica manual · 5m",
    strategy: "ManualPractice",
    timeframe: "5m",
    barSeconds: 300,
    candleLimit: 300,
    factors: "Factores: EMA20/EMA50 (tendencia corta), VWAP del día, volumen y ATR. Las entradas las decides tú en la página Práctica.",
    limits: [
      ["Riesgo por operación", "máximo 2% del patrimonio hasta el stop"],
      ["Tamaño de posición", "máximo 50% del patrimonio"],
      ["Operaciones por día", "máximo 6"],
      ["Pérdida diaria (UTC)", "3% → se acaba la sesión"],
      ["Stop", "obligatorio, lo defines antes de entrar"],
    ],
  },
];

export const DEFAULT_BOT = BOTS[0].id;
export const botById = (id: string) => BOTS.find((b) => b.id === id) ?? BOTS[0];
