"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { ClockIcon, GavelIcon } from "lucide-react";
import { ErrorState } from "@/components/app/page-states";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBrl } from "@/lib/money";
import { getBids } from "./lots-api";
import { formatGap, maskAlias, recentBidsWithGaps } from "./recent-bids-logic";

const timeBrt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));

/** R4: lista leve com os 5 últimos lances (endpoint público de lances, só leitura). */
function RecentBidsList({ lotId, enabled }: { lotId: string; enabled: boolean }) {
  const query = useQuery({ queryKey: ["lot", lotId, "recent-bids"], queryFn: () => getBids(lotId, 1, 6), enabled, staleTime: 10_000 });
  if (query.isPending) return <div role="status" aria-label="Carregando lances" className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (query.isError) return <ErrorState message="Não foi possível carregar os lances." onRetry={() => void query.refetch()} />;
  const bids = recentBidsWithGaps(query.data.items, 5);
  if (bids.length === 0) return <p className="text-sm text-muted-foreground">Nenhum lance ainda. O primeiro lance abre a disputa.</p>;
  return (
    <ol className="flex flex-col divide-y">
      {bids.map((bid, index) => (
        <li key={bid.sequence} className="grid grid-cols-[1fr_auto] gap-x-3 py-2">
          <span className="font-semibold tabular-nums">{formatBrl(bid.amountCents)}{index === 0 ? <span className="ml-2 text-xs font-normal text-success">lidera</span> : null}</span>
          <span className="text-right text-xs tabular-nums text-muted-foreground">{timeBrt(bid.acceptedAt)}</span>
          <span className="text-xs text-muted-foreground">{maskAlias(bid.alias)}</span>
          <span className="text-right text-xs tabular-nums text-muted-foreground">{formatGap(bid.gapMs)}</span>
        </li>
      ))}
    </ol>
  );
}

function subscribeHover(onChange: () => void): () => void {
  const media = window.matchMedia("(hover: hover)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useCanHover(): boolean {
  return useSyncExternalStore(subscribeHover, () => window.matchMedia("(hover: hover)").matches, () => true);
}

export function RecentBidsTrigger({ lotId, bidCount, title }: { lotId: string; bidCount: number; title: string }) {
  const canHover = useCanHover();
  const [hoverOpen, setHoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const label = bidCount === 1 ? "1 lance" : `${bidCount} lances`;
  const header = (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="font-medium">Últimos lances</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ClockIcon className="size-3.5" /> horário de Brasília</span>
    </div>
  );
  const trigger = (
    <button
      type="button"
      className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-md px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      aria-label={`${label}: ver últimos lances`}
      onClick={() => (canHover ? setHoverOpen((v) => !v) : setSheetOpen(true))}
    >
      <GavelIcon className="size-4" /> <span className="tabular-nums">{label}</span>
    </button>
  );
  return (
    <>
      <HoverCard open={canHover ? hoverOpen : false} onOpenChange={setHoverOpen} openDelay={150}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent>
          {header}
          <RecentBidsList lotId={lotId} enabled={hoverOpen} />
        </HoverCardContent>
      </HoverCard>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetTitle>Últimos lances</SheetTitle>
          <SheetDescription className="line-clamp-1">{title}</SheetDescription>
          <RecentBidsList lotId={lotId} enabled={sheetOpen} />
        </SheetContent>
      </Sheet>
    </>
  );
}
