"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/app/page-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LotCard } from "./lot-card";
import { getShowcase } from "./lots-api";
import { endsTodayBrt } from "./recent-bids-logic";
import { clockOffset, showcaseTab, type ShowcaseTab } from "./room-logic";

/** R5: abas endereçáveis pelo menu (`/?aba=agendados`); "Encerrando hoje" é um filtro dos ao vivo, sem status novo. */
type Tab = ShowcaseTab | "ending";
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
  const setTab = (next: Tab) => {
    const search = new URLSearchParams(params.toString());
    search.set("aba", TAB_PARAM[next]);
    search.delete("page");
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  };
  const query = useQuery({ queryKey: ["showcase", page], queryFn: () => getShowcase(page), refetchInterval: 15000 });
  const now = useNow();
  const offset = query.data ? clockOffset(query.data.serverNow, query.dataUpdatedAt) : 0;
  const items = (query.data?.items ?? []).filter((lot) => showcaseTab(lot.state) !== null);
  const inTab = (lot: (typeof items)[number], t: Tab) => (t === "ending" ? lot.state === "LIVE" && endsTodayBrt(lot.endsAt, now + offset) : showcaseTab(lot.state) === t);
  const count = (t: Tab) => items.filter((lot) => inTab(lot, t)).length;
  const visible = items.filter((lot) => inTab(lot, tab));
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-3xl">
        <h1 className="text-4xl lg:text-5xl">Leilões de arte de acervo público</h1>
        <p className="mt-2 text-muted-foreground">
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
      {query.isPending ? (
        <div role="status" aria-label="Carregando lotes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[452px]" />)}
        </div>
      ) : query.isError ? (
        <ErrorState message="Não foi possível carregar os lotes. Verifique sua conexão. Nenhum dado foi alterado." onRetry={() => void query.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((lot) => <li key={lot.id}><LotCard lot={lot} now={now} offset={offset} /></li>)}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-2">
          <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
            {page > 1 ? <Link href={`/?aba=${TAB_PARAM[tab]}&page=${page - 1}`}><ChevronLeftIcon /> Anterior</Link> : <span><ChevronLeftIcon /> Anterior</span>}
          </Button>
          <span className="text-sm tabular-nums" aria-current="page">{page} de {pages}</span>
          <Button asChild={page < pages} variant="outline" size="sm" disabled={page >= pages}>
            {page < pages ? <Link href={`/?aba=${TAB_PARAM[tab]}&page=${page + 1}`}>Próxima <ChevronRightIcon /></Link> : <span>Próxima <ChevronRightIcon /></span>}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
