"use client";

import { BellIcon, BellRingIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "../auth/use-session";
import { useRequestWatch, useToggleWatch, useWatches } from "./use-watches";

/**
 * N1: "Avise-me quando abrir". Estados ativo (Bell, primary) · carregando ("Ativando…") · inscrito (BellRing/Check em --success,
 * com "Cancelar aviso", que apaga a inscrição) · visitante (Sheet Entrar e ativa após o login). Alvo de 44 px no mobile.
 */
export function WatchButton({ lotId, title, variant = "hero", className }: { lotId: string; title: string; variant?: "hero" | "card"; className?: string }) {
  const session = useSession();
  const watches = useWatches();
  const toggle = useToggleWatch();
  const request = useRequestWatch();
  const loggedIn = Boolean(session.data?.role);
  const watching = loggedIn && Boolean(watches.data?.lotIds.includes(lotId));
  const busy = toggle.isPending && toggle.variables?.lotId === lotId;
  const activate = () => (loggedIn ? toggle.mutate({ lotId, watching: true }) : request(lotId));
  const cancel = () => toggle.mutate({ lotId, watching: false });

  if (variant === "card") {
    if (watching) {
      return (
        <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={busy} aria-pressed="true" aria-label={`Cancelar aviso de ${title}`}
          className="min-h-11 border-success text-success sm:min-h-8">
          <CheckIcon /> Avisaremos
        </Button>
      );
    }
    return (
      <Button type="button" size="sm" onClick={activate} disabled={busy} aria-pressed="false" aria-label={`Avise-me quando ${title} abrir`} className="min-h-11 sm:min-h-8">
        {busy ? <Loader2Icon className="animate-spin" /> : <BellIcon />} Avise-me
      </Button>
    );
  }

  if (watching) {
    return (
      <div className={cn("flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-3", className)}>
        <span role="status" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-success px-4 text-sm font-medium text-success sm:min-h-10">
          <BellRingIcon className="size-4" /> Você será avisado
        </span>
        <Button type="button" variant="link" size="sm" onClick={cancel} disabled={busy} className="min-h-11 text-muted-foreground sm:min-h-0">
          Cancelar aviso
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" onClick={activate} disabled={busy} className={cn("min-h-11 w-full sm:min-h-10 sm:w-auto", className)}>
      {busy ? <><Loader2Icon className="animate-spin" /> Ativando…</> : <><BellIcon /> Avise-me quando abrir</>}
    </Button>
  );
}
