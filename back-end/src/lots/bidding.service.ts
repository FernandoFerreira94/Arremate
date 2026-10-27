import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { ConfirmationPendingError, IntegrityBlockedError, type AuditService } from "../audit/audit.service";
import { findIdempotent, parseIdempotencyKey, requestDigest, saveIdempotent, type IdempotencyScope } from "../common/idempotency";
import { MoneyError, parsePositiveMoney, type MoneyText } from "../common/money";
import { DatabaseRepository } from "../database/database.repository";
import { BidRejection, decideBid } from "./bid-rules";
import { BiddingRepository } from "./bidding.repository";

export const BID_OPERATION = "lot.bid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRANSIENT = new Set(["40P01", "40001"]);
const MAX_ATTEMPTS = 3;

export type PublicBid = { alias: string; amountCents: MoneyText; sequence: number; acceptedAt: string };

export type AcceptedBid = {
  bidId: string;
  bid: PublicBid;
  lotRevision: number;
  endsAt: string;
  extended: boolean;
  serverNow: string;
  walletRevision: number;
};

export class BiddingService {
  private readonly logger = new Logger(BiddingService.name);

  constructor(
    private readonly database: DatabaseRepository,
    private readonly audit: AuditService | null,
    private readonly bids: BiddingRepository,
  ) {}

  async placeBid(actor: Actor, lotId: string, amountCents: MoneyText, rawKey: string | undefined): Promise<AcceptedBid> {
    const key = parseIdempotencyKey(rawKey);
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const id = lotId.toLowerCase();
    const amount = parseAmount(amountCents);
    const scope: IdempotencyScope = { userId: actor.userId, operation: BID_OPERATION, resourceKey: id, key, requestHash: requestDigest([id, amount.toString()]) };
    // Retry depois de commit (mesmo com testemunha pendente) devolve o lance original sem nova mutação.
    const previous = await this.database.transaction((client) => findIdempotent<AcceptedBid>(client, scope));
    if (previous) return previous;
    if (!this.audit) throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.attempt(this.audit, actor, id, amount, scope);
      } catch (error) {
        if (attempt < MAX_ATTEMPTS && isTransient(error)) {
          await new Promise((resolve) => setTimeout(resolve, 10 + Math.floor(Math.random() * 40) * attempt));
          continue;
        }
        throw translate(error, this.logger);
      }
    }
  }

  private attempt(audit: AuditService, actor: Actor, lotId: string, amount: bigint, scope: IdempotencyScope): Promise<AcceptedBid> {
    return audit.acceptBidAtomic<AcceptedBid>(lotId, async (client, head) => {
      const replay = await findIdempotent<AcceptedBid>(client, scope);
      if (replay) return { kind: "replay", result: replay };
      const lot = await this.bids.lockLot(client, lotId);
      if (!lot) throw new ApiException(404, "NAO_ENCONTRADO");
      if (lot.revision !== head.revision) throw new ConfirmationPendingError();
      const leader = await this.bids.leader(client, lotId);
      const replaced = leader && leader.user_id !== actor.userId ? leader : null;
      const wallets = await this.bids.lockWallets(client, replaced ? [actor.userId, replaced.user_id] : [actor.userId]);
      const now = await this.bids.clock(client);
      const own = wallets.get(actor.userId);
      const decision = decideBid({
        status: lot.status,
        startsAt: lot.starts_at,
        endsAt: lot.ends_at,
        initialCents: BigInt(lot.initial_cents),
        incrementCents: BigInt(lot.increment_cents),
        currentCents: leader ? BigInt(leader.amount_cents) : null,
        actorIsLeader: leader?.user_id === actor.userId,
        actorIsOwner: lot.owner_id === actor.userId,
        availableCents: own ? BigInt(own.total_cents) - BigInt(own.committed_cents) : 0n,
        amountCents: amount,
        now,
      });
      if (!own) throw new BidRejection("INSUFFICIENT_FUNDS");
      const bidId = randomUUID();
      const alias = await this.bids.aliasFor(client, lotId, actor.userId);
      const acceptedAt = now.toISOString();
      const endsAt = decision.endsAt.toISOString();
      return {
        kind: "accept",
        draft: { bidId, bidderUserId: actor.userId, alias, amountCents: amount, acceptedAt, endsAt },
        finish: async (tx, accepted) => {
          if (replaced) {
            const previousWallet = wallets.get(replaced.user_id);
            if (!previousWallet) throw new Error("carteira do líder anterior ausente");
            await this.bids.moveReservation(tx, previousWallet.id, "RELEASE", BigInt(replaced.amount_cents), `release:${replaced.id}`);
            await this.bids.notifyOutbid(tx, replaced.user_id, lotId);
          }
          const walletRevision = await this.bids.moveReservation(tx, own.id, "RESERVE", amount, `reserve:${bidId}`);
          await this.bids.notifyNewBid(tx, lot.owner_id, lotId);
          const result: AcceptedBid = {
            bidId,
            bid: { alias, amountCents: amount.toString(), sequence: accepted.sequence, acceptedAt },
            lotRevision: accepted.revision,
            endsAt,
            extended: decision.extended,
            serverNow: acceptedAt,
            walletRevision,
          };
          await saveIdempotent(tx, scope, result);
          return result;
        },
      };
    });
  }
}

function parseAmount(value: MoneyText): bigint {
  try {
    return parsePositiveMoney(value);
  } catch (error) {
    if (error instanceof MoneyError) throw new ApiException(400, "VALOR_INVALIDO");
    throw error;
  }
}

function isTransient(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && TRANSIENT.has(String((error as { code: unknown }).code));
}

function translate(error: unknown, logger: Logger): unknown {
  if (error instanceof BidRejection) return new ApiException(409, error.code);
  if (error instanceof ConfirmationPendingError) return new ApiException(503, "CONFIRMATION_PENDING");
  if (error instanceof IntegrityBlockedError) {
    if (error.code === "CONFIRMATION_PENDING") return new ApiException(503, "CONFIRMATION_PENDING");
    logger.warn("Lance recusado: lote com integridade violada.");
    return new ApiException(409, "LOTE_BLOQUEADO");
  }
  return error;
}
