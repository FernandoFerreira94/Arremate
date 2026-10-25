"use client";

import Link from "next/link";
import { useState } from "react";
import { HeartIcon, LogInIcon } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/app/page-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSheet } from "../auth/auth-sheet";
import { useSession } from "../auth/use-session";
import { clockOffset } from "../lots/room-logic";
import { LotCard } from "../lots/lot-card";
import { orderFavorites } from "./favorites-api";
import { useFavorites } from "./use-favorites";

/** R11: Meus favoritos — com itens, vazio (CTA vitrine), carregando, erro; encerrados no fim com imagem a 75%. */
export function FavoritesPage() {
  const session = useSession();
  const favorites = useFavorites();
  const auth = useAuthSheet();
  const anonymous = session.isSuccess && session.data === null;
  const [now] = useState(() => Date.now());

  let body: React.ReactNode;
  if (anonymous) {
    body = (
      <EmptyState title="Entre para ver seus favoritos" description="Favoritos ficam guardados na sua conta de demonstração."
        action={<Button onClick={() => auth.open("entrar")}><LogInIcon /> Entrar</Button>} />
    );
  } else if (session.isPending || favorites.isPending) {
    body = (
      <div role="status" aria-label="Carregando favoritos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[452px]" />)}
      </div>
    );
  } else if (favorites.isError) {
    body = <ErrorState message="Não foi possível carregar seus favoritos." onRetry={() => void favorites.refetch()} />;
  } else if (favorites.data.items.length === 0) {
    body = (
      <EmptyState title="Você ainda não favoritou nenhum lote" description="Toque no coração de um lote para acompanhá-lo aqui."
        action={<Button asChild><Link href="/">Ver a vitrine</Link></Button>} />
    );
  } else {
    const offset = clockOffset(favorites.data.serverNow, favorites.dataUpdatedAt);
    body = (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orderFavorites(favorites.data.items).map((lot) => (
          <li key={lot.id}><LotCard lot={lot} now={now} offset={offset} dimmed={lot.state !== "LIVE" && lot.state !== "SCHEDULED"} /></li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="inline-flex items-center gap-2 text-4xl"><HeartIcon className="size-7 text-primary" /> Meus favoritos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lotes que você acompanha. Encerrados aparecem no fim.</p>
      </div>
      {body}
    </div>
  );
}
