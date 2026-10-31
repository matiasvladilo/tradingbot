"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/grafico", label: "Gráfico" },
  { href: "/simulacion", label: "Simulación" },
  { href: "/robustez", label: "Robustez" },
  { href: "/historial", label: "Historial" },
  { href: "/controles", label: "Controles" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
