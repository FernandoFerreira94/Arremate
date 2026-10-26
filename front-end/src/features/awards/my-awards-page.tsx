"use client";

import { ArtworkImage } from "@/components/app/artwork-image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { LotStateBadge } from "@/components/app/lot-state-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { listAwards, listParticipations, type Award, type Participation } from "./awards-api";
import { outcomeLabel, type Outcome } from "./participations";

const OUTCOME_VARIANT: Record<Outcome, "success" | "danger" | "warning" | "neutral" | "ended"> = {
  LEADING: "success",
  OUTBID: "danger",
  PENDING: "warning",
  WON: "success",
  LOST: "ended",
  CANCELLED: "neutral",
};

export function MyAwardsPage() {
  return <Suspense fallback={<LoadingRows label="Carregando arremates" />}><AwardsContent /></Suspense>;
}

function AwardsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("aba") === "historico" ? "historico" : params.get("aba") === "participacoes" ? "participacoes" : "arremates";
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const awards = useQuery({ queryKey: ["me", "awards", page], queryFn: () => listAwards(page), enabled: tab === "arremates" });
  const participations = useQuery({ queryKey: ["me", "participations", page], queryFn: () => listParticipations(page), enabled: tab !== "arremates" });
  function navigate(next: string, nextPage = 1) { router.replace(`/meus-arremates?aba=${next}&page=${nextPage}`, { scroll: false }); }
  const active = tab === "arremates" ? awards : participations;
  const pages = Math.max(1, Math.ceil((active.data?.total ?? 0) / 8));
  return (
    <PageShell title="Meus arremates" description="Seus arremates com comprovante e as disputas em que você deu lance.">
      <div className="flex flex-col gap-6">
        <Tabs value={tab} onValueChange={(value) => navigate(value)}><TabsList aria-label="Meus leilões"><TabsTrigger value="arremates">Arremates</TabsTrigger><TabsTrigger value="participacoes">Participações</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList></Tabs>
        <Card>
          <CardHeader><CardTitle>{tab === "arremates" ? "Arrematados" : tab === "historico" ? "Histórico" : "Participações"}</CardTitle></CardHeader>
          <CardContent>
            {active.isPending ? <LoadingRows label="Carregando leilões" rows={3} /> : active.isError ? <ErrorState message="Não foi possível carregar seus leilões." onRetry={() => void active.refetch()} /> : active.data.items.length === 0 ? <EmptyState title={tab === "arremates" ? "Nenhum arremate ainda" : "Você ainda não participou de leilões"} description="Os lotes em que você der lance aparecem aqui." action={<Button asChild variant="outline"><Link href="/">Ver vitrine</Link></Button>} /> : tab === "arremates" && awards.data ? <ul className="grid gap-4 md:grid-cols-2">{awards.data.items.map((award) => <AwardCard key={award.lotId} award={award} />)}</ul> : <ParticipationsTable rows={participations.data?.items ?? []} />}
            {active.data && active.data.total > 8 ? <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate(tab, page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate(tab, page + 1)}>Próxima</Button></div></div> : null}
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

      <ArtworkImage src={award.imageUrl} alt="" width={80} height={80} sizes="80px" className="size-20 rounded-md object-cover" />
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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lote</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Resultado</TableHead>
          <TableHead className="text-right">Seu maior lance</TableHead>
          <TableHead className="text-right">Atual / final</TableHead>
          <TableHead>Término</TableHead>
          <TableHead><span className="sr-only">Ação</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.lotId}>
            <TableCell className="font-medium"><div className="flex items-center gap-3"><ArtworkImage src={row.imageUrl} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-sm object-contain" /><span>{row.title}</span></div></TableCell>
            <TableCell><LotStateBadge state={row.state} /></TableCell>
            <TableCell><Badge variant={OUTCOME_VARIANT[row.outcome]}>{outcomeLabel(row.outcome)}</Badge></TableCell>
            <TableCell className="text-right">{formatBrl(row.myTopCents)}{row.myBids?.length ? <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Seus lances ({row.myBids.length})</summary><ul className="flex flex-col gap-1 pt-2">{row.myBids.map((bid, index) => <li key={`${bid.acceptedAt}-${index}`}>{formatBrl(bid.amountCents)} · {formatBrt(bid.acceptedAt)}</li>)}</ul></details> : null}</TableCell>
            <TableCell className="text-right">{row.currentCents ? formatBrl(row.currentCents) : "—"}</TableCell>
            <TableCell>{formatBrt(row.endsAt)}</TableCell>
            <TableCell className="text-right">
              {row.outcome === "WON" && row.receiptToken ? (
                <Link href={`/comprovantes/${row.receiptToken}`} className="inline-flex min-h-11 items-center text-sm font-medium">Comprovante</Link>
              ) : (
                <Link href={`/lotes/${row.lotId}`} className="inline-flex min-h-11 items-center text-sm font-medium">Abrir sala</Link>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
