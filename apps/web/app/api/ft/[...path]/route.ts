import { NextRequest, NextResponse } from "next/server";
import { ACTION_PATHS, READ_PATHS, ftFetch, isBot } from "@/lib/ft-server";

// Rutas: /api/ft/<bot>/<ruta de Freqtrade>
type Ctx = { params: Promise<{ path: string[] }> };

async function resolve(ctx: Ctx) {
  const [bot, ...rest] = (await ctx.params).path;
  return { bot, path: rest.join("/") };
}

async function proxy(req: NextRequest, bot: string, path: string, init: RequestInit) {
  try {
    const res = await ftFetch(bot, path, init, req.nextUrl.search);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Freqtrade no responde", detail: String(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { bot, path } = await resolve(ctx);
  if (!isBot(bot) || !READ_PATHS.has(path)) return NextResponse.json({ error: "ruta no permitida" }, { status: 404 });
  return proxy(req, bot, path, { method: "GET" });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { bot, path } = await resolve(ctx);
  if (!isBot(bot) || !ACTION_PATHS.has(path)) return NextResponse.json({ error: "acción no permitida" }, { status: 404 });
  const body = await req.text();
  return proxy(req, bot, path, { method: "POST", body: body || undefined });
}
