import { apiFetch } from "../../lib/api";

export type WalletView = { totalCents: string; committedCents: string; availableCents: string; revision: number };

export async function getWallet(): Promise<WalletView> {
  return (await apiFetch("/api/wallet")) as WalletView;
}

export async function deposit(amountCents: string, key: string, payment: { method: "PIX" | "CARD"; cardId?: string } = { method: "PIX" }): Promise<WalletView> {
  return (await apiFetch("/api/wallet/deposits", {
    method: "POST",
    body: JSON.stringify({ amountCents, ...payment }),
    headers: { "Idempotency-Key": key },
  })) as WalletView;
}

export type TestCard = { id: string; brand: string; last4: string; expiryMonth: number; expiryYear: number };
export async function getCards(): Promise<{ items: TestCard[] }> {
  return await apiFetch("/api/wallet/cards") as { items: TestCard[] };
}
export async function useTestCard(): Promise<TestCard> {
  return await apiFetch("/api/wallet/cards", { method: "POST", body: "{}" }) as TestCard;
}
export async function removeCard(id: string): Promise<void> {
  await apiFetch(`/api/wallet/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export type EntryFilter = "all" | "deposits" | "bids" | "awards";
export type WalletEntry = { id: string; kind: "DEPOSIT" | "RESERVE" | "RELEASE" | "SETTLEMENT_DEBIT" | "SETTLEMENT_CREDIT"; amountCents: string; method: "PIX" | "CARD" | null; last4: string | null; createdAt: string; reference: string };
export async function getEntries(page: number, filter: EntryFilter): Promise<{ items: WalletEntry[]; page: number; pageSize: number; total: number }> {
  return await apiFetch(`/api/wallet/entries?page=${page}&filter=${filter}`) as { items: WalletEntry[]; page: number; pageSize: number; total: number };
}
