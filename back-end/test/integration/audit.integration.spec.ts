import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { Pool, type PoolClient, type QueryResult } from "pg";
import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService, IntegrityBlockedError } from "../../src/audit/audit.service";
import { FileCheckpointStore, type CheckpointStore, type FailStage } from "../../src/audit/checkpoint-store";
import type { AuditResult } from "../../src/audit/audit.types";

jest.setTimeout(60000);

const PROBE_SCHEMA = "audit_probe";
const KEY = Buffer.alloc(32, 0x11);
const CLOCK = "2026-10-23T18:30:00.000Z";
const STARTS_AT = "2026-10-23T18:00:00.000Z";
const ENDS_AT = "2026-10-23T19:00:00.000Z";

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
    throw new Error("A prova de auditoria só pode usar o PostgreSQL local.");
  }
  if (url.port !== "5463" || url.pathname !== "/casadeleilao_test") {
    throw new Error("A prova de auditoria só pode usar casadeleilao_test na porta 5463.");
  }
  url.username = "auction_owner";
  url.password = password;
  return url.toString();
}

function assertLocalTestUrl(connectionString: string): void {
  const url = new URL(connectionString);
  if ((url.hostname !== "127.0.0.1" && url.hostname !== "localhost") || url.port !== "5463" || url.pathname !== "/casadeleilao_test") {
    throw new Error("A prova de auditoria só pode usar casadeleilao_test na porta 5463.");
  }
}

async function query(client: PoolClient, text: string, values: readonly unknown[] = []): Promise<QueryResult> {
  return client.query(text, [...values]);
}

