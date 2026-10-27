"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SEARCH_MAX, searchHref } from "./lot-search-logic";

type Props = { className?: string; onSubmitted?: () => void };

/** Espera depois da última tecla antes de filtrar (pedido do Fernando, 27/10: filtra enquanto digita, sem Enter). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Busca por nome da obra ou do artista; o resultado aparece na vitrine (`/?q=`) enquanto a pessoa digita. */
export function LotSearch({ className, onSubmitted }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);
  const pending = useRef<number | undefined>(undefined);
  // A URL mudou por fora (limpar busca, voltar no histórico): o campo acompanha, sem remontar nem perder o foco.
  if (current !== synced) {
    setSynced(current);
    if (current.trim() !== value.trim().replace(/\s+/g, " ")) setValue(current);
  }

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const go = (term: string) => {
    const href = searchHref(term, params, pathname === "/");
    // Na vitrine troca a URL sem empilhar histórico a cada tecla; de outra página, entra na vitrine uma vez.
    if (pathname === "/") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const change = (next: string) => {
    setValue(next);
    window.clearTimeout(pending.current);
    if (next.trim() === current.trim()) return;
    pending.current = window.setTimeout(() => go(next), SEARCH_DEBOUNCE_MS);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.clearTimeout(pending.current);
    go(value);
    onSubmitted?.();
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => change(event.target.value)}
        maxLength={SEARCH_MAX}
        placeholder="Buscar obra ou artista"
        aria-label="Buscar obra ou artista"
        autoComplete="off"
        className="h-9 pl-9"
      />
    </form>
  );
}
