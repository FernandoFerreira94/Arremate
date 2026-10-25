"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PublicLot } from "../lots/lots-api";
import { clockOffset } from "../lots/room-logic";
import { CAROUSEL_MS, countdownParts, getUpcoming, SWIPE_PX, UPCOMING_KEY, wrapIndex } from "./notifications-api";
import { WatchButton } from "./watch-button";

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const id = requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(id);
      media.removeEventListener("change", update);
    };
  }, []);
  return reduced;
}

function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/**
 * H2b: carrossel de até 5 agendados (GET /api/lots/upcoming). Autoplay de 4 s em loop, pausa no hover, no foco e com a aba
 * oculta; Pausar/Retomar manual não retoma sozinho. Reduced-motion: sem autoplay, sem animação e sem Pausar. 1 lote: sem controles.
 */
export function NextAuctionHero() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: UPCOMING_KEY, queryFn: getUpcoming, refetchInterval: 60_000 });
  const now = useNow();
  const reduced = useReducedMotion();
  const hidden = useTabHidden();
  const [rawIndex, setIndex] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchX = useRef<number | null>(null);
  const items = query.data?.items ?? [];
  const total = items.length;
  const index = wrapIndex(rawIndex, total);
  const offset = query.data ? clockOffset(query.data.serverNow, query.dataUpdatedAt) : 0;
  const multi = total > 1;
  const autoplay = multi && !reduced && !manualPause && !hovering && !focused && !hidden;
  const go = useCallback((delta: number) => setIndex((current) => current + delta), []);
  const anyReached = items.some((lot) => Date.parse(lot.startsAt) - (now + offset) <= 0);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => go(1), CAROUSEL_MS);
    return () => clearInterval(id);
  }, [autoplay, go]);

  useEffect(() => {
    if (!anyReached) return;
    const id = setTimeout(() => {
      void client.invalidateQueries({ queryKey: UPCOMING_KEY });
      void client.invalidateQueries({ queryKey: ["showcase"] });
    }, 1500);
    return () => clearTimeout(id);
  }, [anyReached, client]);

  if (total === 0) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!multi) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };
  const arrow = (dir: -1 | 1, className?: string) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => go(dir)}
      aria-label={dir < 0 ? "Leilão anterior" : "Próximo leilão"}
      className={cn("size-11 rounded-full", className)}
    >
      {dir < 0 ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </Button>
  );
  const dots = (
    <div className="flex items-center">
      {items.map((lot, i) => (
        <button
          key={lot.id}
          type="button"
          onClick={() => setIndex(i)}
          aria-label={`Leilão ${i + 1} de ${total}`}
          aria-current={i === index ? "true" : undefined}
          className="inline-flex size-11 items-center justify-center"
        >
          <span aria-hidden className={cn("h-2 rounded-full transition-all duration-300 motion-reduce:transition-none", i === index ? "w-6 bg-primary" : "w-2 bg-border")} />
        </button>
      ))}
    </div>
  );
  const pause = !reduced ? (
    <Button type="button" variant="ghost" size="sm" onClick={() => setManualPause((p) => !p)} className="min-h-11 md:min-h-9">
      {manualPause ? <><PlayIcon /> Retomar</> : <><PauseIcon /> Pausar</>}
    </Button>
  ) : null;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Próximos leilões"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        const end = event.changedTouches[0]?.clientX;
        touchX.current = null;
        if (!multi || start === null || end === undefined) return;
        if (Math.abs(end - start) >= SWIPE_PX) go(end < start ? 1 : -1);
      }}
      className={cn("relative rounded-xl border bg-card p-4 shadow-sm md:p-6", multi && "md:px-20")}
    >
      <div aria-live={autoplay ? "off" : "polite"} className="grid">
        {items.map((lot, i) => (
          <HeroSlide key={lot.id} lot={lot} position={i + 1} total={total} active={i === index} leftMs={Date.parse(lot.startsAt) - (now + offset)} />
        ))}
      </div>
      {multi ? (
        <>
          {arrow(-1, "absolute top-1/2 left-4 hidden -translate-y-1/2 md:inline-flex")}
          {arrow(1, "absolute top-1/2 right-4 hidden -translate-y-1/2 md:inline-flex")}
          <div className="mt-2 flex flex-col items-center md:mt-1 md:flex-row md:justify-center md:gap-2">
            <div className="flex items-center gap-2">
              {arrow(-1, "md:hidden")}
              {dots}
              {arrow(1, "md:hidden")}
            </div>
            {pause}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HeroSlide({ lot, position, total, active, leftMs }: { lot: PublicLot; position: number; total: number; active: boolean; leftMs: number }) {
  const parts = countdownParts(leftMs);
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} de ${total}`}
      inert={!active}
      aria-hidden={!active}
      className={cn(
        "col-start-1 row-start-1 grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-4 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none md:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] md:items-center md:gap-x-8 lg:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]",
        active ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0",
      )}
    >
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-muted md:h-[170px] lg:h-[180px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
        <img src={lot.imageUrl} alt={`${lot.title}, ${lot.artist}`} className="h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Próximo leilão · abre {formatBrt(lot.startsAt)} (Brasília)</p>
        <h2 className="line-clamp-2 font-serif text-lg leading-snug md:text-2xl">{lot.title}</h2>
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
    </div>
  );
}
