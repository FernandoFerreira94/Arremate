import { apiFetch } from "../../lib/api";
import type { PublicLot } from "../lots/lots-api";

/** D21 (H2, N1–N4). */
export type NextLotView = { lot: PublicLot | null; serverNow: string };
export type UpcomingView = { items: PublicLot[]; serverNow: string };
export type NotificationItem = {
  id: string;
  kind: "LOT_OPENED" | string;
  lotId: string;
  title: string;
  imageUrl: string;
  initialCents: string;
  createdAt: string;
  readAt: string | null;
};
export type NotificationsView = { items: NotificationItem[]; unread: number };

export const NEXT_LOT_KEY = ["lots", "next"] as const;
export const UPCOMING_KEY = ["lots", "upcoming"] as const;
/** H2b: autoplay do carrossel. */
export const CAROUSEL_MS = 4_000;
export const SWIPE_PX = 40;
export const WATCHES_KEY = ["watches"] as const;
export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const PENDING_WATCH_KEY = "arremate.aviso.pendente";
/** Decisão do Fernando (25/10): polling de 30 s, sem SSE novo. */
export const NOTIFICATIONS_POLL_MS = 30_000;
export const TOAST_MS = 8_000;

export async function getNextLot(): Promise<NextLotView> {
  return (await apiFetch("/api/lots/next")) as NextLotView;
}
export async function getUpcoming(): Promise<UpcomingView> {
  return (await apiFetch("/api/lots/upcoming?limit=5")) as UpcomingView;
}
/** Índice circular do carrossel. */
export function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}
export async function getWatches(): Promise<{ lotIds: string[] }> {
  return (await apiFetch("/api/me/watches")) as { lotIds: string[] };
}
export async function setWatch(lotId: string, watching: boolean): Promise<{ lotId: string; watching: boolean }> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/watch`, { method: watching ? "PUT" : "DELETE" })) as { lotId: string; watching: boolean };
}
export async function getNotifications(): Promise<NotificationsView> {
  return (await apiFetch("/api/me/notifications")) as NotificationsView;
}
export async function markNotificationRead(id: string): Promise<NotificationsView> {
  return (await apiFetch(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST" })) as NotificationsView;
}
export async function markAllNotificationsRead(): Promise<NotificationsView> {
  return (await apiFetch("/api/me/notifications/read-all", { method: "POST" })) as NotificationsView;
}

/** Badge do sino: some em 0, 1–9 e "9+". */
export function badgeLabel(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > 9 ? "9+" : String(unread);
}

/**
 * Notificações que viram toast: só as novas desde a primeira leitura desta aba (offline vê só o contador)
 * e nunca a do lote cuja sala está aberta.
 */
export function toastable(previous: ReadonlySet<string> | null, items: readonly NotificationItem[], pathname: string): NotificationItem[] {
  if (previous === null) return [];
  return items.filter((item) => !previous.has(item.id) && item.readAt === null && pathname !== `/lotes/${item.lotId}`);
}

/** Contagem regressiva em partes (h, min, s), com horas acumuladas. */
export function countdownParts(ms: number): { h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { h: pad(Math.floor(total / 3600)), m: pad(Math.floor((total % 3600) / 60)), s: pad(total % 60) };
}
