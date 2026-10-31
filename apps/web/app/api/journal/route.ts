import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { JournalEntry } from "@/lib/practice";

// Diario de la práctica manual: motivo y revisión de cada operación, por trade_id.
// Se guarda solo en este equipo (apps/web/data está fuera de git).
const FILE = path.join(process.cwd(), "data", "journal.json");

async function load(): Promise<Record<string, JournalEntry>> {
  try {
    return JSON.parse(await readFile(FILE, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json(await load());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { tradeId?: number; setup?: string; reason?: string; review?: string };
  if (!body.tradeId || !Number.isInteger(body.tradeId)) {
    return NextResponse.json({ error: "tradeId requerido" }, { status: 400 });
  }
  const journal = await load();
  const key = String(body.tradeId);
  const now = new Date().toISOString();
  const prev = journal[key];
  journal[key] = {
    setup: (body.setup ?? prev?.setup ?? "").slice(0, 40),
    reason: (body.reason ?? prev?.reason ?? "").slice(0, 1000),
    review: (body.review ?? prev?.review)?.slice(0, 1000),
    createdAt: prev?.createdAt ?? now,
    updatedAt: prev ? now : undefined,
  };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(journal, null, 2), "utf-8");
  return NextResponse.json(journal[key]);
}
