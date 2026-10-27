"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/lib/theme";
import { setThemePreference, useTheme, useThemePreference } from "@/lib/use-theme";

/** Menu de tema: Claro, Escuro ou Sistema. Sem escolha salva, segue o sistema; a escolha fica salva no navegador. */
export function ThemeToggle() {
  const theme = useTheme();
  const preference = useThemePreference();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema" title="Tema" disabled={theme === null}>
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference ?? "system"} onValueChange={(value) => setThemePreference(value as ThemePreference)}>
          <DropdownMenuRadioItem value="light"><SunIcon /> Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><MoonIcon /> Escuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><MonitorIcon /> Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
