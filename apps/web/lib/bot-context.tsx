"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Bot, DEFAULT_BOT, botById } from "@/lib/bots";

const KEY = "trading-lab.bot";

const BotContext = createContext<{ bot: Bot; setBot: (id: string) => void }>({
  bot: botById(DEFAULT_BOT),
  setBot: () => {},
});

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(DEFAULT_BOT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setId(botById(saved).id);
    } catch {
      // sin almacenamiento local: se queda el bot por defecto
    }
  }, []);

  const setBot = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignorar
    }
  };

  return <BotContext.Provider value={{ bot: botById(id), setBot }}>{children}</BotContext.Provider>;
}

export const useBot = () => useContext(BotContext);
