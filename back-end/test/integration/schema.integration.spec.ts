import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient, type QueryResult } from "pg";

const PROBE_SCHEMA = "auction_core_probe";

function migrationSql(): string {
  const root = join(__dirname, "../../prisma/migrations");
  const directories = readdirSync(root).filter((name) => name.endsWith("_auction_core"));
  if (directories.length !== 1) {
    throw new Error("Esperada exatamente uma migração *_auction_core.");
  }
  return readFileSync(join(root, directories[0], "migration.sql"), "utf8");
}

function testOwnerUrl(): string {
  const appUrl = process.env.TEST_DATABASE_URL;
  const password = process.env.DB_OWNER_PASSWORD;
  if (!appUrl || !password) {
    throw new Error("Configure TEST_DATABASE_URL e DB_OWNER_PASSWORD para o banco de teste local.");
  }
  const url = new URL(appUrl);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("A migração de teste só pode usar o PostgreSQL local.");
  }
  if (url.port !== "5463" || url.pathname !== "/casadeleilao_test") {
    throw new Error("A migração de teste só pode usar casadeleilao_test na porta 5463.");
  }
  url.username = "auction_owner";
  url.password = password;
  return url.toString();
}

async function query(client: PoolClient, text: string, values: readonly unknown[] = []): Promise<QueryResult> {
  return client.query(text, [...values]);
}

async function expectSqlState(action: Promise<unknown>, code: string): Promise<void> {
  try {
    await action;
  } catch (error) {
    const state = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    expect(state).toBe(code);
    return;
  }
  throw new Error(`esperava SQLSTATE ${code}`);
}

