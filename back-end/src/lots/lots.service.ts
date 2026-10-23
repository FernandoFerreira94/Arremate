import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import type { AuditService } from "../audit/audit.service";
import { CatalogService } from "../catalog/catalog.service";
import { MoneyError, parsePositiveMoney } from "../common/money";
import { DatabaseRepository } from "../database/database.repository";
import type { CreateLotDto } from "./dto/create-lot.dto";
import { LotsRepository, type LotRow } from "./lots.repository";

export const SHOWCASE_PAGE_SIZE = 8;
export const START_TOLERANCE_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_OPERATION = "lot.create";

export type LotState = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
/** Resultado distinguível na UI: encerrado aguardando liquidação, liquidado ou sem lances. */
export type LotResult = "OPEN" | "CLOSED_PENDING" | "SETTLED" | "CLOSED_NO_BIDS" | "CANCELLED";

export type LotView = {
  id: string;
  externalId: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  dimensions: string;
  credit: string;
  license: string;
  sourceUrl: string | null;
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
  result: LotResult;
  serverNow: string;
};

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number; serverNow: string };

export class LotsService {
  private readonly logger = new Logger(LotsService.name);

  constructor(
    private readonly database: DatabaseRepository,
    private readonly lots: LotsRepository,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService | null,
  ) {}

  async showcase(page: number): Promise<Paged<LotView>> {
    const { rows, total } = await this.lots.showcase(SHOWCASE_PAGE_SIZE, (page - 1) * SHOWCASE_PAGE_SIZE);
    return this.paged(rows, page, SHOWCASE_PAGE_SIZE, total);
  }

  async sellerLots(actor: Actor, page: number, limit: number): Promise<Paged<LotView>> {
    const { rows, total } = await this.lots.ownedBy(actor.userId, limit, (page - 1) * limit);
    return this.paged(rows, page, limit, total);
  }

