/**
 * Seed de demonstracao do Arremate (Tarefa 10).
 * - 1 leiloeiro + 2 licitantes FICTICIOS (dominio .demo), senha de demo documentada no README.
 * - Obra real do The Met (437329, dominio publico/CC0) a partir do snapshot local em docs/design.
 * - 1 lote aberto na primeira execucao. Reexecutar nunca zera saldo, apaga lance nem reabre lote;
 *   lote novo so com o comando explicito `--preparar-lote` (datas relativas a agora).
 * - So roda em banco local (127.0.0.1/localhost).
 * - Depois roda o catalogo de 24 obras (D17, `seed-catalog.ts`); `--sem-catalogo` pula essa etapa.
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { hash, Algorithm } from "@node-rs/argon2";
import { Pool } from "pg";
import type { AuditService } from "../src/audit/audit.service";
import { MediaStore } from "../src/catalog/image-importer";
import { MET_LICENSE, MET_PROVIDER } from "../src/catalog/catalog.service";
import { runCatalogSeed } from "./seed-catalog";

export const DEMO_PASSWORD_DEFAULT = "arremate-demo-2026";
export const DEMO_EXTERNAL_ID = "437329";
const DEMO_DEPOSIT_CENTS = 1_000_000n; // R$ 10.000,00 simulados
const LOT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type SeedOptions = {
  pool: Pool;
  audit: AuditService;
  media: MediaStore;
  assetsDir: string;
  password: string;
  emailPrefix?: string;
  prepareLot?: boolean;
  databaseUrl?: string;
};

export type SeedResult = {
  users: Array<{ email: string; role: "AUCTIONEER" | "BIDDER" }>;
  lotId: string | null;
  lotCreated: boolean;
  warnings: string[];
};

export function assertLocalDatabase(url: string | undefined): void {
  if (!url) return;
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("Seed so roda em banco local (127.0.0.1/localhost).");
}

export async function runSeed(o: SeedOptions): Promise<SeedResult> {
  assertLocalDatabase(o.databaseUrl);
  const prefix = o.emailPrefix ?? "";
  const warnings: string[] = [];
  const users = [
    { email: `${prefix}leiloeiro@arremate.demo`, role: "AUCTIONEER" as const },
    { email: `${prefix}licitante1@arremate.demo`, role: "BIDDER" as const },
    { email: `${prefix}licitante2@arremate.demo`, role: "BIDDER" as const },
  ];
  const passwordHash = await demoPasswordHash(o.password);
  const ids = new Map<string, string>();
  for (const u of users) ids.set(u.email, await ensureUser(o.pool, u.email, u.role, passwordHash));
  for (const u of users.filter((x) => x.role === "BIDDER")) {
    const userId = ids.get(u.email) as string;
    const created = await o.pool.query<{ id: string }>(
      `INSERT INTO wallets (user_id, total_cents) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING RETURNING id`,
      [userId, DEMO_DEPOSIT_CENTS.toString()],
    );
    const walletId = created.rows[0]?.id;
    if (walletId) {
      await o.pool.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, 'DEPOSIT', $2, $3)`, [
        walletId,
        DEMO_DEPOSIT_CENTS.toString(),
        `seed:${u.email}`,
      ]);
    }
  }
  const snapshotId = await ensureSnapshot(o);
  const ownerId = ids.get(users[0].email) as string;
  const counts = await o.pool.query<{ total: number; open: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'PUBLISHED' AND starts_at <= now() AND ends_at > now())::int AS open
     FROM lots WHERE owner_id = $1`,
    [ownerId],
  );
  const { total = 0, open = 0 } = counts.rows[0] ?? {};
  let lotId: string | null = null;
  let lotCreated = false;
  if (total === 0 || o.prepareLot) {
    const lot = await o.pool.query<{ id: string }>(
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, 50000, 2500, date_trunc('milliseconds', clock_timestamp()) - interval '1 minute',
               date_trunc('milliseconds', clock_timestamp()) + ($3::bigint * interval '1 millisecond')) RETURNING id`,
      [ownerId, snapshotId, LOT_DURATION_MS],
    );
    lotId = lot.rows[0]?.id ?? null;
    if (!lotId) throw new Error("lote de demo nao criado");
    await o.audit.openGenesis(lotId);
    lotCreated = true;
  } else if (open === 0) {
    warnings.push("Nenhum lote de demo aberto. Rode o seed com --preparar-lote para criar um lote NOVO (o antigo nao e reaberto).");
  }
  return { users, lotId, lotCreated, warnings };
}

export function demoPasswordHash(password: string): Promise<string> {
  return hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

/** ON CONFLICT DO NOTHING: reexecutar nao troca senha de quem ja existe. */
export async function ensureUser(pool: Pool, email: string, role: "AUCTIONEER" | "BIDDER", passwordHash: string): Promise<string> {
  await pool.query(`INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`, [email, role, passwordHash]);
  const row = await pool.query<{ id: string; role: string }>(`SELECT id, role::text AS role FROM users WHERE email = $1`, [email]);
  const found = row.rows[0];
  if (!found || found.role !== role) throw new Error(`Conta ${email} existe com outro papel; seed nao altera.`);
  return found.id;
}

