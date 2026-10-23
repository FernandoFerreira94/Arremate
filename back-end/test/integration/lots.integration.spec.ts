import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createApplication } from "../../src/app";
import { AuditService } from "../../src/audit/audit.service";
import { hashPassword } from "../../src/auth/password-hash";
import { createUser, PASSWORD, Session } from "../support/http-session";
import { FakeMet, jpeg, metObject } from "../support/met-fake";

const PREFIX = "tarefa4-lotes-";
const HOUR = 3_600_000;

describe("lotes", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  const fake = new FakeMet();
  const externalIds: string[] = [];
  let app: INestApplication;
  let noAudit: INestApplication;
  let dir = "";
  let passwordHash = "";
  let now = 1_900_000_000_000;

  function work(overrides: Record<string, unknown> = {}): string {
    const id = 8_000_000_000 + Math.floor(Math.random() * 999_999_999);
    externalIds.push(String(id));
    fake.object(metObject(id, overrides));
    fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(640, 480, 16 + (id % 97)));
    return String(id);
  }

  function body(externalId: string, extra: Record<string, unknown> = {}) {
    return {
      externalId,
      initialCents: "100000",
      incrementCents: "5000",
      // folga de 5s (dentro da tolerância de 60s) para não depender da deriva entre o relógio do host e o do PostgreSQL no Docker
      startsAt: new Date(Date.now() - 5_000).toISOString(),
      endsAt: new Date(Date.now() + HOUR).toISOString(),
      ...extra,
    };
  }

  async function login(role: "AUCTIONEER" | "BIDDER"): Promise<{ session: Session; id: string }> {
    const user = await createUser(pool, PREFIX, role, passwordHash);
    const session = new Session(app);
    await session.login(user.email);
    return { session, id: user.id };
  }

  async function publish(session: Session, payload: object = body(work())) {
    return session.post("/api/lots", payload, { "Idempotency-Key": randomUUID() });
  }

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    dir = await mkdtemp(join(tmpdir(), "lots-"));
    const common = {
      connectionString,
      logger: false as const,
      now: () => now,
      allowedOrigins: ["http://127.0.0.1:3300"],
      catalogFetch: fake.fetch,
      catalogLookup: fake.lookup,
      mediaDir: join(dir, "media"),
    };
    app = await createApplication({ ...common, auditKey: randomBytes(32), witnessDir: join(dir, "witness") });
    await app.init();
    noAudit = await createApplication({ ...common, auditKey: null });
    await noAudit.init();
  });

  beforeEach(() => {
    now += 120_000;
    fake.down = false;
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    await pool.query(`DELETE FROM bids WHERE lot_id IN (SELECT id FROM lots WHERE owner_id IN (${users}))`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM idempotency_records WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM catalog_item_snapshots WHERE provider = 'met' AND external_id = ANY($1::text[])`, [externalIds]);
    await pool.query(`DELETE FROM sessions WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await noAudit?.close();
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  });

  it("publica a partir do snapshot confiável, com gênese de auditoria íntegra", async () => {
    const { session, id } = await login("AUCTIONEER");
    const externalId = work({ title: "<img src=x onerror=alert(1)>" });
    const response = await publish(session, body(externalId));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      externalId,
      title: "<img src=x onerror=alert(1)>",
      initialCents: "100000",
      incrementCents: "5000",
      currentCents: null,
      minimumNextCents: "100000",
      bidCount: 0,
      state: "LIVE",
      settlementPending: false,
    });
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body.imageUrl).toMatch(/^\/api\/media\/[a-f0-9]{64}\.jpg$/);
    expect(JSON.stringify(response.body)).not.toContain(id);
    const row = await pool.query<{ owner_id: string; revision: number }>(`SELECT owner_id, revision FROM lots WHERE id = $1`, [response.body.id]);
    expect(row.rows[0]).toMatchObject({ owner_id: id, revision: 0 });
    expect((await app.get(AuditService).verifyLot(response.body.id)).status).toBe("INTACT");
    expect((await request(app.getHttpServer()).get(response.body.imageUrl)).status).toBe(200);
  });

  it("repete o resultado com a mesma chave e corpo e recusa corpo diferente", async () => {
    const { session, id } = await login("AUCTIONEER");
    const key = randomUUID();
    const payload = body(work());
    const [first, second] = await Promise.all([
      session.post("/api/lots", payload, { "Idempotency-Key": key }),
      session.post("/api/lots", payload, { "Idempotency-Key": key }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 201]);
    expect(first.body.id).toBe(second.body.id);
    const changed = await session.post("/api/lots", { ...payload, initialCents: "100001" }, { "Idempotency-Key": key });
    expect(changed.status).toBe(409);
    expect(changed.body.code).toBe("IDEMPOTENCIA_CONFLITO");
    const missing = await session.post("/api/lots", payload);
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("IDEMPOTENCIA_INVALIDA");
    expect((await session.post("/api/lots", payload, { "Idempotency-Key": "abc" })).body.code).toBe("IDEMPOTENCIA_INVALIDA");
    const lots = await pool.query(`SELECT id FROM lots WHERE owner_id = $1`, [id]);
    expect(lots.rowCount).toBe(1);
  });

  it("recusa valores zero, negativos, decimais e acima do teto", async () => {
    const { session, id } = await login("AUCTIONEER");
    const externalId = work();
    for (const value of ["0", "-1", "1.5", "1e3", "01", "1000000000000", ""]) {
      const initial = await publish(session, body(externalId, { initialCents: value }));
      const increment = await publish(session, body(externalId, { incrementCents: value }));
      expect(initial.status).toBe(400);
      expect(increment.status).toBe(400);
    }
    expect((await publish(session, body(externalId, { initialCents: 1000 }))).status).toBe(400);
    expect((await publish(session, body(externalId, { initialCents: "999999999999" }))).status).toBe(201);
    const lots = await pool.query(`SELECT id FROM lots WHERE owner_id = $1`, [id]);
    expect(lots.rowCount).toBe(1);
  });

  it("recusa datas inválidas, início no passado e fim antes do início", async () => {
    const { session } = await login("AUCTIONEER");
    const externalId = work();
    const start = Date.now() + HOUR;
    const cases = [
      { startsAt: "amanhã" },
      { startsAt: "2026-13-01T00:00:00Z" },
      { startsAt: new Date(Date.now() - 10 * 60_000).toISOString() },
      { startsAt: new Date(start).toISOString(), endsAt: new Date(start).toISOString() },
      { startsAt: new Date(start).toISOString(), endsAt: new Date(start - 1).toISOString() },
    ];
    for (const extra of cases) {
      const response = await publish(session, body(externalId, extra));
      expect(response.status).toBe(400);
    }
    const scheduled = await publish(session, body(externalId, { startsAt: new Date(start).toISOString(), endsAt: new Date(start + HOUR).toISOString() }));
    expect(scheduled.status).toBe(201);
    expect(scheduled.body.state).toBe("SCHEDULED");
  });

  it("recusa atribuição em massa e papel errado sem gravar", async () => {
    const { session, id } = await login("AUCTIONEER");
    const other = await createUser(pool, PREFIX, "AUCTIONEER", passwordHash);
    const externalId = work();
    for (const extra of [{ ownerId: other.id }, { title: "Falso" }, { mediaKey: "x.jpg" }, { status: "SETTLED" }, { snapshotId: randomUUID() }, { revision: 5 }]) {
      const response = await publish(session, body(externalId, extra));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("REQUISICAO_INVALIDA");
    }
    const bidder = await login("BIDDER");
    expect((await publish(bidder.session, body(externalId))).status).toBe(403);
    const lots = await pool.query(`SELECT id FROM lots WHERE owner_id IN ($1, $2, $3)`, [id, other.id, bidder.id]);
    expect(lots.rowCount).toBe(0);
  });

  it("recusa obra sem domínio público sem deixar snapshot nem lote", async () => {
    const { session, id } = await login("AUCTIONEER");
    const externalId = work({ isPublicDomain: false });
    const response = await publish(session, body(externalId));
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("LICENCA_RECUSADA");
    expect((await pool.query(`SELECT 1 FROM catalog_item_snapshots WHERE external_id = $1`, [externalId])).rowCount).toBe(0);
    expect((await pool.query(`SELECT 1 FROM lots WHERE owner_id = $1`, [id])).rowCount).toBe(0);
  });

  it("falha fechado com 503 quando a auditoria não tem chave", async () => {
    const user = await createUser(pool, PREFIX, "AUCTIONEER", passwordHash);
    const session = new Session(noAudit);
    await session.login(user.email);
    const response = await session.post("/api/lots", body(work()), { "Idempotency-Key": randomUUID() });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("AUDITORIA_INDISPONIVEL");
    expect((await pool.query(`SELECT 1 FROM lots WHERE owner_id = $1`, [user.id])).rowCount).toBe(0);
  });

  it("cancela só o próprio lote, sem lances, antes do fim, e o esconde da vitrine", async () => {
    const owner = await login("AUCTIONEER");
    const other = await login("AUCTIONEER");
    const created = await publish(owner.session);
    const lotId = created.body.id as string;

    const foreign = await other.session.post(`/api/lots/${lotId}/cancel`, {});
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain(owner.id);
    expect((await other.session.post(`/api/lots/${lotId}/cancel`, { userId: owner.id })).status).toBe(400);

    const cancelled = await owner.session.post(`/api/lots/${lotId}/cancel`, {});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe("CANCELLED");
    const revision = await pool.query<{ revision: number }>(`SELECT revision FROM lots WHERE id = $1`, [lotId]);
    expect(revision.rows[0]?.revision).toBe(0);
    expect((await app.get(AuditService).verifyLot(lotId)).status).toBe("INTACT");
    const again = await owner.session.post(`/api/lots/${lotId}/cancel`, {});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("LOTE_NAO_CANCELAVEL");

    const showcaseIds: string[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const list = await request(app.getHttpServer()).get(`/api/lots?page=${page}`);
      expect(list.status).toBe(200);
      expect(list.body.pageSize).toBe(8);
      expect(list.body.items.length).toBeLessThanOrEqual(8);
      showcaseIds.push(...list.body.items.map((item: { id: string }) => item.id));
      if (list.body.items.length < 8) break;
    }
    expect(showcaseIds).not.toContain(lotId);
    expect((await request(app.getHttpServer()).get(`/api/lots/${lotId}`)).body.state).toBe("CANCELLED");
    const mine = await owner.session.get("/api/seller/lots");
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((item: { id: string }) => item.id)).toContain(lotId);
    expect((await other.session.get("/api/seller/lots")).body.items.map((item: { id: string }) => item.id)).not.toContain(lotId);
  });

  it("não cancela com lance nem depois do fim", async () => {
    const owner = await login("AUCTIONEER");
    const bidder = await login("BIDDER");
    const withBid = await publish(owner.session);
    await pool.query(
      `INSERT INTO bids (lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature) VALUES ($1, $2, 'Licitante 1', 1, 100000, clock_timestamp(), 'assinatura-teste')`,
      [withBid.body.id, bidder.id],
    );
    const blocked = await owner.session.post(`/api/lots/${withBid.body.id}/cancel`, {});
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("LOTE_COM_LANCES");
    const bids = await request(app.getHttpServer()).get(`/api/lots/${withBid.body.id}/bids`);
    expect(bids.status).toBe(200);
    expect(bids.body.items).toEqual([{ alias: "Licitante 1", amountCents: "100000", sequence: 1, acceptedAt: expect.any(String) }]);
    const detail = await request(app.getHttpServer()).get(`/api/lots/${withBid.body.id}`);
    expect(detail.body).toMatchObject({ currentCents: "100000", minimumNextCents: "105000", bidCount: 1 });

    const ended = await publish(owner.session);
    await pool.query(`UPDATE lots SET starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 hour' WHERE id = $1`, [ended.body.id]);
    const late = await owner.session.post(`/api/lots/${ended.body.id}/cancel`, {});
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("LOTE_NAO_CANCELAVEL");
    const view = await request(app.getHttpServer()).get(`/api/lots/${ended.body.id}`);
    expect(view.body).toMatchObject({ state: "ENDED", settlementPending: true });
  });

  it("lista, detalha e serve mídia com o provedor fora do ar", async () => {
    const owner = await login("AUCTIONEER");
    const created = await publish(owner.session);
    fake.down = true;
    const list = await request(app.getHttpServer()).get("/api/lots");
    expect(list.status).toBe(200);
    expect(typeof list.body.serverNow).toBe("string");
    const detail = await request(app.getHttpServer()).get(`/api/lots/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect((await request(app.getHttpServer()).get(detail.body.imageUrl)).status).toBe(200);
    expect((await request(app.getHttpServer()).get("/api/lots/nao-e-uuid")).status).toBe(404);
    expect((await request(app.getHttpServer()).get(`/api/lots/${randomUUID()}`)).status).toBe(404);
    expect((await request(app.getHttpServer()).get("/api/lots?page=0")).status).toBe(400);
  });
});
