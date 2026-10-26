"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBrl } from "@/lib/money";
import { useSession } from "../auth/use-session";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_KEY,
  NOTIFICATIONS_POLL_MS,
  TOAST_MS,
  toastable,
  toastKey,
  type NotificationsView,
} from "./notifications-api";

export function useNotifications() {
  const session = useSession();
  return useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: getNotifications, enabled: Boolean(session.data?.role), refetchInterval: NOTIFICATIONS_POLL_MS });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) => (id ? markNotificationRead(id) : markAllNotificationsRead()),
    onMutate: (id) => {
      const previous = client.getQueryData<NotificationsView>(NOTIFICATIONS_KEY);
      if (previous) {
        const stamp = new Date().toISOString();
        const items = previous.items.map((item) => (item.readAt === null && (id === null || item.id === id) ? { ...item, readAt: stamp } : item));
        client.setQueryData(NOTIFICATIONS_KEY, { items, unread: items.filter((item) => item.readAt === null).length });
      }
      return { previous };
    },
    onError: (_e, _id, context) => {
      if (context?.previous) client.setQueryData(NOTIFICATIONS_KEY, context.previous);
    },
    onSuccess: (data) => client.setQueryData(NOTIFICATIONS_KEY, data),
  });
}

/** N4: toast "O lote abriu" para notificações novas enquanto o site está aberto; nunca na sala do próprio lote. */
export function NotificationToaster() {
  const query = useNotifications();
  const pathname = usePathname();
  const seen = useRef<Set<string> | null>(null);
  const markRead = useMarkRead();
  const role = useSession().data?.role;
  useEffect(() => {
    if (!role) seen.current = null;
  }, [role]);
  useEffect(() => {
    const items = query.data?.items;
    if (!items) return;
    const fresh = toastable(seen.current, items, pathname);
    seen.current = new Set([...(seen.current ?? []), ...items.map(toastKey)]);
    for (const item of fresh) {
      const outbid = item.kind === "OUTBID";
      const newBid = item.kind === "NEW_BID";
      // N4 → Sonner (T2.5): mesmo conteúdo; com ação, fica até fechar. QA MÉDIA 5: o mesmo toast avisa quem foi superado.
      toast(<span className="font-semibold">{outbid ? "Você foi superado" : newBid ? "Novo lance no seu lote" : "O lote abriu"}</span>, {
        id: item.id,
        duration: TOAST_MS,
        classNames: { toast: outbid ? "border-l-danger" : newBid ? "border-l-success" : "border-l-scheduled" },
        icon: (
          // eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API
          <img src={item.imageUrl} alt="" className="size-14 shrink-0 rounded-md bg-muted object-cover" />
        ),
        description: (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-serif text-base text-foreground">{item.title}</span>
            <span className="text-xs text-muted-foreground">{outbid ? "Seu lance foi coberto e o valor voltou para o disponível." : newBid ? "Um licitante deu lance. Acompanhe ao vivo na sala." : `Lance inicial ${formatBrl(item.initialCents)}`}</span>
            <span className="mt-2 flex gap-2">
              {newBid ? null : (
                <Button asChild size="sm">
                  <Link href={`/lotes/${item.lotId}`} onClick={() => { markRead.mutate(item.id); toast.dismiss(item.id); }}>{outbid ? "Dar novo lance" : "Dar lance"}</Link>
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link href={`/lotes/${item.lotId}`} onClick={() => { markRead.mutate(item.id); toast.dismiss(item.id); }}>Ver lote</Link>
              </Button>
            </span>
          </span>
        ),
      });
    }
    // markRead é estável o bastante para o clique; a leitura só reage a dados novos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, pathname]);
  return null;
}
