"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthSheet } from "../auth/auth-sheet";
import { useSession } from "../auth/use-session";
import { FAVORITES_KEY, getFavorites, PENDING_FAVORITE_KEY, setFavorite, type FavoritesView } from "./favorites-api";
import { messageOf, notifyError, notifySuccess } from "@/lib/notify";

/** Busca separada dos ids favoritos do usuário (só logado), para pintar os corações sem tocar no cache da vitrine. */
export function useFavorites() {
  const session = useSession();
  const loggedIn = Boolean(session.data?.role);
  return useQuery({ queryKey: FAVORITES_KEY, queryFn: getFavorites, enabled: loggedIn, staleTime: 30_000 });
}

export function useToggleFavorite() {
  const client = useQueryClient();
  const undo = useRef<((vars: { lotId: string; favorite: boolean }) => void) | null>(null);
  const mutation = useMutation({
    mutationFn: ({ lotId, favorite }: { lotId: string; favorite: boolean }) => setFavorite(lotId, favorite),
    onMutate: async ({ lotId, favorite }) => {
      await client.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = client.getQueryData<FavoritesView>(FAVORITES_KEY);
      if (previous) {
        const lotIds = favorite ? [...new Set([lotId, ...previous.lotIds])] : previous.lotIds.filter((id) => id !== lotId);
        client.setQueryData<FavoritesView>(FAVORITES_KEY, { ...previous, lotIds, items: favorite ? previous.items : previous.items.filter((item) => item.id !== lotId) });
      }
      return { previous };
    },
    onSuccess: (data, { lotId, favorite }) => {
      if (favorite) notifySuccess(messageOf(data, "Adicionado aos favoritos."), { id: `favorito-${lotId}` });
      // A rota PUT de favorito é idempotente: o "Desfazer" só refaz o favorito (G2).
      else notifySuccess(messageOf(data, "Removido dos favoritos."), { id: `favorito-${lotId}`, action: { label: "Desfazer", onClick: () => undo.current?.({ lotId, favorite: true }) } });
    },
    onError: (error, _vars, context) => {
      if (context?.previous) client.setQueryData(FAVORITES_KEY, context.previous);
      notifyError(error, "Não foi possível atualizar o favorito.");
    },
    onSettled: () => void client.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });
  useEffect(() => {
    undo.current = mutation.mutate;
  }, [mutation.mutate]);
  return mutation;
}

/** Não logado: guarda a intenção e abre a Sheet Entrar. */
export function useRequestFavorite() {
  const auth = useAuthSheet();
  return (lotId: string) => {
    try {
      sessionStorage.setItem(PENDING_FAVORITE_KEY, lotId);
    } catch {
      /* sem storage: só abre a Sheet */
    }
    auth.open("entrar");
  };
}

/** Refaz o favorito pendente quando a sessão aparece (login pela Sheet ou /entrar). */
export function PendingFavoriteRunner() {
  const session = useSession();
  const toggle = useToggleFavorite();
  const done = useRef(false);
  const role = session.data?.role;
  useEffect(() => {
    if (!role || done.current) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_FAVORITE_KEY);
      sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    } catch {
      pending = null;
    }
    if (!pending) return;
    done.current = true;
    toggle.mutate({ lotId: pending, favorite: true });
  }, [role, toggle]);
  return null;
}
