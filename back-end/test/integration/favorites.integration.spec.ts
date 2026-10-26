import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createApplication } from "../../src/app";
import { hashPassword } from "../../src/auth/password-hash";
import { createUser, ORIGIN, PASSWORD, Session } from "../support/http-session";

const PREFIX = "d21-favoritos-";

describe("favoritos (D21)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  let app: INestApplication;
  let passwordHash = "";
  let ownerId = "";

  async function lot(window: "open" | "closed" | "cancelled"): Promise<string> {
    const snapshot = await pool.query<{ id: string }>(
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', $1, 'Obra', '{}'::jsonb, 'Met', 'CC0', $2) RETURNING id`,
      [`${PREFIX}${randomUUID()}`, `media/${randomUUID()}`],
    );
    const timing =
      window === "closed"
        ? `statement_timestamp() - interval '2 hours', statement_timestamp() - interval '1 hour'`
        : `statement_timestamp(), statement_timestamp() + interval '1 hour'`;
    const created = await pool.query<{ id: string }>(
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at, status)
       VALUES ($1, $2, 1000, 100, ${timing}, $3) RETURNING id`,
      [ownerId, snapshot.rows[0]?.id, window === "cancelled" ? "CANCELLED" : "PUBLISHED"],
    );
    const id = created.rows[0]?.id;
    if (!id) throw new Error("lote de teste não foi criado");
    return id;
  }

  async function bidder(): Promise<Session> {
    const user = await createUser(pool, PREFIX, "BIDDER", passwordHash);
    const session = new Session(app);
    await session.login(user.email);
    return session;
  }

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    app = await createApplication({ connectionString, logger: false, allowedOrigins: [ORIGIN], auditKey: null, settlementIntervalMs: false });
    await app.init();
    ownerId = (await createUser(pool, PREFIX, "AUCTIONEER", passwordHash)).id;
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    await pool.query(`DELETE FROM favorites WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM catalog_item_snapshots WHERE external_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM sessions WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await pool.end();
  });

  it("exige sessão nas três rotas", async () => {
    const id = await lot("open");
    const server = app.getHttpServer();
    expect((await request(server).get("/api/me/favorites")).status).toBe(401);
    const anon = new Session(app);
    expect((await anon.mutate("put", `/api/lots/${id}/favorite`)).status).toBe(401);
    expect((await anon.mutate("delete", `/api/lots/${id}/favorite`)).status).toBe(401);
  });

  it("PUT sem token CSRF é recusado", async () => {
    const session = await bidder();
    const id = await lot("open");
    const response = await request(app.getHttpServer()).put(`/api/lots/${id}/favorite`).set("Origin", ORIGIN).set("Cookie", session.cookie());
    expect(response.status).toBe(403);
  });

  it("favorita, é idempotente, lista e remove", async () => {
    const session = await bidder();
    const id = await lot("open");
    expect((await session.mutate("put", `/api/lots/${id}/favorite`)).body).toEqual({ lotId: id, favorite: true, message: "Adicionado aos favoritos." });
    expect((await session.mutate("put", `/api/lots/${id}/favorite`)).status).toBe(200);
    const list = await session.get("/api/me/favorites");
    expect(list.status).toBe(200);
    expect(list.body.lotIds).toEqual([id]);
    expect(list.body.items[0].id).toBe(id);
    expect((await session.mutate("delete", `/api/lots/${id}/favorite`)).body).toEqual({ lotId: id, favorite: false, message: "Removido dos favoritos." });
    expect((await session.mutate("delete", `/api/lots/${id}/favorite`)).status).toBe(200);
    expect((await session.get("/api/me/favorites")).body.lotIds).toEqual([]);
  });

  it("encerrados vão para o fim e cancelados/inexistentes dão 404", async () => {
    const session = await bidder();
    const closed = await lot("closed");
    const open = await lot("open");
    await session.mutate("put", `/api/lots/${closed}/favorite`);
    await session.mutate("put", `/api/lots/${open}/favorite`);
    expect((await session.get("/api/me/favorites")).body.lotIds).toEqual([open, closed]);
    expect((await session.mutate("put", `/api/lots/${await lot("cancelled")}/favorite`)).status).toBe(404);
    expect((await session.mutate("put", `/api/lots/${randomUUID()}/favorite`)).status).toBe(404);
    expect((await session.mutate("put", `/api/lots/nao-e-uuid/favorite`)).status).toBe(404);
  });

  it("um usuário não vê os favoritos do outro", async () => {
    const a = await bidder();
    const b = await bidder();
    const id = await lot("open");
    await a.mutate("put", `/api/lots/${id}/favorite`);
    expect((await b.get("/api/me/favorites")).body.lotIds).toEqual([]);
  });
});
