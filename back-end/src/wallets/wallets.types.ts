import type { MoneyText } from "../common/money";

export type WalletView = {
  totalCents: MoneyText;
  committedCents: MoneyText;
  availableCents: MoneyText;
  revision: number;
};

export const WALLET_CAPACITY = 10n ** 38n - 1n;

export function walletView(total: bigint, committed: bigint, revision: number): WalletView {
  return {
    totalCents: total.toString(),
    committedCents: committed.toString(),
    availableCents: (total - committed).toString(),
    revision,
  };
}
