import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { parseIdempotencyKey, requestDigest, withIdempotency } from "../common/idempotency";
import { MoneyError, parsePositiveMoney, type MoneyText } from "../common/money";
import { DatabaseRepository } from "../database/database.repository";
import { WalletsRepository } from "./wallets.repository";
import { WALLET_CAPACITY, walletView, type WalletView } from "./wallets.types";

export const DEPOSIT_OPERATION = "wallet.deposit";

export class WalletsService {
  constructor(
    private readonly database: DatabaseRepository,
    private readonly wallets: WalletsRepository,
  ) {}

  async getWallet(actor: Actor): Promise<WalletView> {
    const row = await this.wallets.find(actor.userId);
    if (!row) return walletView(0n, 0n, 0);
    return walletView(BigInt(row.total_cents), BigInt(row.committed_cents), row.revision);
  }

  async deposit(actor: Actor, amountCents: MoneyText, rawKey: string | undefined): Promise<WalletView> {
    const key = parseIdempotencyKey(rawKey);
    let amount: bigint;
    try {
      amount = parsePositiveMoney(amountCents);
    } catch (error) {
      if (error instanceof MoneyError) throw new ApiException(400, "VALOR_INVALIDO");
      throw error;
    }
    const { result } = await withIdempotency(
      this.database,
      { userId: actor.userId, operation: DEPOSIT_OPERATION, resourceKey: "wallet", key, requestHash: requestDigest([amount.toString()]) },
      async (client) => {
        const wallet = await this.wallets.lockOrCreate(client, actor.userId);
        if (BigInt(wallet.total_cents) + amount > WALLET_CAPACITY) throw new ApiException(409, "CAPACIDADE_EXCEDIDA");
        const updated = await this.wallets.credit(client, wallet.id, amount, `deposit:${actor.userId}:${key}`);
        return walletView(BigInt(updated.total_cents), BigInt(updated.committed_cents), updated.revision);
      },
    );
    return result;
  }
}
