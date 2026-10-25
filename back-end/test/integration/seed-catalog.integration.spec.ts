import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService } from "../../src/audit/audit.service";
import { FileCheckpointStore } from "../../src/audit/checkpoint-store";
import { CatalogService } from "../../src/catalog/catalog.service";
import { MediaStore } from "../../src/catalog/image-importer";
import { MetCatalogClient } from "../../src/catalog/met-catalog.client";
import { DatabaseRepository } from "../../src/database/database.repository";
import { BiddingRepository } from "../../src/lots/bidding.repository";
import { BiddingService } from "../../src/lots/bidding.service";
import { LotsRepository } from "../../src/lots/lots.repository";
import { LotsService } from "../../src/lots/lots.service";
import { SettlementRepository } from "../../src/lots/settlement.repository";
import { SettlementService } from "../../src/lots/settlement.service";
import { WalletsRepository } from "../../src/wallets/wallets.repository";
import { WalletsService } from "../../src/wallets/wallets.service";
import { demoPasswordHash, ensureUser } from "../../prisma/seed";
import { DEMO_CATALOG, DEMO_DEPOSITS_REAIS, bidAmounts, bidderOrder, runCatalogSeed, type CatalogSeedOptions } from "../../prisma/seed-catalog";
import { FakeMet, jpeg, metObject } from "../support/met-fake";

jest.setTimeout(400_000);

