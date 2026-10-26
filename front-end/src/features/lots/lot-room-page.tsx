"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon, FlaskConicalIcon, GavelIcon, ShieldCheckIcon, WifiOffIcon } from "lucide-react";
import { LotStateBadge } from "@/components/app/lot-state-badge";
import { FavoriteButton } from "../favorites/favorite-button";
import { WatchButton } from "../notifications/watch-button";
import { MoneyInput } from "@/components/app/money-input";
import { ErrorState, LoadingRows } from "@/components/app/page-states";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listParticipations } from "@/features/awards/awards-api";
import { useSession } from "@/features/auth/use-session";
import { getWallet } from "@/features/wallet/wallet-api";
import { ApiError } from "@/lib/api-error";
import { formatBrt } from "@/lib/datetime";
import { createIdempotentAction } from "@/lib/idempotent-action";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { useLotChannel } from "@/lib/realtime";
import { bidsKey, getBids, getLot, lotKey, placeBid, SIMULATED_LABEL, type PublicLot } from "./lots-api";
import { ArtworkZoom } from "./artwork-zoom";
import { LotDetailRows } from "./lot-details";
import { RecentBidsTrigger } from "./recent-bids";
import { becameOutbid, bidShortcuts, clockOffset, confirmationHolds, insufficientBalanceMessage, formatCountdown, rankByBidder, remainingMs } from "./room-logic";
import { useNow } from "./showcase-page";
import { messageOf, notifyError, notifySuccess, notifyWarning } from "@/lib/notify";

const plain = (cents: string) => formatBrl(cents).replace(/^R\$\s?/, "");