describe("auditoria com PostgreSQL e testemunha em disco", () => {
  const witnessRoot = mkdtemp(join(tmpdir(), "casadeleilao-audit-"));
  const appPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    connectionTimeoutMillis: 3000,
    max: 4,
  });
  const ownerPool = new Pool({ connectionString: testOwnerUrl(), connectionTimeoutMillis: 3000, max: 1 });
  let owner: PoolClient;
  let app: PoolClient;
  let witnessDir = "";
  let store: FileCheckpointStore;
  let service: AuditService;
  let repository: AuditRepository;
  let auctioneerId = "";
  let bidderA = "";
  let bidderB = "";

  beforeAll(async () => {
    assertLocalTestUrl(process.env.TEST_DATABASE_URL ?? "");
    witnessDir = await witnessRoot;
    store = new FileCheckpointStore(witnessDir);
    owner = await ownerPool.connect();
    const identity = await query(owner, "SELECT current_database() AS database, current_user AS role");
    expect(identity.rows[0]).toEqual({ database: "casadeleilao_test", role: "auction_owner" });
    await query(owner, `DROP SCHEMA IF EXISTS ${PROBE_SCHEMA} CASCADE`);
    await query(owner, `CREATE SCHEMA ${PROBE_SCHEMA}`);
    await query(owner, `GRANT USAGE ON SCHEMA ${PROBE_SCHEMA} TO auction_app`);
    await query(owner, `SET search_path TO ${PROBE_SCHEMA}`);
    await query(owner, migrationSql());
    app = await appPool.connect();
    await query(app, `SET search_path TO ${PROBE_SCHEMA}`);
    repository = new AuditRepository(appPool, PROBE_SCHEMA);
    service = new AuditService(repository, store, KEY, () => CLOCK);

    auctioneerId = (await query(app, `INSERT INTO users (email, role, password_hash) VALUES ('auctioneer@example.test', 'AUCTIONEER', 'hash') RETURNING id`)).rows[0].id as string;
    bidderA = (await query(app, `INSERT INTO users (email, role, password_hash) VALUES ('bidder-a@example.test', 'BIDDER', 'hash') RETURNING id`)).rows[0].id as string;
    bidderB = (await query(app, `INSERT INTO users (email, role, password_hash) VALUES ('bidder-b@example.test', 'BIDDER', 'hash') RETURNING id`)).rows[0].id as string;
    await query(
      app,
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', 'audit-probe', 'Obra', '{}'::jsonb, 'The Met', 'CC0', 'media/audit-probe')`,
    );
  });

  afterAll(async () => {
    app?.release();
    await appPool.end();
    if (owner) {
      await query(owner, `DROP SCHEMA IF EXISTS ${PROBE_SCHEMA} CASCADE`);
      owner.release();
    }
    await ownerPool.end();
    if (witnessDir) {
      await rm(witnessDir, { recursive: true, force: true });
    }
  });

  async function insertLot(): Promise<string> {
    const snapshot = await query(app, `SELECT id FROM catalog_item_snapshots WHERE external_id = 'audit-probe'`);
    const lot = await query(
      app,
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, 10000, 500, $3, $4) RETURNING id`,
      [auctioneerId, snapshot.rows[0].id, STARTS_AT, ENDS_AT],
    );
    return lot.rows[0].id as string;
  }

  async function accept(lotId: string, sequence: number): Promise<void> {
    await service.acceptBid({
      lotId,
      bidId: randomUUID(),
      bidderUserId: sequence % 2 === 0 ? bidderB : bidderA,
      alias: `Licitante café ${sequence}`,
      sequence,
      amountCents: BigInt(10000 + (sequence - 1) * 500),
      acceptedAt: `2026-10-23T18:01:0${sequence}.000Z`,
      endsAt: ENDS_AT,
    });
  }

  async function freshChain(): Promise<string> {
    const lotId = await insertLot();
    await service.openGenesis(lotId);
    await accept(lotId, 1);
    await accept(lotId, 2);
    await accept(lotId, 3);
    return lotId;
  }

  function verifyInNewProcess(lotId: string): Promise<Pick<AuditResult, "status" | "count" | "revision" | "reasonCode">> {
    const backendRoot = join(__dirname, "../..");
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["-r", "ts-node/register", join("test", "integration", "audit-restart-cli.ts"), lotId], {
        cwd: backendRoot,
        env: {
          ...process.env,
          AUDIT_WITNESS_DIR: witnessDir,
          AUDIT_PROBE_SCHEMA: PROBE_SCHEMA,
          AUDIT_HMAC_KEY_HEX: KEY.toString("hex"),
        },
      });
      let stdout = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.resume();
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`processo de restart saiu ${code}`));
          return;
        }
        resolve(JSON.parse(stdout) as Pick<AuditResult, "status" | "count" | "revision" | "reasonCode">);
      });
    });
  }

  it("aceita um lote vazio com gênese válida e três lances encadeados", async () => {
    const emptyId = await insertLot();
    await service.openGenesis(emptyId);
    const empty = await service.verifyLot(emptyId);
    expect(empty).toMatchObject({ status: "INTACT", revision: 0, count: 0, verifiedAt: CLOCK, reasonCode: "INTACT" });
    expect(JSON.stringify(empty)).not.toContain(auctioneerId);

    const lotId = await freshChain();
    const intact = await service.verifyLot(lotId);
    expect(intact).toMatchObject({ status: "INTACT", revision: 3, count: 3, verifiedAt: CLOCK, reasonCode: "INTACT" });
    expect(JSON.stringify(intact)).not.toContain(bidderA);
    expect(JSON.stringify(intact)).not.toContain(bidderB);
    expect(store.directorySync).not.toBe("pending");
    await expect(service.assertCanMutate(lotId)).resolves.toBeUndefined();
  });

  it("nunca devolve INTACT quando o SQL direto adulterar o histórico ou o lote", async () => {
    const attacks: Array<{ name: string; run: (lotId: string) => Promise<void> }> = [
      {
        name: "altera valor",
        run: async (lotId) => {
          await query(app, `UPDATE bids SET amount_cents = 1 WHERE lot_id = $1 AND sequence = 2`, [lotId]);
        },
      },
      {
        name: "troca usuário e mantém alias",
        run: async (lotId) => {
          await query(app, `UPDATE bids SET user_id = $2 WHERE lot_id = $1 AND sequence = 2`, [lotId, bidderA]);
        },
      },
      {
        name: "insere lance",
        run: async (lotId) => {
          await query(
            app,
            `INSERT INTO bids (lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature)
             VALUES ($1, $2, 'Inserido', 4, 12000, '2026-10-23T18:01:04.000Z', $3)`,
            [lotId, bidderB, "ab".repeat(32)],
          );
        },
      },
      {
        name: "remove o início",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1 AND sequence = 1`, [lotId]);
        },
      },
      {
        name: "remove o meio",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1 AND sequence = 2`, [lotId]);
        },
      },
      {
        name: "remove o fim",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1 AND sequence = 3`, [lotId]);
        },
      },
      {
        name: "remove tudo",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1`, [lotId]);
        },
      },
      {
        name: "reordena",
        run: async (lotId) => {
          await query(app, `UPDATE bids SET sequence = 99 WHERE lot_id = $1 AND sequence = 1`, [lotId]);
          await query(app, `UPDATE bids SET sequence = 1 WHERE lot_id = $1 AND sequence = 2`, [lotId]);
          await query(app, `UPDATE bids SET sequence = 2 WHERE lot_id = $1 AND sequence = 99`, [lotId]);
        },
      },
      {
        name: "restaura prefixo antigo",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1 AND sequence > 1`, [lotId]);
        },
      },
      {
        name: "remove o lote",
        run: async (lotId) => {
          await query(app, `DELETE FROM bids WHERE lot_id = $1`, [lotId]);
          await query(app, `DELETE FROM lots WHERE id = $1`, [lotId]);
        },
      },
      {
        name: "altera o termo inicial",
        run: async (lotId) => {
          await query(app, `UPDATE lots SET initial_cents = 10001 WHERE id = $1`, [lotId]);
        },
      },
      {
        name: "altera o fim vigente",
        run: async (lotId) => {
          await query(app, `UPDATE lots SET ends_at = '2026-10-23T19:30:00.000Z' WHERE id = $1`, [lotId]);
        },
      },
      {
        name: "altera a liquidação",
        run: async (lotId) => {
          const settlement = await query(app, `INSERT INTO settlements (lot_id, settled_at) VALUES ($1, '2026-10-23T19:00:01.000Z') RETURNING id`, [lotId]);
          await query(app, `INSERT INTO receipts (settlement_id, public_token) VALUES ($1, $2)`, [settlement.rows[0].id, `recibo-${lotId}`]);
        },
      },
    ];

    for (const attack of attacks) {
      const lotId = await freshChain();
      await attack.run(lotId);
      const result = await service.verifyLot(lotId);
      expect({ attack: attack.name, status: result.status }).toEqual({ attack: attack.name, status: "TAMPERED" });
      expect(JSON.stringify(result)).not.toContain(bidderA);
      expect(JSON.stringify(result)).not.toContain(`recibo-${lotId}`);
      await expect(service.assertCanMutate(lotId)).rejects.toBeInstanceOf(IntegrityBlockedError);
    }
  });

  it("commitWithoutCheckpointIsIndeterminate", async () => {
    for (const stage of ["write", "fsync", "rename"] as const satisfies readonly FailStage[]) {
      const lotId = await insertLot();
      await service.openGenesis(lotId);
      store.failNextAdvance = stage;
      await expect(service.acceptBid({
        lotId,
        bidId: randomUUID(),
        bidderUserId: bidderA,
        alias: "Licitante café 1",
        sequence: 1,
        amountCents: 10000n,
        acceptedAt: "2026-10-23T18:01:01.000Z",
        endsAt: ENDS_AT,
      })).rejects.toThrow(stage);
      const gap = await service.verifyLot(lotId);
      expect(gap.status).toBe("INDETERMINATE");
      expect(gap.reasonCode).toBe("CONFIRMATION_GAP");
      await expect(service.assertCanMutate(lotId)).rejects.toMatchObject({ code: "CONFIRMATION_PENDING" });
      const stored = await query(app, `SELECT count(*)::int AS count FROM bids WHERE lot_id = $1`, [lotId]);
      expect(stored.rows[0].count).toBe(1);

      if (stage === "fsync") {
        await service.retryCheckpoint(lotId);
        await expect(service.verifyLot(lotId)).resolves.toMatchObject({ status: "INTACT", count: 1 });
      }
      if (stage === "rename") {
        await store.clearPending(lotId);
        await expect(service.retryCheckpoint(lotId)).rejects.toThrow(/não reassinar/);
        await expect(service.verifyLot(lotId)).resolves.toMatchObject({ status: "INDETERMINATE" });
      }
    }
  });

  it("stableRevisionDuringRead", async () => {
    const lotId = await freshChain();
    let reads = 0;
    const flipping: CheckpointStore = {
      read: async (id) => {
        const found = await store.read(id);
        if (!found) {
          return null;
        }
        reads += 1;
        return { ...found, revision: found.revision + reads };
      },
      readPending: (id) => store.readPending(id),
      writePending: (checkpoint) => store.writePending(checkpoint),
      clearPending: (id) => store.clearPending(id),
      advance: (expectedRevision, next) => store.advance(expectedRevision, next),
    };
    const racing = new AuditService(repository, flipping, KEY, () => CLOCK);
    const result = await racing.verifyLot(lotId);
    expect(result.status).toBe("INDETERMINATE");
    expect(result.reasonCode).toBe("CONCURRENT_READ");
    expect(result.status).not.toBe("TAMPERED");
  });

  it("rejectsRestoredPrefix", async () => {
    const lotId = await insertLot();
    await service.openGenesis(lotId);
    await accept(lotId, 1);
    await accept(lotId, 2);
    await accept(lotId, 3);
    await expect(store.advance(0, { ...(await store.read(lotId))!, revision: 0 })).rejects.toThrow(/revisão/);

    const restarted = await verifyInNewProcess(lotId);
    expect(restarted).toMatchObject({ status: "INTACT", count: 3, revision: 3 });

    await query(app, `DELETE FROM bids WHERE lot_id = $1 AND sequence > 1`, [lotId]);
    const restored = await verifyInNewProcess(lotId);
    expect(restored.status).toBe("TAMPERED");
    expect(restored.reasonCode).toBe("HISTORY_TRUNCATED");

    const otherId = await insertLot();
    await service.openGenesis(otherId);
    await accept(otherId, 1);
    const earlyWitness = await readFile(join(witnessDir, otherId, "checkpoint"));
    await accept(otherId, 2);
    await accept(otherId, 3);
    const currentWitness = await readFile(join(witnessDir, otherId, "checkpoint"));
    await writeFile(join(witnessDir, otherId, "checkpoint"), earlyWitness);
    const replaced = await service.verifyLot(otherId);
    expect(replaced.status).not.toBe("INTACT");
    await writeFile(join(witnessDir, otherId, "checkpoint"), currentWitness);
  });

  it("sem chave ou sem testemunha devolve INDETERMINATE", async () => {
    const lotId = await insertLot();
    const missingWitness = await service.verifyLot(lotId);
    expect(missingWitness).toMatchObject({ status: "INDETERMINATE", reasonCode: "MISSING_WITNESS" });

    await service.openGenesis(lotId);
    const blind = new AuditService(repository, store, null, () => CLOCK);
    const missingKey = await blind.verifyLot(lotId);
    expect(missingKey).toMatchObject({ status: "INDETERMINATE", reasonCode: "MISSING_KEY" });
    expect(missingKey.status).not.toBe("INTACT");
  });

  it("não trata como íntegro um lote duplicado no banco", async () => {
    const lotId = await insertLot();
    await service.openGenesis(lotId);
    await query(owner, `ALTER TABLE lots DROP CONSTRAINT lots_pkey CASCADE`);
    try {
      await query(
        owner,
        `INSERT INTO lots (id, owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at, revision)
         SELECT id, owner_id, snapshot_id, 10001, increment_cents, starts_at, ends_at, revision
         FROM lots WHERE id = $1 LIMIT 1`,
        [lotId],
      );
      const result = await service.verifyLot(lotId);
      expect(result.status).toBe("TAMPERED");
    } finally {
      await query(owner, `DELETE FROM lots WHERE id = $1 AND initial_cents = 10001`, [lotId]);
      await query(owner, `ALTER TABLE lots ADD CONSTRAINT lots_pkey PRIMARY KEY (id)`);
      await query(
        owner,
        `ALTER TABLE bids ADD CONSTRAINT bids_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE RESTRICT ON UPDATE CASCADE`,
      );
      await query(
        owner,
        `ALTER TABLE settlements ADD CONSTRAINT settlements_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE RESTRICT ON UPDATE CASCADE`,
      );
    }
  });

  it("serializa dois checkpoints do mesmo lote", async () => {
    const lotId = await insertLot();
    await service.openGenesis(lotId);
    const results = await Promise.allSettled([accept(lotId, 1), accept(lotId, 1)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(service.verifyLot(lotId)).resolves.toMatchObject({ status: "INTACT", count: 1, revision: 1 });
  });
});
