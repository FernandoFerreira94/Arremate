import { resolve } from "node:path";
import { Pool } from "pg";
import { auditKeyFromEnv } from "../src/app";
import { AuditRepository } from "../src/audit/audit.repository";
import { AuditService } from "../src/audit/audit.service";
import { FileCheckpointStore } from "../src/audit/checkpoint-store";

/** Auditoria item 3: `npm run audit:retry` confirma ou descarta intenções pendentes da testemunha, sem reassinar o banco. */
async function main(): Promise<void> {
  const key = auditKeyFromEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!key || !connectionString) throw new Error("Configure AUDIT_HMAC_KEY e DATABASE_URL.");
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
  try {
    const witnessDir = process.env.AUDIT_WITNESS_DIR ?? resolve(__dirname, "../../.data/witness");
    const audit = new AuditService(new AuditRepository(pool, "public"), new FileCheckpointStore(witnessDir), key);
    const summary = await audit.recoverPending();
    process.stdout.write(`Confirmadas: ${summary.confirmed}. Descartadas: ${summary.discarded}. Bloqueadas: ${summary.blocked.length}.\n`);
    for (const lotId of summary.blocked) process.stdout.write(`  bloqueado: ${lotId}\n`);
    if (summary.blocked.length > 0) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "falha"}\n`);
  process.exitCode = 1;
});
