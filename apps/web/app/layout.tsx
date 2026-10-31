import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { BotProvider } from "@/lib/bot-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "trading-lab",
  description: "Simulación de estrategias BTC/ETH sobre Freqtrade",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <BotProvider>
          <div className="mode-banner">SIMULACIÓN · DINERO VIRTUAL · SIN CONEXIÓN A CUENTA REAL</div>
          <header className="topbar">
            <span className="brand">trading-lab</span>
            <Nav />
          </header>
          <main>{children}</main>
        </BotProvider>
      </body>
    </html>
  );
}
