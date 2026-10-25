import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createApplication } from "../../src/app";
import { hashPassword } from "../../src/auth/password-hash";
import { LotsService } from "../../src/lots/lots.service";
import { createUser, ORIGIN, PASSWORD, Session } from "../support/http-session";

const PREFIX = "d21-avisos-";

describe("avise-me e notificações (D21)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  let app: INestApplication;
  let passwordHash = "";
  let ownerId = "";

  async function lot(window: "scheduled" | "open"): Promise<string> {
    const snapshot = await pool.query<{ id: string }>(
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', $1, 'Obra agendada', '{}'::jsonb, 'Met', 'CC0', $2) RETURNING id`,
      [`${PREFIX}${randomUUID()}`, `media/${randomUUID()}`],
    );
    const timing =
      window === "scheduled"
        ? `statement_timestamp() + interval '1 hour', statement_timestamp() + interval '2 hours'`
        : `statement_timestamp(), statement_timestamp() + interval '1 hour'`;
    const created = await pool.query<{ id: string }>(
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at, status)
       VALUES ($1, $2, 1000, 100, ${timing}, 'PUBLISHED') RETURNING id`,
      [ownerId, snapshot.rows[0]?.id],
    );
    const id = created.rows[0]?.id;
    if (!id) throw new Error("lote de teste não foi criado");
    return id;
  }

  async function open(id: string): Promise<void> {
    await pool.query(`UPDATE lots SET starts_at = statement_timestamp() - interval '1 second' WHERE id = $1`, [id]);
  }

  async function bidder(): Promise<Session> {
    const user = await createUser(pool, PREFIX, "BIDDER", passwordHash);
    const session = new Session(app);
    await session.login(user.email);
    return session;
  }

  const generate = () => app.get(LotsService).generateOpenedNotifications();

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    app = await createApplication({ connectionString, logger: false, allowedOrigins: [ORIGIN], auditKey: null, settlementIntervalMs: false, notificationIntervalMs: false });
    await app.init();
    ownerId = (await createUser(pool, PREFIX, "AUCTIONEER", passwordHash)).id;
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    await pool.query(`DELETE FROM notifications WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM lot_watches WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM catalog_item_snapshots WHERE external_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM sessions WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await pool.end();
  });

  it("rotas pessoais exigem sessão e mutações exigem CSRF", async () => {
    const id = await lot("scheduled");
    const server = app.getHttpServer();
    expect((await request(server).get("/api/me/watches")).status).toBe(401);
    expect((await request(server).get("/api/me/notifications")).status).toBe(401);
    const anon = new Session(app);
    expect((await anon.mutate("put", `/api/lots/${id}/watch`)).status).toBe(401);
    const session = await bidder();
    const noCsrf = await request(server).put(`/api/lots/${id}/watch`).set("Origin", ORIGIN).set("Cookie", session.cookie());
    expect(noCsrf.status).toBe(403);
  });

  it("GET /lots/next é público e devolve o agendado mais próximo", async () => {
    const response = await request(app.getHttpServer()).get("/api/lots/next");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("serverNow");
    if (response.body.lot) expect(Date.parse(response.body.lot.startsAt)).toBeGreaterThan(Date.now() - 5000);
  });

  it("inscreve, recusa lote aberto ou inexistente e cancelar apaga a inscrição", async () => {
    const session = await bidder();
    const id = await lot("scheduled");
    expect((await session.mutate("put", `/api/lots/${id}/watch`)).body).toEqual({ lotId: id, watching: true });
    expect((await session.mutate("put", `/api/lots/${id}/watch`)).status).toBe(200);
    expect((await session.get("/api/me/watches")).body.lotIds).toEqual([id]);
    expect((await session.mutate("delete", `/api/lots/${id}/watch`)).body).toEqual({ lotId: id, watching: false });
    expect((await session.get("/api/me/watches")).body.lotIds).toEqual([]);
    const rows = await pool.query(`SELECT 1 FROM lot_watches WHERE lot_id = $1`, [id]);
    expect(rows.rowCount).toBe(0);
    expect((await session.mutate("put", `/api/lots/${await lot("open")}/watch`)).status).toBe(409);
    expect((await session.mutate("put", `/api/lots/${randomUUID()}/watch`)).status).toBe(404);
  });

  it("gera a notificação na virada agendado→aberto, uma vez, e consome a inscrição", async () => {
    const a = await bidder();
    const b = await bidder();
    const id = await lot("scheduled");
    await a.mutate("put", `/api/lots/${id}/watch`);
    await generate();
    expect((await a.get("/api/me/notifications")).body).toEqual({ items: [], unread: 0 });
    await open(id);
    await generate();
    await generate();
    const list = await a.get("/api/me/notifications");
    expect(list.body.unread).toBe(1);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ lotId: id, kind: "LOT_OPENED", title: "Obra agendada", initialCents: "1000", readAt: null });
    expect((await a.get("/api/me/watches")).body.lotIds).toEqual([]);
    expect((await b.get("/api/me/notifications")).body.items).toEqual([]);
  });

  it("marca uma e todas como lidas, sem tocar nas de outro usuário", async () => {
    const a = await bidder();
    const b = await bidder();
    const ids = [await lot("scheduled"), await lot("scheduled"), await lot("scheduled")];
    for (const id of ids) await a.mutate("put", `/api/lots/${id}/watch`);
    await b.mutate("put", `/api/lots/${ids[0]}/watch`);
    for (const id of ids) await open(id);
    await generate();
    const first = (await a.get("/api/me/notifications")).body.items[0].id as string;
    expect((await b.post(`/api/me/notifications/${first}/read`, {})).status).toBe(200);
    expect((await a.get("/api/me/notifications")).body.unread).toBe(3);
    const one = await a.post(`/api/me/notifications/${first}/read`, {});
    expect(one.status).toBe(200);
    expect(one.body.unread).toBe(2);
    const all = await a.post("/api/me/notifications/read-all", {});
    expect(all.body.unread).toBe(0);
    expect((await b.get("/api/me/notifications")).body.unread).toBe(1);
  });

  it("mantém só as 20 mais recentes", async () => {
    const session = await bidder();
    const ids: string[] = [];
    for (let i = 0; i < 22; i += 1) ids.push(await lot("scheduled"));
    for (const id of ids) await session.mutate("put", `/api/lots/${id}/watch`);
    for (const id of ids) await open(id);
    await generate();
    expect((await session.get("/api/me/notifications")).body.items).toHaveLength(20);
    const stored = await pool.query(`SELECT count(*)::int AS n FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.lot_id = ANY($1::uuid[])`, [ids]);
    expect(stored.rows[0]?.n).toBe(20);
  });
});
