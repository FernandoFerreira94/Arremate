"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HelpCircleIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { ErrorState, LoadingRows } from "@/components/app/page-states";
import { PageShell } from "@/components/app/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEMO_MODE } from "@/demo/seed";
import { formatBrt } from "@/lib/datetime";
import { formatBrl } from "@/lib/money";
import { getAudit, getBids, type AuditView } from "./lots-api";

const PAGE = 50;

export function AuditStatusAlert({ status, message }: { status: AuditView["status"]; message: string }) {
  if (status === "INTACT") return <Alert className="border-success/30 bg-success-soft"><ShieldCheckIcon /><p><strong>Íntegro.</strong> A cadeia de lances confere com a testemunha. {message}</p></Alert>;
  if (status === "TAMPERED") return <Alert variant="destructive"><ShieldAlertIcon /><p><strong>Adulterado.</strong> O histórico não confere com a cadeia registrada. {message}</p></Alert>;
  return <Alert><HelpCircleIcon /><p><strong>Indeterminado.</strong> Não foi possível concluir a verificação agora. {message}</p></Alert>;
}

/** Modo demo: altera um lance "direto no banco" (sem refazer a cadeia) para mostrar a detecção, e desfaz. */
function DemoTamperControls({ lotId, tampered, onChange }: { lotId: string; tampered: boolean; onChange: () => void }) {
  const run = async (action: "tamper" | "restore") => {
    const demo = await import("@/demo/client");
    if (action === "tamper") demo.tamperDemoLot(lotId);
    else demo.restoreDemoLot(lotId);
    onChange();
  };
  return tampered ? (
    <Button variant="outline" size="sm" onClick={() => void run("restore")}>Desfazer adulteração</Button>
  ) : (
    <Button variant="destructive" size="sm" onClick={() => void run("tamper")}>Simular adulteração no banco</Button>
  );
}

export function AuditPage({ lotId }: { lotId: string }) {
  const [page, setPage] = useState(1);
  const audit = useQuery({ queryKey: ["lot", lotId, "audit"], queryFn: () => getAudit(lotId) });
  // A página do histórico fica presa à revisão verificada; revisão nova reinicia a consulta.
  const revision = audit.data?.revision ?? null;
  // Auditoria item 4: lote apagado do banco (LOT_REMOVED) não tem histórico para listar.
  const removed = audit.data?.reasonCode === "LOT_REMOVED";
  const bids = useQuery({ queryKey: ["lot", lotId, "audit-bids", revision, page], queryFn: () => getBids(lotId, page, PAGE), enabled: audit.isSuccess && !removed });
  const pages = bids.data ? Math.max(1, Math.ceil(bids.data.total / PAGE)) : 1;

  return (
    <PageShell
      title="Auditoria pública"
      description="Qualquer pessoa pode conferir o histórico deste lote, sem login. Nenhum dado pessoal é exibido."
      action={<Button asChild variant="outline"><Link href={`/lotes/${lotId}`}>Voltar à sala</Link></Button>}
    >
      <div className="flex flex-col gap-6">
        {audit.isPending ? (
          <LoadingRows label="Verificando a cadeia" rows={1} />
        ) : audit.isError ? (
          <ErrorState message="Não foi possível verificar este lote agora." onRetry={() => void audit.refetch()} />
        ) : (
          <>
            <AuditStatusAlert status={audit.data.status} message={audit.data.message} />
            <p className="text-xs text-muted-foreground">
              Verificado em {formatBrt(audit.data.verifiedAt)}{audit.data.revision !== null ? ` · revisão ${audit.data.revision}` : ""}{audit.data.count !== null ? ` · ${audit.data.count} registro(s)` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPage(1); void audit.refetch(); }}>Verificar de novo</Button>
              {DEMO_MODE && !removed ? <DemoTamperControls lotId={lotId} tampered={audit.data.status === "TAMPERED"} onChange={() => { setPage(1); void audit.refetch(); void bids.refetch(); }} /> : null}
            </div>
          </>
        )}
        <Card>
          <CardHeader><CardTitle>Histórico completo</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {removed ? (
              <p className="text-sm text-muted-foreground">O lote foi apagado do banco, mas a testemunha da auditoria continua registrando {audit.data?.count ?? 0} lance(s). Não há histórico para mostrar.</p>
            ) : bids.isPending ? (
              <LoadingRows label="Carregando histórico" />
            ) : bids.isError ? (
              <ErrorState message="Não foi possível carregar o histórico." onRetry={() => void bids.refetch()} />
            ) : bids.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem lances registrados.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Seq.</TableHead><TableHead>Licitante</TableHead><TableHead className="text-right">Lance</TableHead><TableHead className="text-right">Aceito em</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bids.data.items.map((bid) => (
                    <TableRow key={bid.sequence}><TableCell>#{bid.sequence}</TableCell><TableCell>{bid.alias}</TableCell><TableCell className="text-right tabular-nums">{formatBrl(bid.amountCents)}</TableCell><TableCell className="text-right text-xs">{formatBrt(bid.acceptedAt)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {pages > 1 ? (
              <nav aria-label="Paginação" className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className="text-sm">{page} de {pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </nav>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
