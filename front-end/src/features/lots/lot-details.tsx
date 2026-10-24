"use client";

import { ExternalLinkIcon, InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { SIMULATED_LABEL, type PublicLot } from "./lots-api";

/** Mesmas linhas do "Sobre o lote" da sala (R3 reaproveita o AboutCard). */
export function lotDetailRows(lot: PublicLot): Array<[string, string]> {
  return [
    ["Artista", lot.artist],
    ["Nota do artista", lot.artistBio ?? ""],
    ["Data", lot.date],
    ["Técnica", lot.medium],
    ["Dimensões", lot.dimensions],
    ["Proveniência", lot.credit],
    ["Licença da imagem", lot.license],
    ["Lance inicial", formatBrl(lot.initialCents)],
    ["Incremento mínimo", formatBrl(lot.incrementCents)],
    ["Estimativa", lot.estimate ? `${formatBrl(lot.estimate.lowCents)} – ${formatBrl(lot.estimate.highCents)} (${SIMULATED_LABEL.toLowerCase()})` : ""],
    ["Início", formatBrt(lot.startsAt)],
    ["Fim previsto", formatBrt(lot.endsAt)],
  ];
}

export function LotDetailRows({ lot }: { lot: PublicLot }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-2 text-sm">
      {lotDetailRows(lot).filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

export function LotDetailsDialog({ lot, compact = false }: { lot: PublicLot; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} aria-label={`Detalhes de ${lot.title}`} title="Detalhes" className={compact ? "size-9" : undefined}><InfoIcon />{compact ? null : " Detalhes"}</Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
          <img src={lot.imageUrl} alt="" className="size-24 shrink-0 rounded-md bg-muted object-contain" />
          <div className="min-w-0">
            <DialogTitle>{lot.title}</DialogTitle>
            <DialogDescription>{[lot.artist, lot.date].filter(Boolean).join(" · ")}</DialogDescription>
          </div>
        </div>
        <LotDetailRows lot={lot} />
        {lot.conditionReport ? (
          <div className="rounded-lg border p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium">Laudo de conservação</span>
              <Badge variant="warning">{SIMULATED_LABEL}</Badge>
            </div>
            <p>{lot.conditionReport.text}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {lot.sourceUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={lot.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /> Ver no The Met</a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
