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
    <section aria-labelledby="hero-proximo" className="grid overflow-hidden rounded-xl border bg-card shadow-sm md:h-[280px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex h-48 items-center justify-center bg-muted md:h-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
        <img src={lot.imageUrl} alt={`${lot.title}, ${lot.artist}`} className="h-full w-full object-contain" />
      </div>
      <div className="flex flex-col justify-center gap-3 p-5 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Próximo leilão</p>
        <h2 id="hero-proximo" className="font-serif text-2xl leading-tight md:text-3xl">{lot.title}</h2>
        <p className="text-sm text-muted-foreground">{lot.artist}</p>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="text-sm">
            <span className="block text-xs text-muted-foreground">Abre em</span>
            <span role="timer" aria-label={`Abre em ${parts.h} horas, ${parts.m} minutos e ${parts.s} segundos`} className="font-serif text-2xl font-semibold tabular-nums">
              {parts.h}h {parts.m}min {parts.s}s
            </span>
          </p>
          <p className="text-sm">
            <span className="block text-xs text-muted-foreground">Lance inicial</span>
            <span className="font-serif text-xl font-semibold tabular-nums text-primary">{formatBrl(lot.initialCents)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatBrt(lot.startsAt)} (BRT)</p>
        </div>
        <WatchButton lotId={lot.id} title={lot.title} />
      </div>
    </section>
  );
}
