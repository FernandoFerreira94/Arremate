"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2Icon, CopyIcon, CreditCardIcon, InfoIcon, Loader2Icon } from "lucide-react";
import { MoneyInput } from "@/components/app/money-input";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createIdempotentAction } from "@/lib/idempotent-action";
import { formatBrl } from "@/lib/money";
import { validateDeposit } from "./deposit-rules";
import { deposit, getCards, removeCard, useTestCard, type WalletView } from "./wallet-api";
import { messageOf, notifyError, notifySuccess } from "@/lib/notify";

const SHORTCUTS = [{ label: "R$ 1.000", value: "1.000" }, { label: "R$ 5.000", value: "5.000" }, { label: "R$ 10.000", value: "10.000" }];
export function DepositForm({ method, onMethod, onDone }: { method: "PIX" | "CARD"; onMethod: (method: "PIX" | "CARD") => void; onDone: (view: WalletView) => void }) {
  const amountId = useId();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [result, setResult] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(600);
  const cards = useQuery({ queryKey: ["wallet", "cards"], queryFn: getCards });
  const card = cards.data?.items[0];
  const checkedAmount = validateDeposit(text);
  const action = useMemo(() => createIdempotentAction((body, key) => {
    const input = JSON.parse(body) as { cents: string; method: "PIX" | "CARD"; cardId?: string };
    return deposit(input.cents, key, { method: input.method, ...(input.cardId ? { cardId: input.cardId } : {}) });
  }), []);
  const mutation = useMutation({
    mutationFn: async (body: string) => { await new Promise((resolve) => setTimeout(resolve, 1500)); return action.run(body); },
    onSuccess: (view) => { onDone(view); setResult("Pagamento simulado aprovado. Saldo atualizado."); notifySuccess(messageOf(view, "Depósito adicionado.")); void client.invalidateQueries({ queryKey: ["wallet", "entries"] }); },
    onError: (error, body) => { notifyError(error, "Não foi possível depositar.", { retry: () => mutation.mutate(body) }); setResult("Não foi possível concluir o pagamento simulado. Tente de novo: o mesmo pedido não é creditado duas vezes."); void client.invalidateQueries({ queryKey: ["wallet"] }); },
  });
  const save = useMutation({ mutationFn: useTestCard, onSuccess: (data) => { notifySuccess(messageOf(data, "Cartão de teste salvo.")); void client.invalidateQueries({ queryKey: ["wallet", "cards"] }); }, onError: (error) => notifyError(error, "Não foi possível salvar o cartão.") });
  const remove = useMutation({ mutationFn: () => removeCard(card?.id ?? ""), onSuccess: () => { setRemoving(false); notifySuccess("Cartão removido."); void client.invalidateQueries({ queryKey: ["wallet", "cards"] }); }, onError: (error) => notifyError(error, "Não foi possível remover o cartão.") });
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  function amountChanged(value: string) { setText(value); setFieldError(undefined); setResult(undefined); setExpiresAt(Date.now() + 600_000); setRemaining(600); }
  async function copy() { try { await navigator.clipboard.writeText(`DEMO-ARREMATE-${text.replace(/[^0-9]/g, "")}-SEM-VALOR`); setCopied("Código copiado."); notifySuccess("Código copiado."); } catch { setCopied("Não foi possível copiar o código."); } }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const checked = validateDeposit(text);
    if (!checked.ok) return setFieldError(checked.message);
    if (method === "CARD" && !card) return;
    if (method === "PIX" && remaining === 0) return;
    setFieldError(undefined);
    setResult(undefined);
    mutation.mutate(JSON.stringify({ cents: checked.cents, method, ...(method === "CARD" ? { cardId: card?.id } : {}) }));
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex items-center justify-between gap-2"><h2 className="font-serif text-lg font-semibold">Adicionar saldo</h2><Badge variant="warning">Simulado</Badge></div>
      <CardDescription>Dinheiro fictício para a demonstração. Pagamentos simulados, sem cobrança real.</CardDescription>
      <div className="flex flex-col gap-1.5"><Label htmlFor={amountId}>Valor (R$)</Label><MoneyInput id={amountId} value={text} onChange={amountChanged} error={fieldError} hint="Entre R$ 1,00 e R$ 100.000,00 por depósito" disabled={mutation.isPending} /></div>
      <div className="grid grid-cols-3 gap-2">{SHORTCUTS.map((shortcut) => <Button key={shortcut.value} type="button" variant="outline" size="sm" onClick={() => amountChanged(shortcut.value)} disabled={mutation.isPending}>{shortcut.label}</Button>)}</div>
      <Tabs value={method} onValueChange={(value) => onMethod(value === "CARD" ? "CARD" : "PIX")}><TabsList className="grid w-full grid-cols-2" aria-label="Método de pagamento"><TabsTrigger value="PIX" disabled={mutation.isPending}>Pix simulado</TabsTrigger><TabsTrigger value="CARD" disabled={mutation.isPending}><CreditCardIcon className="size-4" /> Cartão de teste</TabsTrigger></TabsList></Tabs>
      {method === "PIX" ? (
        <div className="flex flex-col gap-3">
          <div className="relative mx-auto rounded-md border bg-card p-3" aria-label="QR ilustrativo simulado, sem valor para pagamento">
            <svg viewBox="0 0 21 21" className="size-40 text-foreground" aria-hidden><path fill="currentColor" d="M0 0h7v7H0zm14 0h7v7h-7zM0 14h7v7H0zM8 0h2v2H8zm3 1h2v4h-2zM8 3h2v5H8zm2 5h4v2h-4zm5 0h2v3h-2zm3 0h3v2h-3zM0 8h3v2H0zm4 0h3v4H4zM1 11h2v2H1zm7 0h3v4H8zm4 0h2v2h-2zm3 2h6v2h-6zm-4 3h4v2h-4zm5 0h2v5h-2zm3 0h2v2h-2zM8 18h3v3H8zm4 1h2v2h-2zm7 0h2v2h-2z"/><path fill="var(--card)" d="M1 1h5v5H1zm14 0h5v5h-5zM1 15h5v5H1z"/><path fill="currentColor" d="M2 2h3v3H2zm14 0h3v3h-3zM2 16h3v3H2z"/></svg>
            <span className="absolute inset-x-0 top-1/2 -rotate-12 border-y border-warning bg-warning-soft p-1 text-center text-sm font-bold tracking-widest text-warning">SIMULADO</span>
          </div>
          <p className="text-center text-xs text-muted-foreground">Expira em {Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}</p>
          {remaining === 0 ? <Alert variant="warning"><p>QR expirado. Gere um novo para continuar.</p><Button type="button" variant="outline" size="sm" onClick={() => amountChanged(text)}>Gerar novo QR</Button></Alert> : null}
          <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md border p-2 text-xs">DEMO-ARREMATE-{text.replace(/[^0-9]/g, "") || "0"}-SEM-VALOR</code><Button type="button" variant="outline" size="sm" onClick={() => void copy()}><CopyIcon /> Copiar</Button></div>
          {copied ? <p role="status" className="text-xs text-muted-foreground">{copied}</p> : null}
          <p className="text-center text-xs text-muted-foreground">QR ilustrativo, não é um BR Code válido. Nenhum banco é acionado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Alert variant="info"><InfoIcon /><p>Só cartão de teste. Não há campo para digitar cartão. Nenhum número real é pedido, enviado ou guardado.</p></Alert>
          <div className="flex flex-col gap-5 rounded-lg border border-dashed bg-muted p-4"><div className="flex justify-between gap-2 text-xs"><span>CARTÃO DE TESTE</span><Badge variant="warning">Simulado</Badge></div><p className="font-semibold tracking-widest">•••• •••• •••• 4242</p><div className="flex justify-between gap-2 text-xs"><span>DEMONSTRAÇÃO ARREMATE</span><span>12/34</span></div></div>
          {cards.isError ? <Alert variant="destructive"><p>Não foi possível carregar os cartões.</p><Button variant="outline" type="button" onClick={() => void cards.refetch()}>Tentar de novo</Button></Alert> : card ? <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p className="font-medium">{card.brand} •••• {card.last4}</p><p className="text-xs text-muted-foreground">Validade {card.expiryMonth.toString().padStart(2, "0")}/{card.expiryYear.toString().slice(-2)} · guardamos só bandeira, final e validade.</p></div><Button type="button" variant="ghost" className="text-destructive" onClick={() => setRemoving(true)}>Remover</Button></div> : <Button type="button" disabled={save.isPending || cards.isPending} onClick={() => save.mutate()}><CreditCardIcon />{save.isPending ? "Salvando…" : "Usar cartão de teste"}</Button>}
          {save.isError || remove.isError ? <Alert variant="destructive"><p>Não foi possível salvar ou remover o cartão de teste. Tente de novo.</p></Alert> : null}
        </div>
      )}
      <Button type="submit" size="lg" disabled={mutation.isPending || (method === "CARD" && !card) || (method === "PIX" && remaining === 0)}>{mutation.isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}{mutation.isPending ? "Aprovando pagamento simulado…" : method === "PIX" ? "Simular pagamento aprovado" : `Pagar ${checkedAmount.ok ? formatBrl(checkedAmount.cents) : ""} com cartão de teste`}</Button>
      {result ? <Alert variant={mutation.isSuccess ? "success" : "destructive"}><p role="status">{result}</p>{mutation.isSuccess ? <Link href="/carteira?aba=extrato" className="underline">Ver extrato</Link> : null}</Alert> : null}
      <AlertDialog open={removing} onOpenChange={setRemoving}><AlertDialogContent><AlertDialogTitle>Remover cartão de teste?</AlertDialogTitle><AlertDialogDescription>Você pode adicioná-lo de novo a qualquer momento.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" disabled={remove.isPending} onClick={() => remove.mutate()}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </form>
  );
}
