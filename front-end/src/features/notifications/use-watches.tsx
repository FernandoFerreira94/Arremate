"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthSheet } from "../auth/auth-sheet";
import { useSession } from "../auth/use-session";
import { getWatches, PENDING_WATCH_KEY, setWatch, WATCHES_KEY } from "./notifications-api";
import { messageOf, notifyError, notifySuccess } from "@/lib/notify";

/** Inscrições "Avise-me" do usuário logado (busca separada; a vitrine pública não muda). */
export function useWatches() {
  const session = useSession();
  return useQuery({ queryKey: WATCHES_KEY, queryFn: getWatches, enabled: Boolean(session.data?.role), staleTime: 30_000 });
}

export function useToggleWatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lotId, watching }: { lotId: string; watching: boolean }) => setWatch(lotId, watching),
    onMutate: async ({ lotId, watching }) => {
      await client.cancelQueries({ queryKey: WATCHES_KEY });
      const previous = client.getQueryData<{ lotIds: string[] }>(WATCHES_KEY);
      if (previous) {
        client.setQueryData(WATCHES_KEY, { lotIds: watching ? [...new Set([lotId, ...previous.lotIds])] : previous.lotIds.filter((id) => id !== lotId) });
      }
      return { previous };
    },
    onSuccess: (data, { lotId, watching }) => {
      notifySuccess(messageOf(data, watching ? "Vamos avisar quando o lote abrir." : "Aviso desativado."), { id: `aviso-${lotId}` });
    },
    onError: (error, _vars, context) => {
      if (context?.previous) client.setQueryData(WATCHES_KEY, context.previous);
      notifyError(error, "Não foi possível atualizar o aviso.");
    },
    onSettled: () => void client.invalidateQueries({ queryKey: WATCHES_KEY }),
  });
}

/** Visitante: guarda o aviso pendente e abre a Sheet Entrar; o aviso é ativado após o login. */
export function useRequestWatch() {
  const auth = useAuthSheet();
  return (lotId: string) => {
    try {
      sessionStorage.setItem(PENDING_WATCH_KEY, lotId);
    } catch {
      /* sem storage: só abre a Sheet */
    }
    auth.open("entrar");
  };
}

export function PendingWatchRunner() {
  const session = useSession();
  const toggle = useToggleWatch();
  const done = useRef(false);
  const role = session.data?.role;
  useEffect(() => {
    if (!role || done.current) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_WATCH_KEY);
      sessionStorage.removeItem(PENDING_WATCH_KEY);
    } catch {
      pending = null;
    }
    if (!pending) return;
    done.current = true;
    toggle.mutate({ lotId: pending, watching: true });
  }, [role, toggle]);
  return null;
}
