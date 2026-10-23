import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ApiException } from "../../src/auth/api.exception";
import { parseIdempotencyKey, requestDigest, withIdempotency } from "../../src/common/idempotency";
import { DatabaseRepository } from "../../src/database/database.repository";

const PREFIX = "tarefa5-idem-";

describe("idempotência", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  const database = new DatabaseRepository(connectionString);
  let userId = "";

  beforeAll(async () => {
    const inserted = await pool.query<{ id: string }>(`INSERT INTO users (email, role, password_hash) VALUES ($1, 'BIDDER', 'x') RETURNING id`, [
      `${PREFIX}${randomUUID()}@example.com`,
    ]);
    userId = inserted.rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM idempotency_records WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await database.onModuleDestroy();
    await pool.end();
  });

  function scope(key: string, requestHash = requestDigest(["a"])) {
    return { userId, operation: "test.op", resourceKey: "r", key, requestHash };
  }

  it("valida a chave como UUID e normaliza caixa", () => {
    const key = randomUUID().toUpperCase();
    expect(parseIdempotencyKey(key)).toBe(key.toLowerCase());
    expect(() => parseIdempotencyKey(undefined)).toThrow(ApiException);
    expect(() => parseIdempotencyKey("x".repeat(36))).toThrow(ApiException);
  });

  it("executa o trabalho uma vez sob concorrência e repete a resposta gravada", async () => {
    const key = randomUUID();
    let runs = 0;
    const work = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { value: runs };
    };
    const results = await Promise.all([1, 2, 3, 4].map(() => withIdempotency(database, scope(key), work)));
    expect(runs).toBe(1);
    expect(results.filter((item) => !item.replayed)).toHaveLength(1);
    expect(new Set(results.map((item) => JSON.stringify(item.result))).size).toBe(1);
  });

  it("mesma chave com outro pedido responde 409", async () => {
    const key = randomUUID();
    await withIdempotency(database, scope(key), async () => ({ ok: true }));
    const error = await withIdempotency(database, scope(key, requestDigest(["b"])), async () => ({ ok: true })).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(409);
    expect((error as ApiException).getResponse()).toEqual({ code: "IDEMPOTENCIA_CONFLITO" });
  });

  it("falha no trabalho não grava registro e permite repetir", async () => {
    const key = randomUUID();
    await expect(withIdempotency(database, scope(key), async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    const again = await withIdempotency(database, scope(key), async () => ({ ok: 1 }));
    expect(again.replayed).toBe(false);
  });

  it("recusa resposta acima de 32 KiB sem gravar", async () => {
    const key = randomUUID();
    await expect(withIdempotency(database, scope(key), async () => ({ big: "x".repeat(33 * 1024) }))).rejects.toThrow();
    const rows = await pool.query(`SELECT 1 FROM idempotency_records WHERE user_id = $1 AND idempotency_key = $2`, [userId, key]);
    expect(rows.rowCount).toBe(0);
  });
});
