import { apiFetch } from "../../lib/api";
import type { LotView } from "../seller/seller-api";
import type { PublicBid } from "./room-logic";

export type PublicLot = LotView & {
  dimensions: string;
  sourceUrl: string | null;
  result: "OPEN" | "CLOSED_PENDING" | "SETTLED" | "CLOSED_NO_BIDS" | "CANCELLED";
  artistBio?: string;
  /** D17: sempre simulado para demonstração; nunca vem do Met. */
  estimate?: { lowCents: string; highCents: string; simulated: true } | null;
  conditionReport?: { text: string; simulated: true } | null;
};

export const SIMULATED_LABEL = "Simulado para demonstração";
export type ShowcasePage = { items: PublicLot[]; page: number; pageSize: number; total: number; serverNow: string };
export type BidsPage = { items: PublicBid[]; page: number; pageSize: number; total: number };
export type AuditView = { lotId: string; status: "INTACT" | "TAMPERED" | "INDETERMINATE"; revision: number | null; count: number | null; verifiedAt: string; reasonCode: string; message: string };
export type AcceptedBid = { bid: PublicBid; lotRevision: number; endsAt: string; extended: boolean; serverNow: string; walletRevision: number };
export type PublicReceipt = {
  code: string;
  simulated: true;
  valid: boolean;
  lotId: string;
  artwork: { externalId: string; title: string; artist: string; credit: string; license: string; imageUrl: string };
  winnerAlias: string;
  sellerAlias: string;
  amountCents: string;
  startsAt: string;
  endsAt: string;
  settledAt: string;
  audit: { status: AuditView["status"]; verifiedAt: string; message: string };
};

export const lotKey = (id: string) => ["lot", id] as const;
export const bidsKey = (id: string, page: number) => ["lot", id, "bids", page] as const;

export async function getShowcase(page: number): Promise<ShowcasePage> {
  return (await apiFetch(`/api/lots?page=${page}`)) as ShowcasePage;
}
export async function getLot(id: string): Promise<PublicLot> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(id)}`)) as PublicLot;
}
export async function getBids(id: string, page = 1, limit = 50): Promise<BidsPage> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(id)}/bids?page=${page}&limit=${limit}`)) as BidsPage;
}
export async function getAudit(id: string): Promise<AuditView> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(id)}/audit`, { timeoutMs: 15000 })) as AuditView;
}
export async function getReceipt(token: string): Promise<PublicReceipt> {
  return (await apiFetch(`/api/receipts/${encodeURIComponent(token)}`, { timeoutMs: 15000 })) as PublicReceipt;
}
export async function placeBid(lotId: string, amountCents: string, key: string): Promise<AcceptedBid> {
  return (await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/bids`, {
    method: "POST",
    body: JSON.stringify({ amountCents }),
    headers: { "Idempotency-Key": key },
  })) as AcceptedBid;
}
