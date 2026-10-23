"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LinkIcon, PrinterIcon } from "lucide-react";
import { ErrorState, LoadingRows } from "@/components/app/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-error";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { AuditStatusAlert } from "./audit-page";
import { getReceipt } from "./lots-api";

export function ReceiptPage({ token }: { token: string }) {
  const receipt = useQuery({ queryKey: ["receipt", token], queryFn: () => getReceipt(token), retry: false });
  const [copied, setCopied] = useState<string | null>(null);

  if (receipt.isPending) return <LoadingRows label="Carregando comprovante" rows={3} />;
  if (receipt.isError) {
    const missing = receipt.error instanceof ApiError && receipt.error.statusCode === 404;
    return <ErrorState message={missing ? "Comprovante não encontrado. Confira o link recebido." : "Não foi possível carregar o comprovante."} onRetry={missing ? undefined : () => void receipt.refetch()} />;
  }
  const r = receipt.data;
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("Link copiado.");
    } catch {
      setCopied("Não foi possível copiar; copie pela barra de endereço.");
    }
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Badge variant="warning" className="self-start">Simulação · sem valor fiscal ou de compra</Badge>
        <h1 className="text-3xl lg:text-[40px] lg:leading-tight">Comprovante de arremate</h1>
        <p className="text-sm text-muted-foreground">Código {r.code}</p>
      </div>
      <AuditStatusAlert status={r.audit.status} message={r.valid ? "" : "Este comprovante não deve ser considerado válido enquanto a verificação não for íntegra."} />
      <Card>
        <CardHeader><CardTitle>{r.artwork.title}</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
          <img src={r.artwork.imageUrl} alt={`${r.artwork.title}, ${r.artwork.artist}`} className="w-full rounded-md bg-muted object-cover" />
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Artista</dt><dd>{r.artwork.artist}</dd>
            <dt className="text-muted-foreground">Arrematante</dt><dd>{r.winnerAlias}</dd>
            <dt className="text-muted-foreground">Vendedor</dt><dd>{r.sellerAlias}</dd>
            <dt className="text-muted-foreground">Valor (simulado)</dt><dd className="font-semibold tabular-nums">{formatBrl(r.amountCents)}</dd>
            <dt className="text-muted-foreground">Encerrado</dt><dd>{formatBrt(r.endsAt)}</dd>
            <dt className="text-muted-foreground">Liquidado</dt><dd>{formatBrt(r.settledAt)}</dd>
            <dt className="text-muted-foreground">Crédito</dt><dd className="text-xs">{r.artwork.credit} · {r.artwork.license}</dd>
          </dl>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => void copy()}><LinkIcon /> Copiar link</Button>
        <Button variant="outline" onClick={() => window.print()}><PrinterIcon /> Imprimir</Button>
        <Button asChild variant="outline"><Link href={`/lotes/${r.lotId}/auditoria`}>Ver auditoria do lote</Link></Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{copied}</p>
    </div>
  );
}
