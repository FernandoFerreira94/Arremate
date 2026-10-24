import { apiFetch } from "../../lib/api";
import type { PublicLot } from "../lots/lots-api";

/** D21 (R11): lista privada; a vitrine pública continua sem estado por usuário. */
export type FavoritesView = { items: PublicLot[]; lotIds: string[]; serverNow: string };
export const FAVORITES_KEY = ["favorites"] as const;
export const PENDING_FAVORITE_KEY = "arremate.favorito.pendente";

export async function getFavorites(): Promise<FavoritesView> {
  return (await apiFetch("/api/me/favorites")) as FavoritesView;
}

export async function setFavorite(lotId: string, favorite: boolean): Promise<{ lotId: string; favorite: boolean }> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/favorite`, { method: favorite ? "PUT" : "DELETE" })) as { lotId: string; favorite: boolean };
}

/** Encerrados (ou qualquer estado não aberto) vão para o fim, preservando a ordem do servidor dentro de cada grupo. */
export function orderFavorites<T extends { state: string }>(items: readonly T[]): T[] {
  const open = items.filter((item) => item.state === "LIVE" || item.state === "SCHEDULED");
  const closed = items.filter((item) => item.state !== "LIVE" && item.state !== "SCHEDULED");
  return [...open, ...closed];
}
