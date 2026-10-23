import { apiFetch } from "../../lib/api";

export type WalletView = { totalCents: string; committedCents: string; availableCents: string; revision: number };

export async function getWallet(): Promise<WalletView> {
  return (await apiFetch("/api/wallet")) as WalletView;
}

export async function deposit(amountCents: string, key: string): Promise<WalletView> {
  return (await apiFetch("/api/wallet/deposits", {
    method: "POST",
    body: JSON.stringify({ amountCents }),
    headers: { "Idempotency-Key": key },
  })) as WalletView;
}
