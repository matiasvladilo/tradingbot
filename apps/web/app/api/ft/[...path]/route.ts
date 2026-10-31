import { NextRequest, NextResponse } from "next/server";
import { ACTION_PATHS, READ_PATHS, ftFetch } from "@/lib/ft-server";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, path: string, init: RequestInit) {
  try {
    const res = await ftFetch(path, init, req.nextUrl.search);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Freqtrade no responde", detail: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  if (!READ_PATHS.has(path)) return NextResponse.json({ error: "ruta no permitida" }, { status: 404 });
  return proxy(req, path, { method: "GET" });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  if (!ACTION_PATHS.has(path)) return NextResponse.json({ error: "acción no permitida" }, { status: 404 });
  const body = await req.text();
  return proxy(req, path, { method: "POST", body: body || undefined });
}
