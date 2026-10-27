"use client";

import { ArtworkImage } from "@/components/app/artwork-image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2Icon, InfoIcon, PlusIcon } from "lucide-react";
import { LotStateBadge } from "@/components/app/lot-state-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { PageShell } from "@/components/app/page-shell";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBrl } from "@/lib/money";
import { cancelWithRefresh } from "./cancel-lot";
import { cancelLot, getSellerSummary, listSellerLots, SELLER_PAGE_SIZE, type LotView, type SellerState } from "./seller-api";
import { notifyErrorText, notifySuccess } from "@/lib/notify";

type Filter = "all" | SellerState;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "live", label: "Ao vivo" },
  { value: "scheduled", label: "Agendados" },
  { value: "ended", label: "Encerrados" },
  { value: "cancelled", label: "Cancelados" },
];

export function MyLotsPage() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  // Code review item 4: aba e página vão para o servidor; os totais contam todos os lotes, não só a página.
  const lots = useQuery({
    queryKey: ["seller", "lots", filter, page],
    queryFn: () => listSellerLots(page, filter === "all" ? undefined : filter),
    placeholderData: (previous) => previous,
  });
  const summary = useQuery({ queryKey: ["seller", "summary"], queryFn: getSellerSummary });
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const visible = lots.isPlaceholderData ? [] : (lots.data?.items ?? []);
  const pages = Math.max(1, Math.ceil((lots.data?.total ?? 0) / SELLER_PAGE_SIZE));
  const owned = lots.data?.counts.all ?? 0;

  async function onCancel(lot: LotView) {
    const outcome = await cancelWithRefresh(client, cancelLot, lot.id);
    setNotice(outcome.ok ? { ok: true, message: `“${lot.title}” foi cancelado e saiu da vitrine.` } : { ok: false, message: outcome.message });
    if (outcome.ok) notifySuccess("Lote cancelado.");
    else notifyErrorText(outcome.message);
  }

  return (
    <PageShell
      title="Meus lotes"
      description="Lotes próprios, inclusive cancelados."
      action={<Button asChild size="lg"><Link href="/painel/lotes/novo"><PlusIcon /> Criar lote</Link></Button>}
    >
      <div className="flex flex-col gap-6">
        {summary.isError ? (
          <ErrorState message="Não foi possível carregar o resumo." onRetry={() => void summary.refetch()} />
        ) : summary.isPending ? (
          <LoadingRows label="Carregando resumo" rows={1} />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary ring-1 ring-primary">
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Total recebido</p>
                <p className="font-serif text-[28px] font-semibold tabular-nums" data-testid="total-recebido">{formatBrl(summary.data.settledCreditCents)}</p>
                <p className="text-xs text-muted-foreground">Só liquidações concluídas · não soma disputas abertas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Lotes arrematados</p>
                <p className="font-serif text-2xl font-semibold">{summary.data.settled} de {summary.data.settled + summary.data.closedNoBids} encerrados</p>
                <p className="text-xs text-muted-foreground">{summary.data.closedNoBids} encerrado(s) sem lances{summary.data.pending > 0 ? ` · ${summary.data.pending} processando` : ""}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Em andamento</p>
                <p className="font-serif text-2xl font-semibold">{summary.data.open} aberto(s)</p>
                <p className="text-xs text-muted-foreground">{summary.data.cancelled} cancelado(s)</p>
              </CardContent>
            </Card>
          </div>
        )}
        {notice ? (
          <Alert variant={notice.ok ? "success" : "warning"}>
            {notice.ok ? <CheckCircle2Icon /> : <InfoIcon />}
            <p>{notice.message}</p>
          </Alert>
        ) : null}
        <Tabs value={filter} onValueChange={(value) => { setFilter(value as Filter); setPage(1); }} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList aria-label="Filtrar lotes" className="flex-nowrap">
            {FILTERS.map((item) => {
              const count = lots.data?.counts[item.value] ?? 0;
              return (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label} <span className="rounded-full bg-muted px-1.5 text-xs">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <Card>
          <CardContent>
            {lots.isPending || lots.isPlaceholderData ? (
              <LoadingRows label="Carregando lotes" />
            ) : lots.isError ? (
              <ErrorState message="Não foi possível carregar seus lotes." onRetry={() => void lots.refetch()} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={owned === 0 ? "Você ainda não criou lotes" : "Nenhum lote neste filtro"}
                description={owned === 0 ? "Busque uma obra de domínio público no The Met e configure o leilão." : "Escolha outro filtro para ver os demais lotes."}
                action={owned === 0 ? <Button asChild><Link href="/painel/lotes/novo"><PlusIcon /> Criar lote</Link></Button> : undefined}
              />
            ) : (
              <>
              {/* Code review item 4: no celular, cards; a tabela de 7 colunas fica para telas largas. */}
              <ul aria-label="Lotes" className="flex flex-col gap-3 md:hidden">
                {visible.map((lot) => (
                  <li key={lot.id} className="flex min-w-0 gap-3 rounded-lg border p-3">
                    <ArtworkImage src={lot.imageUrl} alt="" width={56} height={56} sizes="56px" className="size-14 shrink-0 rounded-sm object-cover" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="line-clamp-2 font-medium">{lot.title}</p>
                      <div className="flex flex-wrap items-center gap-2"><LotStateBadge state={lot.state} /><Result lot={lot} /></div>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        Inicial {formatBrl(lot.initialCents)} · {lot.currentCents ? `${lot.state === "LIVE" ? "atual" : "final"} ${formatBrl(lot.currentCents)}` : "sem lances"} · {lot.bidCount} lance(s)
                      </p>
                      <div className="self-start"><RowAction lot={lot} onCancel={onCancel} /></div>
                    </div>
                  </li>
                ))}
              </ul>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Inicial</TableHead>
                    <TableHead>Atual / final</TableHead>
                    <TableHead className="text-right">Lances</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead><span className="sr-only">Ação</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">

                          <ArtworkImage src={lot.imageUrl} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-sm object-cover" />
                          <span className="font-medium">{lot.title}</span>
                        </div>
                      </TableCell>
                      <TableCell><LotStateBadge state={lot.state} /></TableCell>
                      <TableCell>{formatBrl(lot.initialCents)}</TableCell>
                      <TableCell>{lot.currentCents ? `${formatBrl(lot.currentCents)}${lot.state === "LIVE" ? " (atual)" : ""}` : "—"}</TableCell>
                      <TableCell className="text-right">{lot.bidCount}</TableCell>
                      <TableCell><Result lot={lot} /></TableCell>
                      <TableCell className="text-right"><RowAction lot={lot} onCancel={onCancel} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pages > 1 ? (
                <nav aria-label="Paginação dos lotes" className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="tabular-nums">Página {page} de {pages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
                  </div>
                </nav>
              ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Result({ lot }: { lot: LotView }) {
  if (lot.state === "CANCELLED") return <span className="text-xs text-muted-foreground">Fora da vitrine</span>;
  if (lot.state !== "ENDED") return <span aria-label="Sem resultado ainda">—</span>;
  if (lot.settlementPending) return <Badge variant="warning">Processando resultado</Badge>;
  if (lot.bidCount === 0) return <Badge variant="neutral">Sem lances</Badge>;
  return <Badge variant="success">Arrematado · recebido</Badge>;
}

function RowAction({ lot, onCancel }: { lot: LotView; onCancel: (lot: LotView) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const cancellable = lot.bidCount === 0 && (lot.state === "LIVE" || lot.state === "SCHEDULED");
  if (cancellable) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={busy}>{busy ? "Cancelando…" : "Cancelar"}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Cancelar “{lot.title}”?</AlertDialogTitle>
          <AlertDialogDescription>O lote sai da vitrine e não pode ser reaberto. Só é possível enquanto não houver lances.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter lote</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90"
              onClick={() => {
                setBusy(true);
                void onCancel(lot).finally(() => setBusy(false));
              }}
            >
              Cancelar lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (lot.state === "LIVE" || lot.state === "SCHEDULED") return <Link href={`/lotes/${lot.id}`} className="inline-flex min-h-11 items-center text-sm font-medium">Abrir sala</Link>;
  if (lot.state === "ENDED") return <Link href={`/lotes/${lot.id}/auditoria`} className="inline-flex min-h-11 items-center text-sm font-medium">Auditoria</Link>;
  return null;
}
