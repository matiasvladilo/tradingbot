import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Generado por scripts/risk_scenarios.py
const FILE = path.join(process.cwd(), "data", "risk.json");

export async function GET() {
  try {
    const raw = await readFile(FILE, "utf-8");
    return new NextResponse(raw, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ scenarios: [] });
  }
}
