import type { PublicBid } from "./room-logic";

export type RecentBid = PublicBid & { gapMs: number | null };

/** R4: recebe lances em qualquer ordem e devolve os `limit` mais recentes, com o intervalo para o lance anterior. */
export function recentBidsWithGaps(bids: PublicBid[], limit = 5): RecentBid[] {
  const sorted = [...bids].sort((a, b) => b.sequence - a.sequence);
  return sorted.slice(0, limit).map((bid, index) => {
    const previous = sorted[index + 1];
    return { ...bid, gapMs: previous ? Math.max(0, Date.parse(bid.acceptedAt) - Date.parse(previous.acceptedAt)) : null };
  });
}

/** "+45 s", "+3 min", "+2 h 10 min", "+1 d 4 h". */
export function formatGap(ms: number | null): string {
  if (ms === null) return "primeiro";
  const s = Math.round(ms / 1000);
  if (s < 60) return `+${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `+${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `+${h} h ${m % 60} min` : `+${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `+${d} d ${h % 24} h` : `+${d} d`;
}

/** Os apelidos públicos já são pseudônimos da API; aqui só encurtamos para caber no cartão. */
export function maskAlias(alias: string): string {
  const trimmed = alias.trim();
  if (trimmed.length <= 3) return `${trimmed}•••`;
  return `${trimmed.slice(0, 3)}•••${trimmed.slice(-1)}`;
}
