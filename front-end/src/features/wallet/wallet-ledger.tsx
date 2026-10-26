"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { getEntries, type EntryFilter, type WalletEntry } from "./wallet-api";

const FILTERS: { value: EntryFilter; label: string }[] = [{ value: "all", label: "Tudo" }, { value: "deposits", label: "Depósitos" }, { value: "bids", label: "Lances" }, { value: "awards", label: "Arremates" }];
function description(entry: WalletEntry) {
  if (entry.kind === "DEPOSIT") return entry.method === "CARD" ? `Depósito · Cartão de teste •••• ${entry.last4 ?? "4242"}` : entry.method === "PIX" ? "Depósito · Pix simulado" : "Depósito simulado";
  return ({ RESERVE: "Lance comprometido", RELEASE: "Liberado (superado)", SETTLEMENT_DEBIT: "Arremate", SETTLEMENT_CREDIT: "Crédito de arremate" })[entry.kind];
}
const STATUS = { DEPOSIT: "Aprovado", RESERVE: "Reservado", RELEASE: "Liberado", SETTLEMENT_DEBIT: "Debitado", SETTLEMENT_CREDIT: "Creditado" };
export function WalletLedger() {
  const params = useSearchParams();
  const router = useRouter();
  const filter = FILTERS.find((row) => row.value === params.get("filtro"))?.value ?? "all";
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("pagina") ?? "1", 10) || 1));
  const query = useQuery({ queryKey: ["wallet", "entries", page, filter], queryFn: () => getEntries(page, filter) });
  function navigate(nextFilter: EntryFilter, nextPage: number) {
    const search = new URLSearchParams(params.toString());
    search.set("aba", "extrato"); search.set("filtro", nextFilter); search.set("pagina", String(nextPage));
    router.replace(`/carteira?${search.toString()}`, { scroll: false });
  }
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 8));
  return (
    <Card id="extrato">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Extrato</CardTitle><Tabs value={filter} onValueChange={(value) => navigate(FILTERS.find((row) => row.value === value)?.value ?? "all", 1)}><TabsList aria-label="Filtrar extrato">{FILTERS.map((row) => <TabsTrigger key={row.value} value={row.value}>{row.label}</TabsTrigger>)}</TabsList></Tabs></CardHeader>
      <CardContent>
        {query.isPending ? <LoadingRows label="Carregando extrato" /> : query.isError ? <ErrorState message="Não foi possível carregar o extrato." onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState title="Nenhuma movimentação ainda" description="Depósitos, lances e arremates aparecem aqui." /> : <>
          <Table><TableHeader><TableRow><TableHead>Data (BRT)</TableHead><TableHead>Descrição</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((entry) => {
            const positive = entry.kind === "DEPOSIT" || entry.kind === "RELEASE" || entry.kind === "SETTLEMENT_CREDIT";
            return <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{formatBrt(entry.createdAt)}</TableCell><TableCell>{description(entry)}</TableCell><TableCell><Badge variant={positive ? "success" : "neutral"}>{STATUS[entry.kind]}</Badge></TableCell><TableCell className={`whitespace-nowrap text-right font-medium ${positive ? "text-success" : ""}`}>{positive ? "+" : "−"} {formatBrl(entry.amountCents)}</TableCell></TableRow>;
          })}</TableBody></Table>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate(filter, page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate(filter, page + 1)}>Próxima</Button></div></div>
        </>}
      </CardContent>
    </Card>
  );
}
