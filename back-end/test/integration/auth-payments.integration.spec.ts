import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createApplication } from "../../src/app";
import { verifyPassword } from "../../src/auth/password-hash";

const ORIGIN = "http://127.0.0.1:3300";
const PREFIX = "auth-payments-";

describe("cadastro e pagamentos simulados", () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
  let app: INestApplication;
  let now = Date.now();
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL necessária");
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (url.port !== "5463" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente teste local 5463");
    app = await createApplication({ connectionString: process.env.TEST_DATABASE_URL, logger: false, auditKey: null, now: () => now });
    await app.init();
  });
  beforeEach(() => { now += 120000; });
  afterAll(async () => {
    const ids = `SELECT id FROM users WHERE email LIKE $1`;
    for (const table of ["sessions", "test_cards", "oauth_states", "idempotency_records"]) {
      await pool.query(`DELETE FROM ${table} WHERE user_id IN (${ids})`, [`${PREFIX}%`]);
    }
    await pool.query(`DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (${ids}))`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM wallets WHERE user_id IN (${ids})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await pool.end();
  });
  async function account() {
    const agent = request.agent(app.getHttpServer());
    const email = `${PREFIX}${randomUUID()}@example.com`;
    const csrf = (await agent.get("/api/auth/csrf")).body.csrfToken as string;
    const result = await agent.post("/api/auth/register").set("Origin", ORIGIN).set("X-CSRF-Token", csrf)
      .send({ name: "Ana Ribeiro", email, password: "cadastro-seguro-2026", termsAccepted: true });
    expect(result.status).toBe(201);
    const token = (await agent.get("/api/auth/csrf")).body.csrfToken as string;
    const post = (path: string, body: object, key = randomUUID()) => agent.post(path).set("Origin", ORIGIN).set("X-CSRF-Token", token).set("Idempotency-Key", key).send(body);
    return { agent, email, post, token };
  }
  it("cadastra só BIDDER, hash Argon2id, sessão e nome; recusa duplicado sem revelar e-mail", async () => {
    const { agent, email, post } = await account();
    const me = await agent.get("/api/auth/me");
    expect(me.body).toMatchObject({ role: "BIDDER", name: "Ana Ribeiro", userId: expect.any(String) });
    expect((await agent.get("/api/me/id")).status).toBe(404);
    const row = (await pool.query(`SELECT password_hash FROM users WHERE email=$1`, [email])).rows[0];
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(row.password_hash as string, "cadastro-seguro-2026")).toBe(true);
    const duplicate = await post("/api/auth/register", { name: "Outra", email, password: "cadastro-seguro-2026", termsAccepted: true });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toContain("Não foi possível criar a conta");
    expect(JSON.stringify(duplicate.body)).not.toContain(email);
  });
  it("exige CSRF/aceite e recusa promoção de papel", async () => {
    expect((await request(app.getHttpServer()).post("/api/auth/register").send({})).status).toBe(403);
    const { post } = await account();
    const data = { name: "Ana", email: `${PREFIX}${randomUUID()}@example.com`, password: "cadastro-seguro-2026" };
    expect((await post("/api/auth/register", { ...data, termsAccepted: false })).status).toBe(400);
    expect((await post("/api/auth/register", { ...data, termsAccepted: true, role: "AUCTIONEER" })).status).toBe(400);
  });
  it("cartão guarda somente metadados, exige sessão/CSRF e recusa PAN/CVV", async () => {
    expect((await request(app.getHttpServer()).get("/api/wallet/cards")).status).toBe(401);
    const { agent, post, email } = await account();
    expect((await agent.post("/api/wallet/cards").send({})).status).toBe(403);
    expect((await post("/api/wallet/cards", { number: "4242424242424242", cvv: "123" })).status).toBe(400);
    const card = await post("/api/wallet/cards", {});
    expect(card.status).toBe(201);
    expect(card.body).toMatchObject({ brand: "Visa", last4: "4242", expiryMonth: 12, expiryYear: 2034 });
    expect((await post("/api/wallet/cards", {})).body.id).toBe(card.body.id);
    const stored = await pool.query(`SELECT c.* FROM test_cards c JOIN users u ON u.id=c.user_id WHERE u.email=$1`, [email]);
    expect(stored.rows).toHaveLength(1);
    expect(JSON.stringify(stored.rows)).not.toContain("4242424242424242");
    expect(Object.keys(stored.rows[0])).not.toEqual(expect.arrayContaining(["number", "cvv", "pan"]));
  });
  it("Pix e cartão creditam atomicamente uma vez, validam dono/método e mantêm extrato após remover", async () => {
    const a = await account();
    const b = await account();
    const card = (await a.post("/api/wallet/cards", {})).body;
    expect((await b.post("/api/wallet/deposits", { amountCents: "100", method: "CARD", cardId: card.id })).status).toBe(404);
    for (const method of ["PIX", "CARD"]) {
      const key = randomUUID();
      const payload = { amountCents: "12345", method, ...(method === "CARD" ? { cardId: card.id as string } : {}) };
      const [first, replay] = await Promise.all([a.post("/api/wallet/deposits", payload, key), a.post("/api/wallet/deposits", payload, key)]);
      expect(first.status).toBe(200);
      expect(replay.body).toEqual(first.body);
      expect((await a.post("/api/wallet/deposits", { ...payload, amountCents: "12346" }, key)).status).toBe(409);
    }
    expect((await a.agent.get("/api/wallet")).body.totalCents).toBe("24690");
    expect((await a.post("/api/wallet/deposits", { amountCents: "99", method: "PIX" })).status).toBe(400);
    expect((await a.post("/api/wallet/deposits", { amountCents: "10000001", method: "PIX" })).status).toBe(400);
    expect((await a.post("/api/wallet/deposits", { amountCents: "100", method: "WIRE" })).status).toBe(400);
    const removed = await a.agent.delete(`/api/wallet/cards/${card.id as string}`).set("Origin", ORIGIN).set("X-CSRF-Token", a.token);
    expect(removed.status).toBe(204);
    const ledger = await a.agent.get("/api/wallet/entries?filter=deposits");
    expect(ledger.body.items).toHaveLength(2);
    expect(ledger.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ method: "CARD", last4: "4242" }), expect.objectContaining({ method: "PIX" })]));
    expect((await b.agent.get("/api/wallet/entries")).body.items).toEqual([]);
  });
});
