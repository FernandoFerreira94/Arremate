"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { clockOffset } from "../lots/room-logic";
import { countdownParts, getNextLot, NEXT_LOT_KEY } from "./notifications-api";
import { WatchButton } from "./watch-button";

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** H2 "próximo leilão" (280 px no desktop): lote agendado mais próximo, contagem e "Avise-me quando abrir". Some sem agendados. */
export function NextAuctionHero() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: NEXT_LOT_KEY, queryFn: getNextLot, refetchInterval: 60_000 });
  const now = useNow();
  const lot = query.data?.lot ?? null;
  const offset = query.data ? clockOffset(query.data.serverNow, query.dataUpdatedAt) : 0;
  const left = lot ? Date.parse(lot.startsAt) - (now + offset) : 0;
  const reached = lot !== null && left <= 0;
  useEffect(() => {
    if (!reached) return;
    const id = setTimeout(() => {
      void client.invalidateQueries({ queryKey: NEXT_LOT_KEY });
      void client.invalidateQueries({ queryKey: ["showcase"] });
    }, 1500);
    return () => clearTimeout(id);
  }, [reached, client]);
  if (!lot) return null;
  const parts = countdownParts(left);

  return (
    <section
      aria-labelledby="hero-proximo"
      className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-xl border bg-card p-4 shadow-sm md:max-h-[280px] md:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] md:items-center md:gap-x-8 md:p-6 lg:grid-cols-[minmax(0,168px)_minmax(0,1fr)_auto]"
    >
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-muted md:h-[180px] lg:h-[200px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
        <img src={lot.imageUrl} alt={`${lot.title}, ${lot.artist}`} className="h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Próximo leilão · abre {formatBrt(lot.startsAt)} (Brasília)</p>
        <h2 id="hero-proximo" className="line-clamp-2 font-serif text-lg leading-snug md:text-2xl">{lot.title}</h2>
        <p className="truncate text-xs text-muted-foreground md:text-sm">{lot.artist}</p>
        <p className="mt-1 flex items-baseline gap-3 text-sm">
          <span className="text-xs text-muted-foreground">Lance inicial</span>
          <span className="font-serif text-lg font-semibold tabular-nums text-primary md:text-xl">{formatBrl(lot.initialCents)}</span>
        </p>
      </div>
      <div className="col-span-2 flex flex-col gap-3 md:col-span-1 md:items-end">
        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:gap-1.5">
          <span className="text-xs text-muted-foreground">Abre em</span>
          <div role="timer" aria-label={`Abre em ${parts.h} horas, ${parts.m} minutos e ${parts.s} segundos`} className="flex gap-2">
            {([[parts.h, "h"], [parts.m, "min"], [parts.s, "s"]] as const).map(([value, unit]) => (
              <span key={unit} className="flex w-14 flex-col items-center rounded-md border bg-background py-1.5 md:w-16 md:py-2">
                <span className="font-serif text-xl font-semibold leading-none tabular-nums md:text-2xl">{value}</span>
                <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{unit}</span>
              </span>
            ))}
          </div>
        </div>
        <WatchButton lotId={lot.id} title={lot.title} />
      </div>
    </section>
  );
}
