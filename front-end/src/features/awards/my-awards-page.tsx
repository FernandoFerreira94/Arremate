"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { listAwards, listParticipations, type Award, type Participation } from "./awards-api";
import { outcomeLabel, splitParticipations, type Outcome } from "./participations";

const OUTCOME_VARIANT: Record<Outcome, "success" | "danger" | "warning" | "neutral" | "ended"> = {
  LEADING: "success",
  OUTBID: "danger",
  PENDING: "warning",
  WON: "success",
  LOST: "ended",
  CANCELLED: "neutral",
};

export function MyAwardsPage() {
  const awards = useQuery({ queryKey: ["me", "awards", 1], queryFn: () => listAwards(1) });
  const participations = useQuery({ queryKey: ["me", "participations", 1], queryFn: () => listParticipations(1) });

  return (
    <PageShell title="Meus arremates" description="Seus arremates com comprovante e as disputas em que você deu lance.">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader><CardTitle>Arrematados</CardTitle></CardHeader>
          <CardContent>
            {awards.isPending ? (
              <LoadingRows label="Carregando arremates" rows={2} />
            ) : awards.isError ? (
              <ErrorState message="Não foi possível carregar seus arremates." onRetry={() => void awards.refetch()} />
            ) : awards.data.items.length === 0 ? (
              <EmptyState title="Nenhum arremate ainda" description="Quando você vencer um lote e a liquidação terminar, o comprovante aparece aqui." action={<Button asChild variant="outline"><Link href="/">Ver lotes ao vivo</Link></Button>} />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {awards.data.items.map((award) => <AwardCard key={award.lotId} award={award} />)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Participações</CardTitle></CardHeader>
          <CardContent>
            {participations.isPending ? (
              <LoadingRows label="Carregando participações" />
            ) : participations.isError ? (
              <ErrorState message="Não foi possível carregar suas participações." onRetry={() => void participations.refetch()} />
            ) : participations.data.items.length === 0 ? (
              <EmptyState title="Você ainda não deu lances" description="Escolha um lote ao vivo na vitrine para participar." />
            ) : (
              <ParticipationsTable rows={participations.data.items} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function AwardCard({ award }: { award: Award }) {
  const [copied, setCopied] = useState<"ok" | "erro" | null>(null);
  const href = `/comprovantes/${award.receiptToken}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied("ok");
    } catch {
      setCopied("erro");
    }
  }
  return (
    <li className="flex gap-4 rounded-lg border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- mídia local persistida pela API */}
      <img src={award.imageUrl} alt="" className="size-20 rounded-md object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-serif font-semibold">{award.title}</p>
        <p className="text-sm tabular-nums">{formatBrl(award.amountCents)} · {formatBrt(award.settledAt)}</p>
        <Badge variant="success" className="self-start"><CheckCircle2Icon className="size-3" /> Arrematado</Badge>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href={href}>Comprovante</Link></Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()}><LinkIcon /> Copiar link</Button>
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">{copied === "ok" ? "Link copiado." : copied === "erro" ? "Não deu para copiar; abra o comprovante e copie da barra de endereço." : ""}</p>
      </div>
    </li>
  );
}

function ParticipationsTable({ rows }: { rows: Participation[] }) {
  const { open, finished } = splitParticipations(rows);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lote</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="text-right">Seu maior lance</TableHead>
          <TableHead className="text-right">Atual / final</TableHead>
          <TableHead>Término</TableHead>
          <TableHead><span className="sr-only">Ação</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...open, ...finished].map((row) => (
          <TableRow key={row.lotId}>
            <TableCell className="font-medium">{row.title}</TableCell>
            <TableCell><Badge variant={OUTCOME_VARIANT[row.outcome]}>{outcomeLabel(row.outcome)}</Badge></TableCell>
            <TableCell className="text-right">{formatBrl(row.myTopCents)}</TableCell>
            <TableCell className="text-right">{row.currentCents ? formatBrl(row.currentCents) : "—"}</TableCell>
            <TableCell>{formatBrt(row.endsAt)}</TableCell>
            <TableCell className="text-right">
              {row.outcome === "WON" && row.receiptToken ? (
                <Link href={`/comprovantes/${row.receiptToken}`} className="inline-flex min-h-11 items-center text-sm font-medium">Comprovante</Link>
              ) : row.outcome === "LEADING" || row.outcome === "OUTBID" ? (
                <Link href={`/lotes/${row.lotId}`} className="inline-flex min-h-11 items-center text-sm font-medium">Abrir sala</Link>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
