"use client";

import { Hint } from "@/components/app/hint";
import { HeartIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "../auth/use-session";
import { useFavorites, useRequestFavorite, useToggleFavorite } from "./use-favorites";

/**
 * R11: estados normal · ativo (--primary, aria-pressed) · carregando (otimista) · não logado (abre a Sheet Entrar).
 * "icon": canto da imagem do card (36 px visual, alvo de 44 px). "outline": sala do lote, com rótulo.
 */
export function FavoriteButton({ lotId, title, variant = "icon", className }: { lotId: string; title: string; variant?: "icon" | "outline"; className?: string }) {
  const session = useSession();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const request = useRequestFavorite();
  const loggedIn = Boolean(session.data?.role);
  const active = loggedIn && Boolean(favorites.data?.lotIds.includes(lotId));
  const busy = toggle.isPending && toggle.variables?.lotId === lotId;
  const label = !loggedIn ? `Entrar para favoritar ${title}` : active ? `Remover ${title} dos favoritos` : `Favoritar ${title}`;
  const onClick = () => (loggedIn ? toggle.mutate({ lotId, favorite: !active }) : request(lotId));
  const icon = busy ? <Loader2Icon className="animate-spin" /> : <HeartIcon className={cn(active && "fill-current")} />;

  if (variant === "outline") {
    return (
      <Button type="button" variant="outline" size="sm" aria-pressed={active} aria-label={label} aria-busy={busy || undefined} onClick={onClick} data-tour="favorite"
        className={cn("min-h-11 sm:min-h-9", active && "border-primary text-primary", className)}>
        {icon} {active ? "Favoritado" : "Favoritar"}
      </Button>
    );
  }
  return (
    <Hint title={active ? "Nos seus favoritos" : "Favoritar"} description={!loggedIn ? "Entre para acompanhar este lote em Favoritos." : active ? "Clique para remover dos favoritos." : "Acompanhe este lote na página Favoritos."} side="left">
    <button type="button" aria-pressed={active} aria-label={label} aria-busy={busy || undefined} onClick={onClick} data-tour="favorite"
      className={cn("group inline-flex size-11 items-center justify-center rounded-full", className)}>
      <span className={cn("inline-flex size-9 items-center justify-center rounded-full border bg-card/95 shadow-sm transition-colors group-hover:bg-muted [&_svg]:size-4",
        active ? "border-primary text-primary" : "text-foreground")}>{icon}</span>
    </button>
    </Hint>
  );
}