describe("catalogo de demonstracao com 36 obras (D17 + D19)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const prefix = `catalogo-${randomUUID().slice(0, 8)}-`;
  const pool = new Pool({ connectionString, max: 4 });
  const database = new DatabaseRepository(connectionString);
  const fake = new FakeMet();
  let dir = "";
  let audit: AuditService;
  let options: CatalogSeedOptions;
  let lotIds: string[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "seed-catalogo-"));
    for (const entry of DEMO_CATALOG) {
      const id = Number(entry.externalId);
      // 437329 usa o fixture real (o seed de demo da Tarefa 10 confere titulo e credito dessa obra).
      fake.object(id === 437329 ? metObject(id) : metObject(id, { title: `Obra ${entry.lot}`, artistDisplayBio: "Bio de teste", creditLine: `Credito ${entry.lot}` }));
      fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(800, 600));
    }
    audit = new AuditService(new AuditRepository(database.connectionPool, "public"), new FileCheckpointStore(join(dir, "witness")), randomBytes(32));
    const catalog = new CatalogService(new MetCatalogClient({ fetch: fake.fetch, lookup: fake.lookup }), database, new MediaStore(join(dir, "media")));
    const hashed = await demoPasswordHash("senha-ficticia-de-teste");
    const ownerId = await ensureUser(pool, `${prefix}leiloeiro@arremate.demo`, "AUCTIONEER", hashed);
    const bidderIds: string[] = [];
    for (const n of [1, 2, 3, 4]) bidderIds.push(await ensureUser(pool, `${prefix}licitante${n}@arremate.demo`, "BIDDER", hashed));
    options = {
      pool,
      catalog,
      lots: new LotsService(database, new LotsRepository(database), catalog, audit),
      bidding: new BiddingService(database, audit, new BiddingRepository()),
      wallets: new WalletsService(database, new WalletsRepository(database)),
      settlement: new SettlementService(database, audit, new SettlementRepository()),
      ownerId,
      bidderIds,
    };
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    const p = [`${prefix}%`];
    const owned = `SELECT id FROM lots WHERE owner_id IN (${users})`;
    await pool.query(`DELETE FROM receipts WHERE settlement_id IN (SELECT id FROM settlements WHERE lot_id IN (${owned}))`, p);
    await pool.query(`DELETE FROM settlements WHERE lot_id IN (${owned})`, p);
    await pool.query(`DELETE FROM bids WHERE lot_id IN (${owned})`, p);
    await pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, p);
    await pool.query(`DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (${users}))`, p);
    await pool.query(`DELETE FROM wallets WHERE user_id IN (${users})`, p);
    await pool.query(`DELETE FROM idempotency_records WHERE user_id IN (${users})`, p);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, p);
    await pool.end();
    await database.onModuleDestroy();
    await rm(dir, { recursive: true, force: true });
  });

  it("planos de lance sao validos: crescentes, acima do incremento e sem licitante repetido em sequencia", () => {
    expect(DEMO_CATALOG).toHaveLength(36);
    expect(new Set(DEMO_CATALOG.map((e) => e.externalId)).size).toBe(36);
    for (const e of DEMO_CATALOG) {
      expect(e.estimate[0]).toBeLessThanOrEqual(e.estimate[1]);
      if (!e.bids) continue;
      const a = bidAmounts(e.initial, e.bids.final, e.bids.n);
      expect(a[0]).toBe(e.initial);
      expect(a.at(-1)).toBe(e.bids.final);
      const o = bidderOrder(e.bids.n, e.bids.winner, e.bids.with);
      expect(o.at(-1)).toBe(e.bids.winner);
      for (let i = 1; i < o.length; i += 1) expect(o[i]).not.toBe(o[i - 1]);
    }
  });

  it("cria 36 lotes pelos servicos, liquida os encerrados e mantem auditoria integra", async () => {
    const result = await runCatalogSeed(options);
    expect(result.warnings).toEqual([]);
    expect(result.created).toHaveLength(36);
    lotIds = result.created.map((c) => c.lotId);
    const rows = await pool.query<{ status: string; n: number; low: string | null; report: string | null }>(
      `SELECT l.status::text AS status, (SELECT count(*)::int FROM bids b WHERE b.lot_id = l.id) AS n,
              l.estimate_low_cents::text AS low, l.condition_report AS report
       FROM lots l WHERE l.id = ANY($1::uuid[])`,
      [lotIds],
    );
    const by = (s: string) => rows.rows.filter((r) => r.status === s).length;
    expect(by("SETTLED")).toBe(10);
    expect(by("CLOSED_NO_BIDS")).toBe(2);
    expect(by("PUBLISHED")).toBe(24);
    expect(rows.rows.every((r) => r.low !== null && r.report)).toBe(true);
    const totalBids = DEMO_CATALOG.reduce((s, e) => s + (e.bids?.n ?? 0), 0);
    expect(rows.rows.reduce((s, r) => s + r.n, 0)).toBe(totalBids);
    expect((await pool.query(`SELECT 1 FROM receipts r JOIN settlements s ON s.id = r.settlement_id WHERE s.lot_id = ANY($1::uuid[])`, [lotIds])).rowCount).toBe(10);
    for (const id of lotIds) expect((await audit.verifyLot(id)).status).toBe("INTACT");
    const wallets = await pool.query<{ ok: boolean }>(
      `SELECT bool_and(committed_cents <= total_cents) AS ok FROM wallets WHERE user_id = ANY($1::uuid[])`,
      [options.bidderIds],
    );
    expect(wallets.rows[0]?.ok).toBe(true);
    const view = await options.lots.detail(lotIds[0] as string);
    expect(view.estimate).toMatchObject({ simulated: true });
    expect(view.conditionReport).toMatchObject({ simulated: true });
    expect(view.artistBio).toBe("Bio de teste");
  });

  it("reexecutar nao cria lote, nao repete deposito e nao muda saldo", async () => {
    const snapshot = async () =>
      (await pool.query<{ t: string }>(`SELECT string_agg(total_cents::text || '/' || committed_cents::text, ',' ORDER BY user_id) AS t FROM wallets WHERE user_id = ANY($1::uuid[])`, [options.bidderIds])).rows[0]?.t;
    const before = await snapshot();
    const lots = async () => (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM lots WHERE owner_id = $1`, [options.ownerId])).rows[0]?.n;
    const again = await runCatalogSeed(options);
    expect(again.created).toHaveLength(0);
    expect(again.skipped).toHaveLength(36);
    expect(await lots()).toBe(36);
    expect(await snapshot()).toBe(before);
    const deposits = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM wallet_entries e JOIN wallets w ON w.id = e.wallet_id WHERE w.user_id = ANY($1::uuid[]) AND e.kind = 'DEPOSIT'`,
      [options.bidderIds],
    );
    expect(deposits.rows[0]?.n).toBe(4 * DEMO_DEPOSITS_REAIS.length);
  });
});
