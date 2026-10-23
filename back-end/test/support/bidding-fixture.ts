import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import { Pool } from "pg";
import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService } from "../../src/audit/audit.service";
import { FileCheckpointStore } from "../../src/audit/checkpoint-store";
import type { Actor } from "../../src/auth/auth.service";
import { DatabaseRepository } from "../../src/database/database.repository";
import { BiddingRepository } from "../../src/lots/bidding.repository";
import { BiddingService } from "../../src/lots/bidding.service";

export type LotOptions = { startsInMs?: number; endsInMs?: number; initialCents?: bigint; incrementCents?: bigint };

export class BiddingFixture {
  readonly pool: Pool;
  readonly database: DatabaseRepository;
  readonly key = randomBytes(32);
  store!: FileCheckpointStore;
  audit!: AuditService;
  service!: BiddingService;
  dir = "";

  constructor(
    readonly prefix: string,
    readonly connectionString: string,
  ) {
    this.pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 6 });
    this.database = new DatabaseRepository(connectionString);
  }

  async init(): Promise<void> {
    this.dir = await mkdtemp(join(tmpdir(), "lances-"));
    this.store = new FileCheckpointStore(join(this.dir, "witness"));
    this.audit = new AuditService(new AuditRepository(this.database.connectionPool, "public"), this.store, this.key);
    this.service = new BiddingService(this.database, this.audit, new BiddingRepository());
  }

  async user(role: "AUCTIONEER" | "BIDDER", passwordHash = "hash-de-teste"): Promise<Actor & { email: string }> {
    const email = `${this.prefix}${randomUUID()}@example.com`;
    const inserted = await this.pool.query<{ id: string }>(`INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3) RETURNING id`, [email, role, passwordHash]);
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("usuário de teste não criado");
    return { userId: id, role, email };
  }

  async bidder(totalCents: bigint, passwordHash?: string): Promise<Actor & { email: string }> {
    const actor = await this.user("BIDDER", passwordHash);
    if (totalCents > 0n) {
      const wallet = await this.pool.query<{ id: string }>(`INSERT INTO wallets (user_id, total_cents) VALUES ($1, $2) RETURNING id`, [actor.userId, totalCents.toString()]);
      await this.pool.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, 'DEPOSIT', $2, $3)`, [
        wallet.rows[0]?.id,
        totalCents.toString(),
        `teste:${randomUUID()}`,
      ]);
    }
    return actor;
  }

  async lot(owner: Actor, options: LotOptions = {}): Promise<string> {
    const snapshot = await this.pool.query<{ id: string }>(
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('teste', $1, 'Obra de teste', '{}'::jsonb, 'Crédito de teste', 'CC0', 'teste.jpg') RETURNING id`,
      [`${this.prefix}${randomUUID()}`],
    );
    const lot = await this.pool.query<{ id: string }>(
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, date_trunc('milliseconds', clock_timestamp()) + ($5::int * interval '1 millisecond'),
               date_trunc('milliseconds', clock_timestamp()) + ($6::int * interval '1 millisecond')) RETURNING id`,
      [
        owner.userId,
        snapshot.rows[0]?.id,
        (options.initialCents ?? 10000n).toString(),
        (options.incrementCents ?? 500n).toString(),
        options.startsInMs ?? -1000,
        options.endsInMs ?? 3_600_000,
      ],
    );
    const id = lot.rows[0]?.id;
    if (!id) throw new Error("lote de teste não criado");
    await this.audit.openGenesis(id);
    return id;
  }

  async wallet(userId: string): Promise<{ total: bigint; committed: bigint; reserved: bigint; released: bigint }> {
    const result = await this.pool.query<{ total: string; committed: string; reserved: string; released: string }>(
      `SELECT w.total_cents::text AS total, w.committed_cents::text AS committed,
              COALESCE(SUM(e.amount_cents) FILTER (WHERE e.kind = 'RESERVE'), 0)::text AS reserved,
              COALESCE(SUM(e.amount_cents) FILTER (WHERE e.kind = 'RELEASE'), 0)::text AS released
       FROM wallets w LEFT JOIN wallet_entries e ON e.wallet_id = w.id WHERE w.user_id = $1 GROUP BY w.id`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return { total: 0n, committed: 0n, reserved: 0n, released: 0n };
    return { total: BigInt(row.total), committed: BigInt(row.committed), reserved: BigInt(row.reserved), released: BigInt(row.released) };
  }

  async lotRow(lotId: string): Promise<{ endsAt: Date; revision: number; status: string; bids: number }> {
    const result = await this.pool.query<{ ends_at: Date; revision: number; status: string; bids: number }>(
      `SELECT ends_at, revision, status::text AS status, (SELECT count(*)::int FROM bids WHERE lot_id = $1) AS bids FROM lots WHERE id = $1`,
      [lotId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("lote ausente");
    return { endsAt: row.ends_at, revision: row.revision, status: row.status, bids: row.bids };
  }

  /** Reserva = soma dos lances líderes; ledger reconcilia; nenhum saldo negativo; cadeia íntegra. */
  async assertInvariants(lotIds: readonly string[]): Promise<void> {
    const wallets = await this.pool.query<{ ok: boolean }>(
      `SELECT bool_and(w.committed_cents >= 0 AND w.committed_cents <= w.total_cents
         AND w.committed_cents = COALESCE((SELECT SUM(CASE e.kind WHEN 'RESERVE' THEN e.amount_cents WHEN 'RELEASE' THEN -e.amount_cents ELSE 0 END)
                                           FROM wallet_entries e WHERE e.wallet_id = w.id), 0)
         AND w.committed_cents = COALESCE((SELECT SUM(b.amount_cents) FROM bids b
                                           WHERE b.user_id = w.user_id AND b.amount_cents = (SELECT max(amount_cents) FROM bids x WHERE x.lot_id = b.lot_id)), 0)) AS ok
       FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.email LIKE $1`,
      [`${this.prefix}%`],
    );
    if (wallets.rows[0]?.ok === false) throw new Error("invariante de carteira violada");
    for (const lotId of lotIds) {
      const verified = await this.audit.verifyLot(lotId);
      if (verified.status !== "INTACT") throw new Error(`auditoria ${verified.status} em ${lotId}`);
      const sequences = await this.pool.query<{ ok: boolean }>(
        `SELECT count(*) = COALESCE(max(sequence), 0) AND bool_and(char_length(signature) > 0) IS NOT FALSE AS ok FROM bids WHERE lot_id = $1`,
        [lotId],
      );
      if (sequences.rows[0]?.ok !== true) throw new Error("contador de lances divergente");
    }
  }

  /**
   * Lance assinado pela cadeia real sem a regra de prorrogação: permite lotes que terminam em segundos
   * nos testes de liquidação. Reserva e liberação seguem o mesmo ledger do lance de produção.
   */
  async seedBid(lotId: string, actor: Actor, amount: bigint): Promise<string> {
    const repository = new BiddingRepository();
    const bidId = randomUUID();
    await this.audit.acceptBidAtomic<void>(lotId, async (client) => {
      const lot = await repository.lockLot(client, lotId);
      if (!lot) throw new Error("lote ausente");
      const leader = await repository.leader(client, lotId);
      const wallets = await repository.lockWallets(client, leader ? [actor.userId, leader.user_id] : [actor.userId]);
      const alias = await repository.aliasFor(client, lotId, actor.userId);
      const acceptedAt = (await repository.clock(client)).toISOString();
      return {
        kind: "accept",
        draft: { bidId, bidderUserId: actor.userId, alias, amountCents: amount, acceptedAt, endsAt: lot.ends_at.toISOString() },
        finish: async (tx) => {
          const previous = leader ? wallets.get(leader.user_id) : undefined;
          if (leader && previous) await repository.moveReservation(tx, previous.id, "RELEASE", BigInt(leader.amount_cents), `release:${leader.id}`);
          const own = wallets.get(actor.userId);
          if (!own) throw new Error("carteira ausente");
          await repository.moveReservation(tx, own.id, "RESERVE", amount, `reserve:${bidId}`);
        },
      };
    });
    return bidId;
  }

  async cleanup(): Promise<void> {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    const p = [`${this.prefix}%`];
    await this.pool.query(`DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (${users}))`, p);
    await this.pool.query(`DELETE FROM wallets WHERE user_id IN (${users})`, p);
    await this.pool.query(`DELETE FROM idempotency_records WHERE user_id IN (${users})`, p);
    const owned = `SELECT id FROM lots WHERE owner_id IN (${users})`;
    await this.pool.query(`DELETE FROM receipts WHERE settlement_id IN (SELECT id FROM settlements WHERE lot_id IN (${owned}))`, p);
    await this.pool.query(`DELETE FROM settlements WHERE lot_id IN (${owned})`, p);
    await this.pool.query(`DELETE FROM bids WHERE lot_id IN (SELECT id FROM lots WHERE owner_id IN (${users}))`, p);
    await this.pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, p);
    await this.pool.query(`DELETE FROM catalog_item_snapshots WHERE provider = 'teste' AND external_id LIKE $1`, p);
    await this.pool.query(`DELETE FROM sessions WHERE user_id IN (${users})`, p);
    await this.pool.query(`DELETE FROM users WHERE email LIKE $1`, p);
    await this.pool.end();
    await this.database.onModuleDestroy();
    await rm(this.dir, { recursive: true, force: true });
  }
}

export async function outcome(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return "ACEITO";
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === "object" && body !== null && "code" in body) return String(body.code);
    }
    throw error;
  }
}

export const money = (value: bigint): string => value.toString();
