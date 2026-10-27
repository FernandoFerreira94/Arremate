"use client";

import { Hint } from "@/components/app/hint";
import Link from "next/link";
import { useState } from "react";
import { ChevronRightIcon, ClockIcon, ImageOffIcon } from "lucide-react";
import { LotStateBadge } from "@/components/app/lot-state-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import { LotDetailsDialog } from "./lot-details";
import { FavoriteButton } from "../favorites/favorite-button";
import { WatchButton } from "../notifications/watch-button";
import type { PublicLot } from "./lots-api";
import { RecentBidsTrigger } from "./recent-bids";
import { formatCountdown, remainingMs } from "./room-logic";

/** R2: altura fixa (452 px) e imagem inteira (contain) sobre --muted. Os detalhes ficam no Dialog (R3). */
export function LotCard({ lot, now, offset, dimmed = false }: { lot: PublicLot; now: number; offset: number; dimmed?: boolean }) {
  const live = lot.state === "LIVE";
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Card className="flex h-[452px] flex-col gap-0 overflow-hidden p-0" data-tour="card">
      <div className={cn("relative flex h-[220px] shrink-0 items-center justify-center bg-muted", dimmed && "[&_img]:opacity-75")}>
        <FavoriteButton lotId={lot.id} title={lot.title} className="absolute right-1 top-1 z-10" />
        {imageFailed ? (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><ImageOffIcon className="size-6" /> Imagem indisponível</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API
          <img src={lot.imageUrl} alt={`${lot.title}, ${lot.artist}`} className="h-full w-full object-contain" loading="lazy" onError={() => setImageFailed(true)} />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <LotStateBadge state={lot.state} />
        <div className="min-h-0">
          <Hint title={lot.title} description={[lot.artist, lot.date].filter(Boolean).join(" · ") || undefined} side="top">
            <h2 className="line-clamp-2 font-serif text-lg leading-tight">{lot.title}</h2>
          </Hint>
          <p className="line-clamp-1 text-sm text-muted-foreground">{[lot.artist, lot.date].filter(Boolean).join(" · ")}</p>
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{lot.currentCents ? (lot.state === "ENDED" ? "Último lance" : "Lance atual") : "Lance inicial"}</dt>
          <dd className="text-right font-serif text-base font-semibold tabular-nums text-primary">{formatBrl(lot.currentCents ?? lot.initialCents)}</dd>
          <dt className="inline-flex items-center gap-1 text-muted-foreground"><ClockIcon className="size-3.5" /> {live ? "Termina em" : lot.state === "SCHEDULED" ? "Abre em" : "Encerrou"}</dt>
          <dd className="text-right tabular-nums">
            {live ? formatCountdown(remainingMs(lot.endsAt, now, offset)) : formatBrt(lot.state === "SCHEDULED" ? lot.startsAt : lot.endsAt)}
          </dd>
        </dl>
        <div className="flex items-center justify-between gap-1 border-t pt-2">
          <span data-tour="bids" className="inline-flex"><RecentBidsTrigger lotId={lot.id} bidCount={lot.bidCount} title={lot.title} /></span>
          <div className="flex items-center gap-1">
            <LotDetailsDialog lot={lot} compact />
            {lot.state === "SCHEDULED" ? (
              <WatchButton lotId={lot.id} title={lot.title} variant="card" />
            ) : (
              <Button asChild size="sm">
                <Link href={`/lotes/${lot.id}`} data-tour={live ? "room" : undefined}>Abrir sala <ChevronRightIcon /></Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
