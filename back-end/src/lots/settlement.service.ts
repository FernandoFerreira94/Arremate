import { randomBytes, randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { ConfirmationPendingError, IntegrityBlockedError, type AuditService } from "../audit/audit.service";
import type { MoneyText } from "../common/money";
import { DatabaseRepository } from "../database/database.repository";
import { SettlementRepository } from "./settlement.repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SWEEP_LIMIT = 50;
export const LIST_PAGE_SIZE = 8;

export type ClosedLot = {
  lotId: string;
  /** OPEN: ainda nÃ£o venceu (inclusive prorrogado); SKIPPED: jÃ¡ fechado/cancelado. */
  status: "SETTLED" | "CLOSED_NO_BIDS" | "OPEN" | "SKIPPED";
  amountCents: MoneyText | null;
  receiptToken: string | null;
};

export type ProcessingSummary = { scanned: number; settled: number; closedNoBids: number; blocked: number; failed: number };

export type ParticipationOutcome = "LEADING" | "OUTBID" | "PENDING" | "WON" | "LOST" | "CANCELLED";
export type Participation = {
  lotId: string;
  title: string;
  imageUrl: string;
  endsAt: string;
  myTopCents: MoneyText;
  myBids: { amountCents: string; acceptedAt: string }[];
  state: "LIVE" | "ENDED" | "CANCELLED";
  currentCents: MoneyText;
  outcome: ParticipationOutcome;
  receiptToken: string | null;
};
export type Award = { lotId: string; title: string; imageUrl: string; amountCents: MoneyText; settledAt: string; receiptToken: string };
export type SellerSummary = { settledCreditCents: MoneyText; settled: number; closedNoBids: number; open: number; pending: number; cancelled: number };
export type ListPage<T> = { items: T[]; page: number; pageSize: number; total: number };

export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly database: DatabaseRepository,
    private readonly audit: AuditService | null,
    private readonly repository: SettlementRepository,
  ) {}

  /**
   * Lock lote â†’ carteiras ordenadas â†’ relÃ³gio real pÃ³s-lock. DÃ©bito do vencedor (total e reservado),
   * crÃ©dito do vendedor, ledger, settlement e recibo numa transaÃ§Ã£o; vÃ­nculo selado na testemunha.
   */
  async settleLot(lotId: string): Promise<ClosedLot> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    if (!this.audit) throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    const id = lotId.toLowerCase();
    const idle = (status: ClosedLot["status"]): ClosedLot => ({ lotId: id, status, amountCents: null, receiptToken: null });
    return this.audit.settleAtomic<ClosedLot>(id, async (client, head) => {
      const lot = await this.repository.lockLot(client, id);
      if (!lot) throw new ApiException(404, "NAO_ENCONTRADO");
      if (lot.status !== "PUBLISHED") return { kind: "skip", result: idle("SKIPPED") };
      if (lot.revision !== head.revision) throw new ConfirmationPendingError();
      const winner = await this.repository.winner(client, id);
      const wallets = winner ? await this.repository.lockWallets(client, [winner.user_id, lot.owner_id]) : new Map();
      const now = await this.repository.clock(client);
      if (now.getTime() < lot.ends_at.getTime()) return { kind: "skip", result: idle("OPEN") };
      const settlementId = randomUUID();
      const settledAt = now.toISOString();
      if (!winner) {
        return {
          kind: "settle",
          link: { settlementId, winnerBidId: null, receiptToken: null, settledAt },
          finish: async (tx, revision) => {
            await this.repository.insertSettlement(tx, settlementId, id, null, settledAt);
            await this.repository.closeLot(tx, id, "CLOSED_NO_BIDS", head.revision, revision);
            return idle("CLOSED_NO_BIDS");
          },
        };
      }
      const amount = BigInt(winner.amount_cents);
      const token = randomBytes(24).toString("base64url");
      const winnerWallet = wallets.get(winner.user_id);
      const sellerWallet = wallets.get(lot.owner_id);
      if (!winnerWallet || !sellerWallet) throw new Error("carteira ausente na liquidaÃ§Ã£o");
      return {
        kind: "settle",
        link: { settlementId, winnerBidId: winner.id, receiptToken: token, settledAt },
        finish: async (tx, revision) => {
          await this.repository.debitWinner(tx, winnerWallet.id, amount, id);
          await this.repository.creditSeller(tx, sellerWallet.id, amount, id);
          await this.repository.insertSettlement(tx, settlementId, id, winner.id, settledAt);
          await this.repository.insertReceipt(tx, settlementId, token);
          await this.repository.closeLot(tx, id, "SETTLED", head.revision, revision);
          return { lotId: id, status: "SETTLED", amountCents: amount.toString(), receiptToken: token };
        },
      };
    });
  }

  /** Varre lotes vencidos; cada um em sua transaÃ§Ã£o. Falha de um nÃ£o impede os demais. */
  async settleDueLots(onClosed?: (lotId: string) => void): Promise<ProcessingSummary> {
    const summary: ProcessingSummary = { scanned: 0, settled: 0, closedNoBids: 0, blocked: 0, failed: 0 };
    if (!this.audit) return summary;
    for (const lotId of await this.repository.dueLots(this.database, SWEEP_LIMIT)) {
      summary.scanned += 1;
      try {
        const closed = await this.settleLot(lotId);
        if (closed.status === "SETTLED") summary.settled += 1;
        if (closed.status === "CLOSED_NO_BIDS") summary.closedNoBids += 1;
        if (closed.status === "SETTLED" || closed.status === "CLOSED_NO_BIDS") onClosed?.(closed.lotId);
      } catch (error) {
        if (error instanceof IntegrityBlockedError || error instanceof ConfirmationPendingError) {
          summary.blocked += 1;
        } else {
          summary.failed += 1;
          this.logger.error(`LiquidaÃ§Ã£o falhou no lote ${lotId}: ${error instanceof Error ? error.name : "erro"}`);
        }
      }
    }
    return summary;
  }

  async listParticipations(actor: Actor, page: number): Promise<ListPage<Participation>> {
    const { rows, total } = await this.repository.participations(this.database, actor.userId, LIST_PAGE_SIZE, (page - 1) * LIST_PAGE_SIZE);
    const items = rows.map((row): Participation => ({
      lotId: row.lot_id,
      title: row.title,
      imageUrl: `/api/media/${row.media_key}`,
      endsAt: row.ends_at.toISOString(),
      myTopCents: row.my_top_cents,
      myBids: row.my_bids,
      state: row.status === "CANCELLED" ? "CANCELLED" : row.ends_at <= row.server_now ? "ENDED" : "LIVE",
      currentCents: row.top_cents,
      outcome: outcomeOf(row.status, row.i_lead, row.ends_at, row.server_now),
      receiptToken: row.public_token,
    }));
    return { items, page, pageSize: LIST_PAGE_SIZE, total };
  }

  async listAwards(actor: Actor, page: number): Promise<ListPage<Award>> {
    const { rows, total } = await this.repository.awards(this.database, actor.userId, LIST_PAGE_SIZE, (page - 1) * LIST_PAGE_SIZE);
    const items = rows.map((row): Award => ({
      lotId: row.lot_id,
      title: row.title,
      imageUrl: `/api/media/${row.media_key}`,
      amountCents: row.amount_cents,
      settledAt: row.settled_at.toISOString(),
      receiptToken: row.public_token,
    }));
    return { items, page, pageSize: LIST_PAGE_SIZE, total };
  }

  async getSellerSummary(actor: Actor): Promise<SellerSummary> {
    const row = await this.repository.sellerSummary(this.database, actor.userId);
    return { settledCreditCents: row.credit, settled: row.settled, closedNoBids: row.no_bids, open: row.open, pending: row.pending, cancelled: row.cancelled };
  }
}

export function outcomeOf(status: string, leads: boolean, endsAt: Date, now: Date): ParticipationOutcome {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SETTLED") return leads ? "WON" : "LOST";
  if (now.getTime() >= endsAt.getTime()) return leads ? "PENDING" : "LOST";
  return leads ? "LEADING" : "OUTBID";
}