async function ensureSnapshot(o: SeedOptions): Promise<string> {
  const existing = await o.pool.query<{ id: string }>(`SELECT id FROM catalog_item_snapshots WHERE provider = $1 AND external_id = $2`, [MET_PROVIDER, DEMO_EXTERNAL_ID]);
  if (existing.rows[0]) return existing.rows[0].id;
  const item = JSON.parse(await readFile(join(o.assetsDir, `${DEMO_EXTERNAL_ID}.json`), "utf8")) as Record<string, unknown>;
  if (item.isPublicDomain !== true) throw new Error("Obra de demo sem dominio publico; seed recusa.");
  const mediaKey = await o.media.save(await readFile(join(o.assetsDir, `${DEMO_EXTERNAL_ID}.jpg`)), "jpg");
  const attributes = {
    artist: item.artistDisplayName,
    artistBio: item.artistDisplayBio,
    date: item.objectDate,
    medium: item.medium,
    dimensions: item.dimensions,
    department: item.department,
    classification: item.classification,
    accessionNumber: item.accessionNumber,
    sourceUrl: item.objectURL,
  };
  await o.pool.query(
    `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) ON CONFLICT (provider, external_id) DO NOTHING`,
    [MET_PROVIDER, DEMO_EXTERNAL_ID, String(item.title), JSON.stringify(attributes), String(item.creditLine), MET_LICENSE, mediaKey],
  );
  const row = await o.pool.query<{ id: string }>(`SELECT id FROM catalog_item_snapshots WHERE provider = $1 AND external_id = $2`, [MET_PROVIDER, DEMO_EXTERNAL_ID]);
  if (!row.rows[0]) throw new Error("snapshot de demo nao criado");
  return row.rows[0].id;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente.");
  assertLocalDatabase(url);
  const raw = process.env.AUDIT_HMAC_KEY;
  if (typeof raw !== "string" || !/^(?:[0-9a-fA-F]{2}){32,}$/.test(raw)) throw new Error("AUDIT_HMAC_KEY ausente ou invalida (hex, 32+ bytes).");
  const { AuditRepository } = await import("../src/audit/audit.repository");
  const { AuditService } = await import("../src/audit/audit.service");
  const { FileCheckpointStore } = await import("../src/audit/checkpoint-store");
  const { DatabaseRepository } = await import("../src/database/database.repository");
  const { CatalogService } = await import("../src/catalog/catalog.service");
  const { MetCatalogClient } = await import("../src/catalog/met-catalog.client");
  const { LotsRepository } = await import("../src/lots/lots.repository");
  const { LotsService } = await import("../src/lots/lots.service");
  const { BiddingRepository } = await import("../src/lots/bidding.repository");
  const { BiddingService } = await import("../src/lots/bidding.service");
  const { SettlementRepository } = await import("../src/lots/settlement.repository");
  const { SettlementService } = await import("../src/lots/settlement.service");
  const { WalletsRepository } = await import("../src/wallets/wallets.repository");
  const { WalletsService } = await import("../src/wallets/wallets.service");
  const root = resolve(__dirname, "../..");
  const database = new DatabaseRepository(url);
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    const audit = new AuditService(
      new AuditRepository(database.connectionPool, "public"),
      new FileCheckpointStore(process.env.AUDIT_WITNESS_DIR ?? join(root, ".data/witness")),
      Buffer.from(raw, "hex"),
    );
    const media = new MediaStore(process.env.MEDIA_DIR ?? join(root, ".data/media"));
    const password = process.env.SEED_DEMO_PASSWORD ?? DEMO_PASSWORD_DEFAULT;
    const result = await runSeed({
      pool,
      audit,
      media,
      assetsDir: join(root, "docs/design/pranchas/assets/obras"),
      password,
      prepareLot: process.argv.includes("--preparar-lote"),
      databaseUrl: url,
    });
    console.log(`Contas de demo: ${result.users.map((u) => `${u.email} (${u.role})`).join(", ")}`);
    console.log(result.lotCreated ? `Lote de demo criado: ${result.lotId}` : "Nenhum lote novo criado.");
    for (const w of result.warnings) console.warn(w);
    if (!process.argv.includes("--sem-catalogo")) {
      const hashed = await demoPasswordHash(password);
      const ownerId = await ensureUser(pool, "leiloeiro@arremate.demo", "AUCTIONEER", hashed);
      const bidderIds: string[] = [];
      // D31: o histórico do catálogo usa licitante5 no lugar de licitante1, a conta do botão de demo, que começa sem lance.
      for (const n of [5, 2, 3, 4]) bidderIds.push(await ensureUser(pool, `licitante${n}@arremate.demo`, "BIDDER", hashed));
      const catalog = new CatalogService(new MetCatalogClient(), database, media);
      const catalogResult = await runCatalogSeed({
        pool,
        catalog,
        lots: new LotsService(database, new LotsRepository(database), catalog, audit),
        bidding: new BiddingService(database, audit, new BiddingRepository()),
        wallets: new WalletsService(database, new WalletsRepository(database)),
        settlement: new SettlementService(database, audit, new SettlementRepository()),
        ownerId,
        bidderIds,
        prepare: process.argv.includes("--preparar-lote"),
        log: (line) => console.log(line),
      });
      console.log(`Catalogo: ${catalogResult.created.length} lote(s) criado(s), ${catalogResult.skipped.length} ja existente(s).`);
      for (const w of catalogResult.warnings) console.warn(w);
    }
  } finally {
    await pool.end();
    await database.onModuleDestroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}