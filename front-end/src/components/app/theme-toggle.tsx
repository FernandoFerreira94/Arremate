"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTheme, useTheme } from "@/lib/use-theme";

/** Alterna claro/escuro; a escolha fica salva no navegador. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Usar tema claro" : "Usar tema escuro";
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} disabled={theme === null} onClick={() => setTheme(next)}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