  async detail(lotId: string): Promise<LotView> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const row = await this.lots.find(lotId);
    if (!row) throw new ApiException(404, "NAO_ENCONTRADO");
    return toView(row);
  }

  async bids(lotId: string, page: number, limit: number) {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    if (!(await this.lots.find(lotId))) throw new ApiException(404, "NAO_ENCONTRADO");
    const { rows, total } = await this.lots.bids(lotId, limit, (page - 1) * limit);
    return {
      items: rows.map((row) => ({ alias: row.alias, amountCents: row.amount_cents, sequence: row.sequence, acceptedAt: row.accepted_at.toISOString() })),
      page,
      pageSize: limit,
      total,
    };
  }

  async createLot(actor: Actor, input: CreateLotDto, idempotencyKey: string | undefined): Promise<LotView> {
    if (typeof idempotencyKey !== "string" || !UUID.test(idempotencyKey)) throw new ApiException(400, "IDEMPOTENCIA_INVALIDA");
    const key = idempotencyKey.toLowerCase();
    const initial = money(input.initialCents);
    const increment = money(input.incrementCents);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
      throw new ApiException(400, "DATAS_INVALIDAS");
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify([input.externalId, initial.toString(), increment.toString(), startsAt.toISOString(), endsAt.toISOString()]))
      .digest("hex");
    const previous = await this.findRecord(actor.userId, key);
    if (previous) return this.replay(previous, requestHash);
    const now = await this.lots.clock();
    if (startsAt.getTime() < now.getTime() - START_TOLERANCE_MS || endsAt.getTime() <= now.getTime()) {
      throw new ApiException(400, "DATAS_INVALIDAS");
    }
    if (!this.audit) throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    const snapshot = await this.catalog.importItem(input.externalId);
    const created = await this.database.transaction(async (client) => {
      const lot = await client.query<{ id: string }>(
        `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [actor.userId, snapshot.id, initial.toString(), increment.toString(), startsAt.toISOString(), endsAt.toISOString()],
      );
      const lotId = lot.rows[0]?.id;
      if (!lotId) throw new Error("lote não criado");
      const record = await client.query(
        `INSERT INTO idempotency_records (user_id, operation, resource_key, idempotency_key, request_hash, response)
         VALUES ($1, $2, 'lots', $3, $4, $5::jsonb)
         ON CONFLICT (user_id, operation, resource_key, idempotency_key) DO NOTHING RETURNING id`,
        [actor.userId, CREATE_OPERATION, key, requestHash, JSON.stringify({ lotId })],
      );
      if (record.rowCount !== 1) return null;
      return lotId;
    });
    if (!created) {
      const winner = await this.findRecord(actor.userId, key);
      if (!winner) throw new ApiException(409, "IDEMPOTENCIA_CONFLITO");
      return this.replay(winner, requestHash);
    }
    try {
      await this.audit.openGenesis(created);
    } catch {
      this.logger.error("Gênese de auditoria falhou; publicação desfeita.");
      await this.database.transaction(async (client) => {
        await client.query(`DELETE FROM idempotency_records WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3`, [actor.userId, CREATE_OPERATION, key]);
        await client.query(`DELETE FROM lots WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM bids WHERE lot_id = $1)`, [created]);
      });
      throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    }
    return this.detail(created);
  }

  async cancelLot(actor: Actor, lotId: string): Promise<LotView> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    await this.database.transaction(async (client) => {
      const locked = await client.query<{ owner_id: string; status: string; ended: boolean }>(
        `SELECT owner_id, status::text AS status, ends_at <= clock_timestamp() AS ended FROM lots WHERE id = $1 FOR UPDATE`,
        [lotId],
      );
      const lot = locked.rows[0];
      if (!lot || lot.owner_id !== actor.userId) throw new ApiException(404, "NAO_ENCONTRADO");
      if (lot.status !== "PUBLISHED" || lot.ended) throw new ApiException(409, "LOTE_NAO_CANCELAVEL");
      const bids = await client.query(`SELECT 1 FROM bids WHERE lot_id = $1 LIMIT 1`, [lotId]);
      if ((bids.rowCount ?? 0) > 0) throw new ApiException(409, "LOTE_COM_LANCES");
      await client.query(`UPDATE lots SET status = 'CANCELLED' WHERE id = $1`, [lotId]);
    });
    return this.detail(lotId);
  }

  private async findRecord(userId: string, key: string): Promise<{ request_hash: string; response: { lotId?: string } } | null> {
    const result = await this.database.query<{ request_hash: string; response: { lotId?: string } }>(
      `SELECT request_hash, response FROM idempotency_records
       WHERE user_id = $1 AND operation = $2 AND resource_key = 'lots' AND idempotency_key = $3`,
      [userId, CREATE_OPERATION, key],
    );
    return result.rows[0] ?? null;
  }

  private async replay(record: { request_hash: string; response: { lotId?: string } }, requestHash: string): Promise<LotView> {
    if (record.request_hash !== requestHash || typeof record.response.lotId !== "string") throw new ApiException(409, "IDEMPOTENCIA_CONFLITO");
    return this.detail(record.response.lotId);
  }

  private async paged(rows: LotRow[], page: number, pageSize: number, total: number): Promise<Paged<LotView>> {
    const serverNow = rows[0]?.server_now ?? (await this.lots.clock());
    return { items: rows.map(toView), page, pageSize, total, serverNow: serverNow.toISOString() };
  }
}

function money(value: string): bigint {
  try {
    return parsePositiveMoney(value);
  } catch (error) {
    if (error instanceof MoneyError) throw new ApiException(400, "VALOR_INVALIDO");
    throw error;
  }
}

export function lotState(status: string, startsAt: Date, endsAt: Date, now: Date): LotState {
  if (status === "CANCELLED") return "CANCELLED";
  if (status !== "PUBLISHED") return "ENDED";
  if (now.getTime() < startsAt.getTime()) return "SCHEDULED";
  if (now.getTime() < endsAt.getTime()) return "LIVE";
  return "ENDED";
}

export function lotResult(status: string, endsAt: Date, now: Date): LotResult {
  if (status === "CANCELLED" || status === "SETTLED" || status === "CLOSED_NO_BIDS") return status;
  return now.getTime() >= endsAt.getTime() ? "CLOSED_PENDING" : "OPEN";
}

function toView(row: LotRow): LotView {
  const state = lotState(row.status, row.starts_at, row.ends_at, row.server_now);
  const attributes = row.attributes ?? {};
  const textOf = (name: string): string => (typeof attributes[name] === "string" ? (attributes[name] as string) : "");
  const current = row.current_cents;
  return {
    id: row.id,
    externalId: row.external_id,
    title: row.title,
    artist: textOf("artist"),
    date: textOf("date"),
    medium: textOf("medium"),
    dimensions: textOf("dimensions"),
    credit: row.credit,
    license: row.license,
    sourceUrl: textOf("sourceUrl") || null,
    imageUrl: `/api/media/${row.media_key}`,
    initialCents: row.initial_cents,
    incrementCents: row.increment_cents,
    currentCents: current,
    minimumNextCents: current === null ? row.initial_cents : (BigInt(current) + BigInt(row.increment_cents)).toString(),
    bidCount: row.bid_count,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    state,
    settlementPending: state === "ENDED" && (row.status === "PUBLISHED" || row.status === "CLOSED_PENDING"),
    result: lotResult(row.status, row.ends_at, row.server_now),
    serverNow: row.server_now.toISOString(),
  };
}