describe("schema auction_core no banco de teste", () => {
  const sql = migrationSql();
  const appPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    connectionTimeoutMillis: 3000,
    max: 2,
  });
  const ownerPool = new Pool({ connectionString: testOwnerUrl(), connectionTimeoutMillis: 3000, max: 1 });
  let owner: PoolClient;
  let app: PoolClient;

  beforeAll(async () => {
    owner = await ownerPool.connect();
    const identity = await query(owner, "SELECT current_database() AS database, current_user AS role");
    expect(identity.rows[0]).toEqual({ database: "casadeleilao_test", role: "auction_owner" });
    await query(owner, `DROP SCHEMA IF EXISTS ${PROBE_SCHEMA} CASCADE`);
    await query(owner, `CREATE SCHEMA ${PROBE_SCHEMA}`);
    await query(owner, `GRANT USAGE ON SCHEMA ${PROBE_SCHEMA} TO auction_app`);
    await query(owner, `SET search_path TO ${PROBE_SCHEMA}`);
    await query(owner, sql);
    app = await appPool.connect();
    await query(app, `SET search_path TO ${PROBE_SCHEMA}`);
  });

  afterAll(async () => {
    app?.release();
    await appPool.end();
    if (owner) {
      await query(owner, `DROP SCHEMA IF EXISTS ${PROBE_SCHEMA} CASCADE`);
      owner.release();
    }
    await ownerPool.end();
  });

  it("aplica a migração limpa com as tabelas do núcleo", async () => {
    const tables = await query(
      owner,
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [PROBE_SCHEMA],
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "bids",
      "catalog_item_snapshots",
      "idempotency_records",
      "lots",
      "receipts",
      "sessions",
      "settlements",
      "users",
      "wallet_entries",
      "wallets",
    ]);
  });

  it("recusa sequence, liquidação, token e chave duplicados", async () => {
    const auctioneer = await query(
      app,
      `INSERT INTO users (email, role, password_hash) VALUES ('auctioneer@example.test', 'AUCTIONEER', 'hash') RETURNING id`,
    );
    const bidder = await query(
      app,
      `INSERT INTO users (email, role, password_hash) VALUES ('bidder@example.test', 'BIDDER', 'hash') RETURNING id`,
    );
    const snapshot = await query(
      app,
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', '436535', 'Obra', '{}'::jsonb, 'The Met', 'CC0', 'media/436535') RETURNING id`,
    );
    const lot = await query(
      app,
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, 10000, 500, '2026-10-23T15:00:00Z', '2026-10-23T16:00:00Z') RETURNING id`,
      [auctioneer.rows[0].id, snapshot.rows[0].id],
    );
    await query(
      app,
      `INSERT INTO bids (lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature)
       VALUES ($1, $2, 'Licitante 1', 1, 10000, '2026-10-23T15:01:00Z', 'sig-1')`,
      [lot.rows[0].id, bidder.rows[0].id],
    );
    await expectSqlState(
      query(
        app,
        `INSERT INTO bids (lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature)
         VALUES ($1, $2, 'Licitante 1', 1, 10500, '2026-10-23T15:02:00Z', 'sig-2')`,
        [lot.rows[0].id, bidder.rows[0].id],
      ),
      "23505",
    );

    const settlement = await query(
      app,
      `INSERT INTO settlements (lot_id, settled_at) VALUES ($1, '2026-10-23T16:00:01Z') RETURNING id`,
      [lot.rows[0].id],
    );
    await expectSqlState(
      query(app, `INSERT INTO settlements (lot_id, settled_at) VALUES ($1, '2026-10-23T16:00:02Z')`, [lot.rows[0].id]),
      "23505",
    );

    const otherSnapshot = await query(
      app,
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', '436536', 'Outra', '{}'::jsonb, 'The Met', 'CC0', 'media/436536') RETURNING id`,
    );
    const otherLot = await query(
      app,
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, 10000, 500, '2026-10-23T15:00:00Z', '2026-10-23T16:00:00Z') RETURNING id`,
      [auctioneer.rows[0].id, otherSnapshot.rows[0].id],
    );
    const otherSettlement = await query(
      app,
      `INSERT INTO settlements (lot_id, settled_at) VALUES ($1, '2026-10-23T16:00:01Z') RETURNING id`,
      [otherLot.rows[0].id],
    );
    await query(app, `INSERT INTO receipts (settlement_id, public_token) VALUES ($1, 'token-publico-a')`, [
      settlement.rows[0].id,
    ]);
    await expectSqlState(
      query(app, `INSERT INTO receipts (settlement_id, public_token) VALUES ($1, 'token-publico-a')`, [
        otherSettlement.rows[0].id,
      ]),
      "23505",
    );

    const key = "00000000-0000-4000-8000-000000000001";
    await query(
      app,
      `INSERT INTO idempotency_records (user_id, operation, resource_key, idempotency_key, request_hash, response)
       VALUES ($1, 'deposit', '', $2::uuid, 'hash-a', '{"status":"ok"}'::jsonb)`,
      [bidder.rows[0].id, key],
    );
    await expectSqlState(
      query(
        app,
        `INSERT INTO idempotency_records (user_id, operation, resource_key, idempotency_key, request_hash, response)
         VALUES ($1, 'deposit', '', $2::uuid, 'hash-b', '{"status":"other"}'::jsonb)`,
        [bidder.rows[0].id, key],
      ),
      "23505",
    );
  });

  it("permite SELECT e INSERT ao papel de runtime e recusa CREATE e ALTER", async () => {
    const inserted = await query(
      app,
      `INSERT INTO users (email, role, password_hash) VALUES ('runtime@example.test', 'BIDDER', 'hash') RETURNING id`,
    );
    expect(inserted.rows[0].id).toEqual(expect.any(String));
    const selected = await query(app, "SELECT id FROM users WHERE email = 'runtime@example.test'");
    expect(selected.rows[0].id).toBe(inserted.rows[0].id);
    await expectSqlState(query(app, `CREATE TABLE ${PROBE_SCHEMA}.privilege_probe (id int)`), "42501");
    await expectSqlState(query(app, `ALTER TABLE users ADD COLUMN leaked text`), "42501");
  });

  it("rejeita saldo negativo, comprometido acima do total e valor não positivo", async () => {
    const bidder = await query(
      app,
      `INSERT INTO users (email, role, password_hash) VALUES ('wallet@example.test', 'BIDDER', 'hash') RETURNING id`,
    );
    const userId = bidder.rows[0].id;
    await expectSqlState(
      query(app, `INSERT INTO wallets (user_id, total_cents, committed_cents) VALUES ($1, -1, 0)`, [userId]),
      "23514",
    );
    await expectSqlState(
      query(app, `INSERT INTO wallets (user_id, total_cents, committed_cents) VALUES ($1, 0, -1)`, [userId]),
      "23514",
    );
    await expectSqlState(
      query(app, `INSERT INTO wallets (user_id, total_cents, committed_cents) VALUES ($1, 10, 11)`, [userId]),
      "23514",
    );
    await query(app, `INSERT INTO wallets (user_id, total_cents, committed_cents) VALUES ($1, 10, 10)`, [userId]);
    const auctioneer = await query(
      app,
      `INSERT INTO users (email, role, password_hash) VALUES ('seller@example.test', 'AUCTIONEER', 'hash') RETURNING id`,
    );
    const snapshot = await query(
      app,
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', '1', 'Obra', '{}'::jsonb, 'The Met', 'CC0', 'media/1') RETURNING id`,
    );
    await expectSqlState(
      query(
        app,
        `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
         VALUES ($1, $2, 0, 500, '2026-10-23T15:00:00Z', '2026-10-23T16:00:00Z')`,
        [auctioneer.rows[0].id, snapshot.rows[0].id],
      ),
      "23514",
    );
    await expectSqlState(
      query(
        app,
        `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
         VALUES ($1, $2, 10000, 500, '2026-10-23T16:00:00Z', '2026-10-23T16:00:00Z')`,
        [auctioneer.rows[0].id, snapshot.rows[0].id],
      ),
      "23514",
    );
  });
});
