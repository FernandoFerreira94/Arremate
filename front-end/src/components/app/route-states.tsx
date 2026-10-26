"use client";

import { CircleAlertIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/error-reporter";
import { LoadingRows } from "./page-states";

export function RouteLoading() {
  return <LoadingRows label="Carregando página" rows={4} />;
}

/** E1: erro inesperado dentro do layout (header e rodapé ficam). Relata uma vez e oferece reset e volta à vitrine. */
export function RouteError({ error, reset }: { error?: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (error) reportClientError(error, error.digest);
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-destructive">
        <CircleAlertIcon className="size-5" aria-hidden />
      </span>
      <h1 className="text-3xl">Algo deu errado</h1>
      <p className="text-sm text-muted-foreground">Não conseguimos abrir esta página agora. Tente de novo em instantes.</p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button onClick={reset}>
          <RotateCcwIcon /> Tentar de novo
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Voltar à vitrine</Link>
        </Button>
      </div>
      {error?.digest ? <p className="text-xs text-muted-foreground">Código de referência: <span className="font-mono">{error.digest}</span></p> : null}
    </div>
  );
}
