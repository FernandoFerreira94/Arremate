"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { LotSearch } from "@/components/app/lot-search";
import { EmptyState, ErrorState } from "@/components/app/page-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NextAuctionHero } from "../notifications/next-auction-hero";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LotCard } from "./lot-card";
import { getShowcase, type ShowcaseState } from "./lots-api";
import { clockOffset } from "./room-logic";

/** R5: abas endereçáveis pelo menu (`/?aba=agendados`); "Encerrando hoje" é um filtro dos ao vivo, sem status novo. */
type Tab = ShowcaseState;
const TAB_PARAM: Record<Tab, string> = { live: "ao-vivo", scheduled: "agendados", ended: "encerrados", ending: "encerrando-hoje" };
const tabFromParam = (value: string | null): Tab => (Object.entries(TAB_PARAM).find(([, v]) => v === value)?.[0] as Tab | undefined) ?? "live";

const EMPTY: Record<Tab, { title: string; description: string }> = {
  ending: { title: "Nenhum lote encerra hoje", description: "Os lotes ao vivo que terminam hoje (horário de Brasília) aparecem aqui." },
  live: { title: "Nenhum lote ao vivo", description: "Quando um leilão começar, ele aparece aqui." },
  scheduled: { title: "Nenhum lote agendado", description: "Quando um leiloeiro programar um novo lote, ele aparece aqui." },
  ended: { title: "Nenhum lote encerrado", description: "Lotes encerrados ficam aqui com o resultado." },
};

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ShowcasePage() {
  const params = useSearchParams();
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabFromParam(params.get("aba"));
  const q = params.get("q")?.trim() ?? "";
  const setTab = (next: Tab) => {
    const search = new URLSearchParams(params.toString());
    search.set("aba", TAB_PARAM[next]);
    search.delete("page");
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  };
  // A aba vai para o servidor: filtro e paginação no SQL, e os totais contam todos os lotes, não só a página.
  const query = useQuery({ queryKey: ["showcase", tab, page, q], queryFn: () => getShowcase(page, q, tab), refetchInterval: 15000, placeholderData: (previous) => previous });
  const now = useNow();
  const offset = query.data ? clockOffset(query.data.serverNow, query.dataUpdatedAt) : 0;
  // Ao trocar de aba os totais anteriores ficam no lugar, mas os cartões da aba antiga não aparecem.
  const loading = query.isPending || query.isPlaceholderData;
  const count = (t: Tab) => query.data?.counts[t] ?? 0;
  const found = count("live") + count("scheduled") + count("ended");
  const visible = query.data?.items ?? [];
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;
  const pageHref = (n: number) => {
    const search = new URLSearchParams({ aba: TAB_PARAM[tab], page: String(n) });
    if (q) search.set("q", q);
    return `/?${search.toString()}`;
  };
  const clearSearch = () => {
    const search = new URLSearchParams(params.toString());
    search.delete("q");
    search.delete("page");
    const rest = search.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  };
  const empty = q
    ? { title: `Nada encontrado para "${q}" nesta aba`, description: "Confira as outras abas ou busque por outro nome de obra ou artista." }
    : EMPTY[tab];

  return (
    <div className="flex flex-col gap-6">
      <NextAuctionHero />
      <div className="max-w-3xl">
        <h1 className="text-2xl lg:text-3xl">Leilões de arte de acervo público</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lotes de demonstração criados a partir do acervo aberto do The Met. Lances e saldos são simulados; as obras originais não estão à venda.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList aria-label="Estado dos lotes" className="flex-nowrap">
            <TabsTrigger value="live">Ao vivo ({count("live")})</TabsTrigger>
            <TabsTrigger value="scheduled">Agendados ({count("scheduled")})</TabsTrigger>
            <TabsTrigger value="ended">Encerrados ({count("ended")})</TabsTrigger>
            <TabsTrigger value="ending">Encerrando hoje ({count("ending")})</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Término mais próximo primeiro · cancelados não aparecem</p>
      </div>
      <LotSearch className="xl:hidden" />
      {q ? (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
          <span>
            Resultados para <strong>&ldquo;{q}&rdquo;</strong>
            {query.data ? <span className="text-muted-foreground"> · {found} {found === 1 ? "lote" : "lotes"}</span> : null}
          </span>
          <Button variant="ghost" size="sm" onClick={clearSearch}>
            <XIcon /> Limpar busca
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-label="Carregando lotes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[452px]" />)}
        </div>
      ) : query.isError ? (
        <ErrorState message="Não foi possível carregar os lotes. Verifique sua conexão. Nenhum dado foi alterado." onRetry={() => void query.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul aria-label="Lotes da aba" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((lot) => <li key={lot.id}><LotCard lot={lot} now={now} offset={offset} /></li>)}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-2">
          <Button asChild={page > 1} variant="outline" size="sm" className="whitespace-nowrap" disabled={page <= 1}>
            {page > 1 ? <Link href={pageHref(page - 1)} className="inline-flex items-center gap-2 whitespace-nowrap"><ChevronLeftIcon /> Anterior</Link> : <span className="inline-flex items-center gap-2 whitespace-nowrap"><ChevronLeftIcon /> Anterior</span>}
          </Button>
          <span className="text-sm tabular-nums" aria-current="page">{page} de {pages}</span>
          <Button asChild={page < pages} variant="outline" size="sm" className="whitespace-nowrap" disabled={page >= pages}>
            {page < pages ? <Link href={pageHref(page + 1)} className="inline-flex items-center gap-2 whitespace-nowrap">Próxima <ChevronRightIcon /></Link> : <span className="inline-flex items-center gap-2 whitespace-nowrap">Próxima <ChevronRightIcon /></span>}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
