import { NextRequest, NextResponse } from "next/server";

// Precio actual público de Binance (sin claves) para el ticket de práctica.
const ALLOWED = new Set(["BTC/USDT", "ETH/USDT"]);

export async function GET(req: NextRequest) {
  const pair = req.nextUrl.searchParams.get("pair") ?? "";
  if (!ALLOWED.has(pair)) return NextResponse.json({ error: "par no permitido" }, { status: 400 });
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.replace("/", "")}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { price?: string };
    return NextResponse.json({ pair, price: Number(data.price), at: Date.now() });
  } catch (err) {
    return NextResponse.json({ error: "sin precio", detail: String(err) }, { status: 502 });
  }
}
