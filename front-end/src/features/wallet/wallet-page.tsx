"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState } from "react";
import { CheckCircle2Icon, ChevronRightIcon, InfoIcon, LockIcon, PlusIcon, WalletIcon } from "lucide-react";
import { MoneyInput } from "@/components/app/money-input";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-error";
import { createIdempotentAction } from "@/lib/idempotent-action";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listParticipations } from "../awards/awards-api";
import { deposit, getWallet, type WalletView } from "./wallet-api";

const MIN_DEPOSIT = BigInt(100);
const MAX_DEPOSIT = BigInt(10000000);
const SHORTCUTS = [{ label: "R$ 1.000", value: "1.000" }, { label: "R$ 5.000", value: "5.000" }, { label: "R$ 10.000", value: "10.000" }];

export function validateDeposit(text: string): { ok: true; cents: string } | { ok: false; message: string } {
  const parsed = parseBrlInput(text);
  if (!parsed.ok) return parsed;
  const cents = BigInt(parsed.cents);
  if (cents < MIN_DEPOSIT || cents > MAX_DEPOSIT) return { ok: false, message: "Entre R$ 1,00 e R$ 100.000,00 por depósito." };
  return parsed;
}

export function WalletPage() {
  const client = useQueryClient();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const participations = useQuery({ queryKey: ["me", "participations", 1], queryFn: () => listParticipations(1) });
  const leading = (participations.data?.items ?? []).filter((row) => row.outcome === "LEADING");

  return (
    <PageShell title="Minha carteira" description="Saldo simulado da demonstração. Sem Pix, cartão ou dados bancários.">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {wallet.isPending ? (
            <LoadingRows label="Carregando saldos" rows={1} />
          ) : wallet.isError ? (
            <ErrorState message="Não foi possível carregar a carteira." onRetry={() => void wallet.refetch()} />
          ) : (
            <Balances wallet={wallet.data} />
          )}
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
                            {/* eslint-disable-next-line @next/next/no-img-element -- mídia local persistida pela API */}
                            <img src={row.imageUrl} alt="" className="size-10 rounded-sm object-cover" />
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
              <DepositForm onDone={(view) => client.setQueryData(["wallet"], view)} />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card p-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="w-full"><PlusIcon /> Adicionar saldo</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetTitle className="sr-only">Adicionar saldo</SheetTitle>
            <SheetDescription className="sr-only">Depósito simulado</SheetDescription>
            <DepositForm onDone={(view) => client.setQueryData(["wallet"], view)} />
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
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.key} className={cn(card.highlight && "border-primary ring-1 ring-primary sm:order-last")}>
          <CardContent className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><card.icon className="size-4" aria-hidden />{card.label}</p>
            <p className="font-serif text-[28px] font-semibold tabular-nums" data-testid={`saldo-${card.key}`}>{formatBrl(card.value)}</p>
            <p className="text-xs text-muted-foreground">{card.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DepositForm({ onDone }: { onDone: (view: WalletView) => void }) {
  const amountId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: "success" | "error" | "unknown"; message: string } | null>(null);
  const action = useMemo(() => createIdempotentAction((cents, key) => deposit(cents, key)), []);
  const mutation = useMutation({
    mutationFn: (cents: string) => action.run(cents),
    onSuccess: (view, cents) => {
      onDone(view);
      setResult({ kind: "success", message: `Depósito de ${formatBrl(cents)} confirmado.` });
      setText("");
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.statusCode === 0 || error.statusCode >= 500)) {
        setResult({ kind: "unknown", message: "Não confirmamos o depósito. Tente de novo: o mesmo pedido não é creditado duas vezes." });
      } else {
        setResult({ kind: "error", message: error instanceof ApiError ? error.message : "Não foi possível depositar." });
      }
      void client.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateDeposit(text);
    if (!checked.ok) {
      setFieldError(checked.message);
      return;
    }
    setFieldError(undefined);
    setResult(null);
    setConfirming(checked.cents);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold">Adicionar saldo</h2>
        <Badge variant="warning">Simulado</Badge>
      </div>
      <CardDescription>Dinheiro fictício para a demonstração. Sem Pix, cartão e dados bancários.</CardDescription>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={amountId}>Valor (R$)</Label>
        <MoneyInput id={amountId} value={text} onChange={setText} error={fieldError} hint="Entre R$ 1,00 e R$ 100.000,00 por depósito" disabled={mutation.isPending} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SHORTCUTS.map((shortcut) => (
          <Button key={shortcut.value} type="button" variant="outline" size="sm" onClick={() => setText(shortcut.value)} disabled={mutation.isPending}>
            {shortcut.label}
          </Button>
        ))}
      </div>
      <Button ref={submitRef} type="submit" size="lg" disabled={mutation.isPending}>
        <PlusIcon /> {mutation.isPending ? "Depositando…" : "Adicionar saldo"}
      </Button>
      {result ? (
        <Alert variant={result.kind === "success" ? "success" : result.kind === "unknown" ? "warning" : "destructive"}>
          {result.kind === "success" ? <CheckCircle2Icon /> : <InfoIcon />}
          <p>{result.message}</p>
        </Alert>
      ) : null}
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            submitRef.current?.focus();
          }}
        >
          <AlertDialogTitle>Confirmar depósito simulado</AlertDialogTitle>
          <AlertDialogDescription>
            Adicionar {confirming ? formatBrl(confirming) : ""} ao seu saldo. É dinheiro fictício, só para a demonstração.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) mutation.mutate(confirming);
                setConfirming(null);
              }}
            >
              Confirmar depósito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
