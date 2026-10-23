import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import { createApplication } from "../../src/app";
import { hashPassword } from "../../src/auth/password-hash";
import { DatabaseRepository } from "../../src/database/database.repository";
import { WalletsRepository } from "../../src/wallets/wallets.repository";
import { WalletsService } from "../../src/wallets/wallets.service";
import { createUser, PASSWORD, Session } from "../support/http-session";

const PREFIX = "tarefa5-carteira-";

class FailingAfterLedger extends WalletsRepository {
  protected override async afterLedger(): Promise<void> {
    throw new Error("falha simulada após o lançamento");
  }
}

describe("carteira", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  let app: INestApplication;
  let passwordHash = "";
  let now = 1_950_000_000_000;

  async function login(role: "AUCTIONEER" | "BIDDER") {
    const user = await createUser(pool, PREFIX, role, passwordHash);
    const session = new Session(app);
    await session.login(user.email);
    return { session, id: user.id };
  }

  function deposit(session: Session, amountCents: unknown, key: string = randomUUID()) {
    return session.post("/api/wallet/deposits", { amountCents }, { "Idempotency-Key": key });
  }

  async function ledger(userId: string): Promise<{ total: string; sum: string; entries: number }> {
    const result = await pool.query<{ total: string; sum: string; entries: number }>(
      `SELECT w.total_cents::text AS total, COALESCE(SUM(e.amount_cents), 0)::text AS sum, COUNT(e.id)::int AS entries
       FROM wallets w LEFT JOIN wallet_entries e ON e.wallet_id = w.id AND e.kind = 'DEPOSIT'
       WHERE w.user_id = $1 GROUP BY w.total_cents`,
      [userId],
    );
    return result.rows[0] ?? { total: "0", sum: "0", entries: 0 };
  }

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    app = await createApplication({ connectionString, logger: false, now: () => now, allowedOrigins: ["http://127.0.0.1:3300"], auditKey: null });
    await app.init();
  });

  beforeEach(() => {
    now += 120_000;
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    await pool.query(`DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (${users}))`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM wallets WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM idempotency_records WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM sessions WHERE user_id IN (${users})`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await pool.end();
  });

  it("mostra carteira zerada antes do primeiro depósito", async () => {
    const { session } = await login("BIDDER");
    const response = await session.get("/api/wallet");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalCents: "0", committedCents: "0", availableCents: "0", revision: 0 });
  });

  it("depósito de 10000 aumenta total e disponível, comprometido segue 0 e o ledger reconcilia", async () => {
    const { session, id } = await login("BIDDER");
    const response = await deposit(session, "10000");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalCents: "10000", committedCents: "0", availableCents: "10000", revision: 1 });
    expect((await session.get("/api/wallet")).body.totalCents).toBe("10000");
    expect(await ledger(id)).toEqual({ total: "10000", sum: "10000", entries: 1 });
  });

  it.each([["0"], ["-1"], ["10.5"], ["abc"], ["1000000000000"], [10000], [""]])("valor inválido %p não move saldo", async (amount) => {
    const { session, id } = await login("BIDDER");
    const response = await deposit(session, amount);
    expect(response.status).toBe(400);
    expect(await ledger(id)).toEqual({ total: "0", sum: "0", entries: 0 });
  });

  it("exige chave de idempotência válida", async () => {
    const { session, id } = await login("BIDDER");
    const missing = await session.post("/api/wallet/deposits", { amountCents: "100" });
    const bad = await deposit(session, "100", "nao-e-uuid");
    expect(missing.status).toBe(400);
    expect(bad.body.code).toBe("IDEMPOTENCIA_INVALIDA");
    expect((await ledger(id)).entries).toBe(0);
  });

  it("duas chamadas simultâneas com a mesma chave creditam uma vez e respondem igual", async () => {
    const { session, id } = await login("BIDDER");
    const key = randomUUID();
    const [first, second] = await Promise.all([deposit(session, "2500", key), deposit(session, "2500", key)]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await ledger(id)).toEqual({ total: "2500", sum: "2500", entries: 1 });
  });

  it("mesma chave com corpo diferente responde 409 sem mover saldo", async () => {
    const { session, id } = await login("BIDDER");
    const key = randomUUID();
    expect((await deposit(session, "700", key)).status).toBe(200);
    const conflict = await deposit(session, "800", key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCIA_CONFLITO");
    expect(await ledger(id)).toEqual({ total: "700", sum: "700", entries: 1 });
  });

  it("depósitos simultâneos com chaves diferentes somam todos", async () => {
    const { session, id } = await login("BIDDER");
    const responses = await Promise.all(Array.from({ length: 8 }, () => deposit(session, "125")));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await ledger(id)).toEqual({ total: "1000", sum: "1000", entries: 8 });
  });

  it("aceita entrada no teto e acumula acima dele", async () => {
    const { session, id } = await login("BIDDER");
    await deposit(session, "999999999999");
    const second = await deposit(session, "999999999999");
    expect(second.body.totalCents).toBe("1999999999998");
    expect((await ledger(id)).sum).toBe("1999999999998");
  });

  it("leiloeiro e visitante não acessam carteira; userId injetado é rejeitado", async () => {
    const auctioneer = await login("AUCTIONEER");
    const bidder = await login("BIDDER");
    expect((await auctioneer.session.get("/api/wallet")).status).toBe(403);
    expect((await deposit(auctioneer.session, "100")).status).toBe(403);
    expect((await new Session(app).get("/api/wallet")).status).toBe(401);
    const injected = await bidder.session.post("/api/wallet/deposits", { amountCents: "100", userId: auctioneer.id }, { "Idempotency-Key": randomUUID() });
    expect(injected.status).toBe(400);
    const wallets = await pool.query(`SELECT id FROM wallets WHERE user_id = ANY($1::uuid[])`, [[auctioneer.id, bidder.id]]);
    expect(wallets.rowCount).toBe(0);
  });

  it("falha depois do lançamento desfaz tudo, inclusive o registro de idempotência", async () => {
    const { id } = await createUser(pool, PREFIX, "BIDDER", passwordHash);
    const database = new DatabaseRepository(connectionString);
    try {
      const failing = new WalletsService(database, new FailingAfterLedger(database));
      const key = randomUUID();
      await expect(failing.deposit({ userId: id, role: "BIDDER" } as never, "500", key)).rejects.toThrow("falha simulada");
      expect(await ledger(id)).toEqual({ total: "0", sum: "0", entries: 0 });
      const records = await pool.query(`SELECT 1 FROM idempotency_records WHERE user_id = $1`, [id]);
      expect(records.rowCount).toBe(0);
      const healthy = new WalletsService(database, new WalletsRepository(database));
      expect((await healthy.deposit({ userId: id, role: "BIDDER" } as never, "500", key)).totalCents).toBe("500");
    } finally {
      await database.onModuleDestroy();
    }
  });
});
