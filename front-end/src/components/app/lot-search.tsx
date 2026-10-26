"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SEARCH_MAX, searchHref } from "./lot-search-logic";

type Props = { className?: string; onSubmitted?: () => void };

/** Busca por nome da obra ou do artista; o resultado aparece na vitrine (`/?q=`). */
export function LotSearch(props: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/" ? (params.get("q") ?? "") : "";
  // a key remonta o campo quando a URL muda (limpar busca, voltar no histórico), sem setState em efeito
  return <SearchForm key={current} initial={current} {...props} />;
}

function SearchForm({ initial, className, onSubmitted }: Props & { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(searchHref(value, params, pathname === "/"), { scroll: false });
    onSubmitted?.();
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={SEARCH_MAX}
        placeholder="Buscar obra ou artista"
        aria-label="Buscar obra ou artista"
        className="h-9 pl-9"
      />
    </form>
  );
}
