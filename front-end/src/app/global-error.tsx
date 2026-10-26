"use client";

import Image from "next/image";
import { useEffect } from "react";
import { reportClientError } from "@/lib/error-reporter";
import "./globals.css";

/**
 * E1: falha no layout raiz. Página autossuficiente (sem header, rodapé nem Providers). O reset do Next não basta
 * aqui, então "Tentar de novo" recarrega a página (G2).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, error.digest);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 font-sans text-foreground antialiased">
        <main role="alert" className="flex max-w-lg flex-col items-center gap-3 text-center">
          <p className="mb-6 inline-flex items-center" aria-label="Arremate">
            <Image src="/brand/l3-horizontal-paper.svg" alt="" width={135} height={32} className="h-8 w-auto" />
          </p>
          <h1 className="font-serif text-3xl font-semibold">O Arremate não carregou</h1>
          <p className="text-sm text-muted-foreground">Recarregue a página. Se continuar, volte mais tarde.</p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              Tentar de novo
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- o layout raiz falhou: navegação completa de propósito */}
            <a href="/" className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
              Ir para a vitrine
            </a>
          </div>
          {error.digest ? <p className="text-xs text-muted-foreground">Código de referência: <span className="font-mono">{error.digest}</span></p> : null}
        </main>
      </body>
    </html>
  );
}
