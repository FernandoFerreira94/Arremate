"use client";

import { FlaskConicalIcon } from "lucide-react";
import { resetDemo } from "./client";

/** Aviso fixo do modo demo: deixa claro que não há back-end e que os dados ficam só neste navegador. */
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-border bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
      <FlaskConicalIcon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
      <strong className="font-semibold text-foreground">Demonstração sem servidor.</strong> Lances, saldo e auditoria rodam no seu navegador com as regras do back-end; nada sai daqui.{" "}
      <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={resetDemo}>
        Reiniciar demo
      </button>
    </div>
  );
}
