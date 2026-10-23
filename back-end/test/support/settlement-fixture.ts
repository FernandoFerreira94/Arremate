import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService } from "../../src/audit/audit.service";
import { FileCheckpointStore } from "../../src/audit/checkpoint-store";
import { DatabaseRepository } from "../../src/database/database.repository";
import { SettlementRepository } from "../../src/lots/settlement.repository";
import { SettlementService } from "../../src/lots/settlement.service";
import { ReceiptsRepository } from "../../src/receipts/receipts.repository";
import { ReceiptsService } from "../../src/receipts/receipts.service";
import type { BiddingFixture } from "./bidding-fixture";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Novo "processo": pool, auditoria e serviço próprios sobre o mesmo banco e a mesma testemunha. */
export class Worker {
  readonly database: DatabaseRepository;
  readonly store: FileCheckpointStore;
  readonly audit: AuditService;
  readonly settlement: SettlementService;
  readonly receipts: ReceiptsService;

  constructor(fx: BiddingFixture, repository: SettlementRepository = new SettlementRepository()) {
    this.database = new DatabaseRepository(fx.connectionString);
    this.store = new FileCheckpointStore(fx.store["root"] as string);
    this.audit = new AuditService(new AuditRepository(this.database.connectionPool, "public"), this.store, fx.key);
    this.settlement = new SettlementService(this.database, this.audit, repository);
    this.receipts = new ReceiptsService(new ReceiptsRepository(this.database), this.audit);
  }

  async close(): Promise<void> {
    await this.database.onModuleDestroy();
  }
}

export async function ledger(fx: BiddingFixture, lotId: string): Promise<{ debits: number; credits: number; settlements: number; receipts: number }> {
  const result = await fx.pool.query<{ debits: number; credits: number; settlements: number; receipts: number }>(
    `SELECT (SELECT count(*)::int FROM wallet_entries WHERE reference = $2) AS debits,
            (SELECT count(*)::int FROM wallet_entries WHERE reference = $3) AS credits,
            (SELECT count(*)::int FROM settlements WHERE lot_id = $1) AS settlements,
            (SELECT count(*)::int FROM receipts r JOIN settlements s ON s.id = r.settlement_id WHERE s.lot_id = $1) AS receipts`,
    [lotId, `settle-debit:${lotId}`, `settle-credit:${lotId}`],
  );
  const row = result.rows[0];
  if (!row) throw new Error("ledger ausente");
  return row;
}
