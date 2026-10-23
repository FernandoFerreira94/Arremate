import { apiFetch } from "../../lib/api";
import type { LotState } from "@/components/app/lot-state-badge";
import type { PublishBody } from "./publish-form";

export type LotView = {
  id: string;
  externalId: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  credit: string;
  license: string;
  imageUrl: string;
  initialCents: string;
  incrementCents: string;
  currentCents: string | null;
  minimumNextCents: string;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  state: LotState;
  settlementPending: boolean;
  serverNow: string;
};
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };
export type SellerSummary = { settledCreditCents: string; settled: number; closedNoBids: number; open: number; pending: number; cancelled: number };
export type CatalogItem = {
  externalId: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  credit: string;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  importable: boolean;
  reason?: "LICENCA_RECUSADA" | "SEM_IMAGEM" | null;
};
export type CatalogPage = { items: CatalogItem[]; page: number; pageSize: number; total: number; hasMore: boolean };

export async function listSellerLots(page = 1): Promise<Paged<LotView>> {
  return (await apiFetch(`/api/seller/lots?page=${page}&limit=50`)) as Paged<LotView>;
}

export async function getSellerSummary(): Promise<SellerSummary> {
  return (await apiFetch("/api/seller/summary")) as SellerSummary;
}

export async function cancelLot(lotId: string): Promise<LotView> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/cancel`, { method: "POST" })) as LotView;
}

export async function searchCatalog(q: string, page: number): Promise<CatalogPage> {
  return (await apiFetch(`/api/catalog/search?q=${encodeURIComponent(q)}&page=${page}`, { timeoutMs: 15000 })) as CatalogPage;
}

export async function publishLot(body: PublishBody, key: string): Promise<LotView> {
  return (await apiFetch("/api/lots", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": key }, timeoutMs: 20000 })) as LotView;
}
