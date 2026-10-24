import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { LotStateBadge } from "@/components/app/lot-state-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import type { PublicLot } from "./lots-api";
import { formatCountdown, remainingMs } from "./room-logic";

export function LotCard({ lot, now, offset }: { lot: PublicLot; now: number; offset: number }) {
  const live = lot.state === "LIVE";
  return (
    <Card className="overflow-hidden p-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
      <img src={lot.imageUrl} alt={`${lot.title}, ${lot.artist}`} className="aspect-[4/3] w-full bg-muted object-cover" loading="lazy" />
      <CardContent className="flex flex-col gap-3 p-4">
        <LotStateBadge state={lot.state} />
        <div>
          <h2 className="font-serif text-lg leading-tight">{lot.title}</h2>
          <p className="text-sm text-muted-foreground">{[lot.artist, lot.date].filter(Boolean).join(" · ")}</p>
          {lot.medium ? <p className="line-clamp-1 text-sm text-muted-foreground">{lot.medium}</p> : null}
          <p className="text-xs text-muted-foreground">The Met · {lot.license}</p>
        </div>
        <dl className="grid grid-cols-2 gap-y-1 border-t pt-3 text-sm">
          <dt className="text-muted-foreground">{lot.currentCents ? (lot.state === "ENDED" ? "Último lance" : "Lance atual") : "Lance inicial"}</dt>
          <dd className="text-right font-semibold tabular-nums">{formatBrl(lot.currentCents ?? lot.initialCents)}</dd>
          <dt className="text-muted-foreground">Lances</dt>
          <dd className="text-right tabular-nums">{lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`}</dd>
          <dt className="text-muted-foreground">{live ? "Termina em" : lot.state === "SCHEDULED" ? "Abre em" : "Encerrou"}</dt>
          <dd className="text-right tabular-nums">
            {live ? formatCountdown(remainingMs(lot.endsAt, now, offset)) : formatBrt(lot.state === "SCHEDULED" ? lot.startsAt : lot.endsAt)}
          </dd>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/lotes/${lot.id}`}>Abrir sala <ChevronRightIcon /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
