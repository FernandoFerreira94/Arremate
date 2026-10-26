"use client";

import { ArtworkImage } from "@/components/app/artwork-image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2Icon, ChevronRightIcon, InfoIcon, LockIcon, PlusIcon, WalletIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { PageShell } from "@/components/app/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listParticipations } from "../awards/awards-api";
import { getWallet, type WalletView } from "./wallet-api";

import { DepositForm } from "./deposit-form";
import { WalletLedger } from "./wallet-ledger";

export { validateDeposit } from "./deposit-rules";

export function WalletPage() {
  return <Suspense fallback={<LoadingRows label="Carregando carteira" />}><WalletContent /></Suspense>;
}

function subscribeMobile(onChange: () => void): () => void {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function WalletContent() {
  const params = useSearchParams();
  const router = useRouter();
  const method = params.get("aba") === "cartao" ? "CARD" : "PIX";
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 1023px)").matches, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const depositRequested = params.get("aba") === "pix" || params.get("aba") === "cartao";
  const sheetOpen = mobile && (mobileOpen || (depositRequested && dismissed !== params.toString()));
  function changeSheet(open: boolean) { setMobileOpen(open); setDismissed(open ? null : params.toString()); }
  const setMethod = (next: "PIX" | "CARD") => router.replace(`/carteira?aba=${next === "CARD" ? "cartao" : "pix"}`, { scroll: false });
  const client = useQueryClient();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const participations = useQuery({ queryKey: ["me", "participations", 1], queryFn: () => listParticipations(1) });
  const leading = (participations.data?.items ?? []).filter((row) => row.outcome === "LEADING");

  return (
    <PageShell title="Minha carteira" description="Saldo simulado · pagamentos por Pix ou cartão de teste, sem cobrança real.">
      {params.get("conta") === "criada" ? <Alert variant="success" className="mb-6"><CheckCircle2Icon /><p role="status">Conta criada. Adicione saldo simulado para dar lances.</p></Alert> : null}
      <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-12 lg:pb-0">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          {wallet.isPending ? (
            <LoadingRows label="Carregando saldos" rows={1} />
          ) : wallet.isError ? (
            <ErrorState message="Não foi possível carregar a carteira." onRetry={() => void wallet.refetch()} />
          ) : (
            <Balances wallet={wallet.data} />
          )}
          <WalletLedger />
          <Alert variant="info">
            <InfoIcon />
            <div>
              <p className="font-medium">Como funciona o comprometido</p>
              <p>Ao liderar um lote, o valor integral do seu lance fica reservado. Se alguém cobrir, ele volta na hora ao disponível. Ao arrematar, é debitado do total.</p>
            </div>
          </Alert>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Onde seu saldo está comprometido</CardTitle>
              <span className="text-xs text-muted-foreground">{leading.length} {leading.length === 1 ? "lote" : "lotes"}</span>
            </CardHeader>
            <CardContent>
              {participations.isPending ? (
                <LoadingRows label="Carregando lotes liderados" rows={2} />
              ) : participations.isError ? (
                <ErrorState message="Não foi possível carregar os lotes liderados." onRetry={() => void participations.refetch()} />
              ) : leading.length === 0 ? (
                <EmptyState title="Nada comprometido" description="Quando você liderar um lote, o valor reservado aparece aqui." action={<Button asChild variant="outline"><Link href="/">Ver lotes ao vivo</Link></Button>} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Comprometido</TableHead>
                      <TableHead><span className="sr-only">Ação</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leading.map((row) => (
                      <TableRow key={row.lotId}>
                        <TableCell>
                          <div className="flex items-center gap-3">

                            <ArtworkImage src={row.imageUrl} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-sm object-cover" />
                            <span className="font-medium">{row.title}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="success">Liderando</Badge></TableCell>
                        <TableCell className="text-right font-medium">{formatBrl(row.myTopCents)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/lotes/${row.lotId}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">Abrir sala <ChevronRightIcon className="size-4" /></Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="hidden lg:col-span-4 lg:block">
          <Card className="sticky top-24">
            <CardContent>
              <DepositForm method={method} onMethod={setMethod} onDone={(view) => client.setQueryData(["wallet"], view)} />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden" data-testid="carteira-barra-deposito">
        <Sheet open={sheetOpen} onOpenChange={changeSheet}>
          <SheetTrigger asChild>
            <Button size="lg" className="w-full"><PlusIcon /> Adicionar saldo</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto lg:hidden">
            <SheetTitle className="sr-only">Adicionar saldo</SheetTitle>
            <SheetDescription className="sr-only">Depósito simulado</SheetDescription>
            <DepositForm method={method} onMethod={setMethod} onDone={(view) => client.setQueryData(["wallet"], view)} />
          </SheetContent>
        </Sheet>
      </div>
    </PageShell>
  );
}

function Balances({ wallet }: { wallet: WalletView }) {
  const cards = [
    { key: "available", label: "Disponível", value: wallet.availableCents, note: "Total − comprometido · usado para novos lances", icon: CheckCircle2Icon, highlight: true },
    { key: "total", label: "Saldo total", value: wallet.totalCents, note: "Tudo o que você depositou, menos arremates pagos", icon: WalletIcon, highlight: false },
    { key: "committed", label: "Comprometido", value: wallet.committedCents, note: "Reservado nos lotes em que você lidera", icon: LockIcon, highlight: false },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
      {cards.map((card) => (
        <Card key={card.key} className={cn(card.highlight && "border-primary ring-1 ring-primary sm:order-last")}>
          <CardContent className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><card.icon className="size-4" aria-hidden />{card.label}</p>
            <p className="break-words font-serif text-[28px] font-semibold tabular-nums sm:text-2xl xl:text-[28px]" data-testid={`saldo-${card.key}`}>{formatBrl(card.value)}</p>
            <p className="text-xs text-muted-foreground">{card.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

