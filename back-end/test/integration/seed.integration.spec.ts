import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { Pool } from "pg";
import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService } from "../../src/audit/audit.service";
import { FileCheckpointStore } from "../../src/audit/checkpoint-store";
import { MediaStore } from "../../src/catalog/image-importer";
import { DatabaseRepository } from "../../src/database/database.repository";
import { runSeed, type SeedOptions } from "../../prisma/seed";

jest.setTimeout(60_000);

describe("seed de demonstracao (Tarefa 10)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const prefix = `seed-${randomUUID().slice(0, 8)}-`;
  const pool = new Pool({ connectionString, max: 4 });
  const database = new DatabaseRepository(connectionString);
  let dir = "";
  let options: SeedOptions;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "seed-"));
    const audit = new AuditService(new AuditRepository(database.connectionPool, "public"), new FileCheckpointStore(join(dir, "witness")), randomBytes(32));
    options = {
      pool,
      audit,
      media: new MediaStore(join(dir, "media")),
      assetsDir: resolve(__dirname, "../../../docs/design/pranchas/assets/obras"),
      password: "senha-ficticia-de-teste",
      emailPrefix: prefix,
    };
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE $1`;
    const p = [`${prefix}%`];
    const owned = `SELECT id FROM lots WHERE owner_id IN (${users})`;
    await pool.query(`DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (${users}))`, p);
    await pool.query(`DELETE FROM wallets WHERE user_id IN (${users})`, p);
    await pool.query(`DELETE FROM bids WHERE lot_id IN (${owned})`, p);
    await pool.query(`DELETE FROM lots WHERE owner_id IN (${users})`, p);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, p);
    await pool.end();
    await database.onModuleDestroy();
    await rm(dir, { recursive: true, force: true });
  });

  const openLots = async () =>
    (await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM lots l JOIN users u ON u.id = l.owner_id
       WHERE u.email LIKE $1 AND l.status = 'PUBLISHED' AND l.starts_at <= now() AND l.ends_at > now()`,
      [`${prefix}%`],
    )).rows[0]?.n ?? 0;

  it("cria 1 leiloeiro, 2 licitantes ficticios com senha argon2, obra real licenciada e 1 lote aberto", async () => {
    const result = await runSeed(options);
    expect(result.users.map((u) => u.role).sort()).toEqual(["AUCTIONEER", "BIDDER", "BIDDER"]);
    for (const u of result.users) expect(u.email).toMatch(new RegExp(`^${prefix}.+@arremate\\.demo$`));
    const rows = await pool.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE email LIKE $1`, [`${prefix}%`]);
    expect(rows.rows).toHaveLength(3);
    for (const r of rows.rows) expect(await verify(r.password_hash, "senha-ficticia-de-teste")).toBe(true);
    const snap = await pool.query<{ license: string; credit: string; title: string }>(`SELECT license, credit, title FROM catalog_item_snapshots WHERE provider = 'met' AND external_id = '437329'`);
    expect(snap.rows[0]).toMatchObject({ title: "The Abduction of the Sabine Women", credit: "Harris Brisbane Dick Fund, 1946" });
    expect(snap.rows[0]?.license).toMatch(/CC0/);
    expect(result.lotCreated).toBe(true);
    expect(await openLots()).toBe(1);
    expect((await options.audit.verifyLot(result.lotId as string)).status).toBe("INTACT");
  });

  it("reexecutar nao zera saldo, nao apaga lances nem cria/reabre lote silenciosamente", async () => {
    const bidder = (await pool.query<{ id: string }>(`SELECT id FROM users WHERE email LIKE $1 AND role = 'BIDDER' ORDER BY email LIMIT 1`, [`${prefix}%`])).rows[0]?.id;
    await pool.query(`UPDATE wallets SET total_cents = total_cents + 12345 WHERE user_id = $1`, [bidder]);
    const before = (await pool.query<{ total: string }>(`SELECT total_cents::text AS total FROM wallets WHERE user_id = $1`, [bidder])).rows[0]?.total;
    await pool.query(`UPDATE lots SET ends_at = now() - interval '1 second', starts_at = now() - interval '1 hour' WHERE owner_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`${prefix}%`]);
    const again = await runSeed(options);
    expect(again.lotCreated).toBe(false);
    expect(again.warnings.join(" ")).toMatch(/--preparar-lote/);
    expect(await openLots()).toBe(0);
    expect((await pool.query<{ total: string }>(`SELECT total_cents::text AS total FROM wallets WHERE user_id = $1`, [bidder])).rows[0]?.total).toBe(before);
    expect((await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE email LIKE $1`, [`${prefix}%`])).rows[0]?.n).toBe(3);
  });

  it("comando explicito de preparo cria lote NOVO com datas relativas, sem reabrir o antigo", async () => {
    const total = async () => (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM lots WHERE owner_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`${prefix}%`])).rows[0]?.n ?? 0;
    const n = await total();
    const prepared = await runSeed({ ...options, prepareLot: true });
    expect(prepared.lotCreated).toBe(true);
    expect(await total()).toBe(n + 1);
    expect(await openLots()).toBe(1);
  });

  it("recusa banco que nao e local", async () => {
    await expect(runSeed({ ...options, databaseUrl: "postgresql://u:p@db.exemplo.com:5432/x" })).rejects.toThrow(/local/);
  });
});