export function LotRoomPage({ lotId }: { lotId: string }) {
  const client = useQueryClient();
  const lot = useQuery({ queryKey: lotKey(lotId), queryFn: () => getLot(lotId) });
  const bids = useQuery({ queryKey: bidsKey(lotId, 1), queryFn: () => getBids(lotId, 1, 100) });
  const session = useSession();
  const isBidder = session.data?.role === "BIDDER";
  const participations = useQuery({ queryKey: ["me", "participations", 1], queryFn: () => listParticipations(1), enabled: isBidder });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet, enabled: isBidder });

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["lot", lotId] });
    if (isBidder) {
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["me"] });
    }
  }, [client, lotId, isBidder]);
  const channel = useLotChannel(lotId, refresh);
  const now = useNow();

  // QA N4: o sino filtra o lote da sala aberta; aqui o toast sai do snapshot refeito pelo evento ao vivo.
  const myRow = participations.data?.items.find((row) => row.lotId === lotId);
  const lastOutcome = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!myRow) return;
    if (becameOutbid(lastOutcome.current, myRow.outcome)) {
      notifyWarning("Você foi superado", `Seu lance de ${formatBrl(myRow.myTopCents ?? "0")} foi coberto e voltou para o disponível.`);
    }
    lastOutcome.current = myRow.outcome;
  }, [myRow]);

  if (lot.isPending) return <LoadingRows label="Carregando lote" rows={4} />;
  if (lot.isError) {
    const missing = lot.error instanceof ApiError && lot.error.statusCode === 404;
    return <ErrorState message={missing ? "Lote não encontrado." : "Não foi possível carregar o lote."} onRetry={missing ? undefined : () => void lot.refetch()} />;
  }
  const data = lot.data;
  const offset = clockOffset(data.serverNow, lot.dataUpdatedAt);
  const left = remainingMs(data.state === "SCHEDULED" ? data.startsAt : data.endsAt, now, offset);
  const mine = myRow ?? null;
  const ranking = rankByBidder(bids.data?.items ?? []);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Trilha" className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">Vitrine</Link> / {data.title}
      </nav>
      {channel === "degraded" ? (
        <Alert className="items-center"><WifiOffIcon /><p>Reconectando… os dados podem estar até 10 s desatualizados. Lances continuam sendo validados pelo servidor.</p></Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <figure>
            <ArtworkZoom src={data.imageUrl} zoomSrc={`/api/media/zoom/${encodeURIComponent(data.externalId)}`} alt={`${data.title}, ${data.artist}`} title={data.title} credit={`${data.credit} · ${data.license}`} />
            <figcaption className="mt-2 text-xs text-muted-foreground">{data.credit} · {data.license}</figcaption>
          </figure>
          <AboutCard lot={data} />
          <ConditionCard lot={data} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <LotStateBadge state={data.state} />
              <FavoriteButton lotId={data.id} title={data.title} variant="outline" />
            </div>
            <h1 className="mt-2 text-3xl lg:text-[40px] lg:leading-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground">{[data.artist, data.date].filter(Boolean).join(" · ")}</p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{data.currentCents ? "Lance atual" : "Lance inicial"}</p>
                  <p className="font-serif text-4xl font-semibold tabular-nums" data-testid="current-price">{formatBrl(data.currentCents ?? data.initialCents)}</p>
                  {data.state === "LIVE" ? <p className="text-sm text-muted-foreground">Próximo lance mínimo {formatBrl(data.minimumNextCents)}</p> : null}
                </div>
                {data.state === "LIVE" || data.state === "SCHEDULED" ? (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{data.state === "LIVE" ? "Termina em" : "Abre em"}</p>
                    <p className="font-serif text-3xl tabular-nums" aria-hidden>{formatCountdown(left)}</p>
                    <p className="text-xs text-muted-foreground">{formatBrt(data.state === "LIVE" ? data.endsAt : data.startsAt)}</p>
                  </div>
                ) : null}
              </div>
              {data.state === "LIVE" && left > 0 && left <= 120_000 ? (
                <Badge variant="warning">Reta final: lance agora prorroga para 2 min</Badge>
              ) : null}
              <MyStatus outcome={mine?.outcome ?? null} myTopCents={mine?.myTopCents ?? null} />
              <ResultBanner lot={data} />
              {data.state === "SCHEDULED" ? <WatchButton lotId={data.id} title={data.title} /> : null}
            </CardContent>
          </Card>
          {data.state === "LIVE" ? (
            session.isPending ? null : isBidder ? (
              <BidForm lot={data} availableCents={wallet.data?.availableCents ?? null} onDone={refresh} />
            ) : session.data ? (
              <Alert><p>Leiloeiros acompanham a sala, mas não dão lances.</p></Alert>
            ) : (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <p className="font-semibold">Visitante</p>
                  <p className="text-sm text-muted-foreground">Entre com uma conta de licitante para dar lances.</p>
                  <Button asChild><Link href={`/entrar?returnTo=${encodeURIComponent(`/lotes/${lotId}`)}`}>Entrar para dar lance</Link></Button>
                </CardContent>
              </Card>
            )
          ) : null}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de lances</CardTitle>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><RecentBidsTrigger lotId={lotId} bidCount={data.bidCount} title={data.title} /> · {ranking.length} licitante(s)</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div aria-live="polite" className="sr-only">{data.currentCents ? `Lance atual ${formatBrl(data.currentCents)}` : ""}</div>
              {bids.isError ? (
                <ErrorState message="Não foi possível carregar o histórico." onRetry={() => void bids.refetch()} />
              ) : (bids.data?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lances ainda.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>Pos.</TableHead><TableHead>Licitante</TableHead><TableHead className="text-right">Maior lance</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {ranking.map((row) => (
                        <TableRow key={row.alias}><TableCell>{row.position}º</TableCell><TableCell>{row.alias}</TableCell><TableCell className="text-right tabular-nums">{formatBrl(row.amountCents)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Table>
                    <TableHeader><TableRow><TableHead>Seq.</TableHead><TableHead>Licitante</TableHead><TableHead className="text-right">Lance</TableHead><TableHead className="text-right">Hora</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(bids.data?.items ?? []).slice(0, 10).map((bid) => (
                        <TableRow key={bid.sequence}><TableCell>#{bid.sequence}</TableCell><TableCell>{bid.alias}</TableCell><TableCell className="text-right tabular-nums">{formatBrl(bid.amountCents)}</TableCell><TableCell className="text-right text-xs">{formatBrt(bid.acceptedAt)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
              <Button asChild variant="outline" size="sm" className="self-end">
                <Link href={`/lotes/${lotId}/auditoria`}><ShieldCheckIcon /> Auditoria pública</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AboutCard({ lot }: { lot: PublicLot }) {
  return (
    <Card>
      <CardHeader><CardTitle>Sobre o lote</CardTitle></CardHeader>
      <CardContent>
        <LotDetailRows lot={lot} />
        {lot.sourceUrl ? (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={lot.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /> Ver no The Met</a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConditionCard({ lot }: { lot: PublicLot }) {
  if (!lot.conditionReport) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Laudo de conservação</CardTitle>
        <Badge variant="warning">{SIMULATED_LABEL}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{lot.conditionReport.text}</p>
      </CardContent>
    </Card>
  );
}

function MyStatus({ outcome, myTopCents }: { outcome: string | null; myTopCents: string | null }) {
  if (outcome === "LEADING") return <Alert className="border-success/30 bg-success-soft"><CheckCircle2Icon /><p>Você está ganhando. Seu lance de {formatBrl(myTopCents ?? "0")} está comprometido na carteira.</p></Alert>;
  if (outcome === "OUTBID") return <Alert variant="destructive"><AlertTriangleIcon /><p>Você foi superado. Seu lance de {formatBrl(myTopCents ?? "0")} voltou para o disponível.</p></Alert>;
  return null;
}

function ResultBanner({ lot }: { lot: PublicLot }) {
  if (lot.state === "CANCELLED") return <Alert><p>Este lote foi cancelado pelo leiloeiro antes de receber lances.</p></Alert>;
  if (lot.state !== "ENDED") return null;
  if (lot.result === "CLOSED_PENDING" || lot.settlementPending) return <Alert><p>Encerrado. Apurando o resultado… o comprovante aparece em instantes.</p></Alert>;
  if (lot.result === "CLOSED_NO_BIDS") return <Alert><p>Encerrado sem vencedor: nenhum lance foi dado.</p></Alert>;
  return <Alert><GavelIcon /><p>Encerrado. Arrematado por {formatBrl(lot.currentCents ?? "0")}.</p></Alert>;
}

function BidForm({ lot, availableCents, onDone }: { lot: PublicLot; availableCents: string | null; onDone: () => void }) {
  const id = useId();
  const [text, setText] = useState(plain(lot.minimumNextCents));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ text: string; cents: string } | null>(null);
  const [short, setShort] = useState(false);
  // QA N1: a confirmação local some assim que o lance atual (vindo do SSE) passa do valor confirmado.
  const notice = confirmed && confirmationHolds(confirmed.cents, lot.currentCents) ? confirmed.text : null;
  const action = useMemo(() => createIdempotentAction((cents, key) => placeBid(lot.id, cents, key)), [lot.id]);
  const mutation = useMutation({
    mutationFn: (cents: string) => action.run(cents),
    onSuccess: (accepted, cents) => {
      setConfirm(null);
      setError(null);
      setConfirmed({ text: accepted.extended ? "Lance confirmado. O prazo foi prorrogado." : "Lance confirmado. Você está ganhando.", cents });
      notifySuccess(messageOf(accepted, "Lance registrado."), { id: "lance" });
      onDone();
    },
    onError: (failure) => {
      setConfirm(null);
      setConfirmed(null);
      setError(failure instanceof ApiError ? failure.message : "Não conseguimos confirmar seu lance. Atualize o histórico antes de tentar de novo.");
      notifyError(failure, "Não conseguimos confirmar seu lance.", { id: "lance" });
      onDone();
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseBrlInput(text);
    if (!parsed.ok) return setError(parsed.message);
    if (BigInt(parsed.cents) < BigInt(lot.minimumNextCents)) return setError(`O lance mínimo agora é ${formatBrl(lot.minimumNextCents)}.`);
    if (availableCents !== null && BigInt(parsed.cents) > BigInt(availableCents)) {
      // QA MÉDIA 5: o lance acima do saldo não pode parecer um botão inerte.
      const message = insufficientBalanceMessage(parsed.cents, availableCents);
      setError(message);
      setShort(true);
      notifyWarning("Saldo insuficiente para este lance.", message);
      return;
    }
    setShort(false);
    setError(null);
    setConfirm(parsed.cents);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <label htmlFor={id} className="text-sm font-medium">Seu lance (R$)</label>
          <MoneyInput id={id} value={text} onChange={(value) => { setText(value); setShort(false); setError(null); }} error={error ?? undefined} hint={`Mínimo ${formatBrl(lot.minimumNextCents)}`} disabled={mutation.isPending} />
          <div className="grid grid-cols-3 gap-2">
            {bidShortcuts(lot.minimumNextCents, lot.incrementCents).map((cents) => (
              <Button key={cents} type="button" variant="outline" size="sm" onClick={() => setText(plain(cents))}>{formatBrl(cents)}</Button>
            ))}
          </div>
          <Button type="submit" size="lg" disabled={mutation.isPending}><GavelIcon /> {mutation.isPending ? "Enviando…" : "Dar lance"}</Button>
          {availableCents !== null ? <p className="text-xs text-muted-foreground">Disponível {formatBrl(availableCents)} · seu lance fica comprometido enquanto você lidera</p> : null}
          {short ? (
            <Alert variant="warning" data-testid="saldo-insuficiente">
              <AlertTriangleIcon />
              <div className="flex flex-col gap-2">
                <p>Seu disponível não cobre este lance. Adicione saldo simulado e volte para a sala.</p>
                <Button asChild variant="outline" size="sm" className="self-start"><Link href="/carteira">Adicionar saldo</Link></Button>
              </div>
            </Alert>
          ) : null}
          <p role="status" aria-live="polite" className="text-sm text-success">{notice}</p>
        </form>
        <AlertDialog open={confirm !== null} onOpenChange={(open) => (!open && !mutation.isPending ? setConfirm(null) : undefined)}>
          <AlertDialogContent>
            <AlertDialogTitle>Confirmar lance</AlertDialogTitle>
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
              <img src={lot.imageUrl} alt="" className="size-16 shrink-0 rounded-md bg-muted object-contain" />
              <div className="min-w-0">
                <p className="line-clamp-2 font-serif font-semibold leading-snug" title={lot.title}>{lot.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{lot.artist}</p>
              </div>
            </div>
            <AlertDialogDescription asChild>
              <div className="rounded-lg bg-muted p-4 text-center">
                <span className="block text-xs text-muted-foreground">Seu lance</span>
                <span className="block font-serif text-3xl font-semibold tabular-nums text-primary">{confirm ? formatBrl(confirm) : ""}</span>
                <span className="block text-xs text-muted-foreground">Fica comprometido na carteira enquanto você liderar</span>
              </div>
            </AlertDialogDescription>
            <p className="inline-flex items-center justify-center gap-1.5 text-xs text-warning"><FlaskConicalIcon className="size-3.5" /> Valor simulado · nenhuma cobrança real</p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                disabled={mutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (confirm) mutation.mutate(confirm);
                }}
              >
                {mutation.isPending ? "Enviando…" : "Confirmar lance"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
