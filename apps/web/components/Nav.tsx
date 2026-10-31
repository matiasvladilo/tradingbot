"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBot } from "@/lib/bot-context";
import { BOTS } from "@/lib/bots";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/practica", label: "Práctica" },
  { href: "/grafico", label: "Gráfico" },
  { href: "/simulacion", label: "Simulación" },
  { href: "/robustez", label: "Robustez" },
  { href: "/historial", label: "Historial" },
  { href: "/controles", label: "Controles" },
];

export default function Nav() {
  const pathname = usePathname();
  const { bot, setBot } = useBot();
  return (
    <>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="spacer" />
      <label className="row" style={{ gap: 8 }}>
        <span className="muted">Bot</span>
        <select value={bot.id} onChange={(e) => setBot(e.target.value)}>
          {BOTS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
