/**
 * Modo demo (NEXT_PUBLIC_DEMO_MODE=1): o mesmo catálogo do seed do back (back-end/prisma/seed-catalog.ts),
 * congelado em artworks.json por scripts/demo-snapshot.mjs. Sem import com "@/": o Vitest não resolve o alias.
 */
import artworks from "./artworks.json";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export type SeedState = "OPEN" | "ENDING" | "CLOSED" | "SCHEDULED";
export type Artwork = {
  lot: string;
  externalId: string;
  initial: number;
  estimate: [number, number];
  state: SeedState;
  offsetMs: number | null;
  bids: { n: number; final: number; winner: number; with: number[] } | null;
  condition: string;
  title: string;
  artist: string;
  artistBio: string;
  date: string;
  medium: string;
  dimensions: string;
  credit: string;
  sourceUrl: string | null;
};

export const DEMO_ARTWORKS = artworks as Artwork[];
export const DEMO_LICENSE = "Domínio público (CC0)";

/** UUID estável por obra do seed: a página do lote existe no servidor (metadados) e no navegador. */
export function seedLotId(externalId: string): string {
  return `de300000-0000-4000-8000-${externalId.padStart(12, "0")}`;
}

export function demoImageUrl(externalId: string): string {
  return `/demo/obras/${externalId}.jpg`;
}

/** Metadados públicos para o proxy, a página e o preview social; lote criado no navegador cai no genérico. */
export function demoLotMeta(id: string): { title: string; artist: string; imageUrl: string | null } {
  const art = DEMO_ARTWORKS.find((a) => seedLotId(a.externalId) === id.toLowerCase());
  return art ? { title: art.title, artist: art.artist, imageUrl: demoImageUrl(art.externalId) } : { title: "Lote", artist: "", imageUrl: null };
}

/** Mesmas regras de incremento e de plano de lances do seed do back. */
export function incrementFor(initialReais: number): number {
  if (initialReais < 1000) return 10;
  if (initialReais < 10000) return 50;
  return Math.max(100, Math.round((initialReais * 0.02) / 100) * 100);
}

export function bidAmounts(initialReais: number, finalReais: number, n: number): number[] {
  const inc = incrementFor(initialReais);
  if (n === 1) return [initialReais];
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const raw = initialReais + ((finalReais - initialReais) * i) / (n - 1);
    let v = i === 0 ? initialReais : i === n - 1 ? finalReais : initialReais + Math.round((raw - initialReais) / inc) * inc;
    if (i > 0) v = Math.max(v, (out[i - 1] as number) + inc);
    out.push(v);
  }
  return out;
}

export function bidderOrder(n: number, winner: number, participants: readonly number[]): number[] {
  const p = participants.length;
  const w = participants.indexOf(winner);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(participants[(((w - (n - 1 - i)) % p) + p) % p] as number);
  return out;
}
