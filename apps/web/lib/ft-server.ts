import "server-only";

// Cliente de la API REST de Freqtrade. Solo corre en el servidor: las credenciales
// nunca llegan al navegador.
const BOT_URLS: Record<string, string> = {
  breakout: process.env.FT_API_URL ?? "http://127.0.0.1:8080",
  daily: process.env.FT_API_URL_DAILY ?? "http://127.0.0.1:8081",
  dual: process.env.FT_API_URL_DUAL ?? "http://127.0.0.1:8082",
  manual: process.env.FT_API_URL_MANUAL ?? "http://127.0.0.1:8083",
};

// Solo el bot de práctica manual (dry-run) acepta órdenes abiertas desde el panel
export const MANUAL_BOT = "manual";

export const isBot = (id: string) => id in BOT_URLS;

function authHeader(): string {
  const user = process.env.FT_API_USERNAME ?? "";
  const pass = process.env.FT_API_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export const READ_PATHS = new Set([
  "ping",
  "show_config",
  "status",
  "trades",
  "profit",
  "balance",
  "daily",
  "performance",
  "pair_candles",
  "count",
  "locks",
  "whitelist",
  "health",
]);

// Acciones permitidas desde la UI. forceenter solo para MANUAL_BOT (ver route.ts).
export const ACTION_PATHS = new Set(["stopentry", "start", "forceexit", "forceenter"]);

export async function ftFetch(bot: string, path: string, init: RequestInit = {}, search = ""): Promise<Response> {
  return fetch(`${BOT_URLS[bot]}/api/v1/${path}${search}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}
