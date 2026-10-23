import { Pool } from "pg";
import { AuditRepository } from "../../src/audit/audit.repository";
import { AuditService } from "../../src/audit/audit.service";
import { FileCheckpointStore } from "../../src/audit/checkpoint-store";

function assertLocalTestDatabase(connectionString: string): void {
  const url = new URL(connectionString);
  const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!localHost || url.port !== "5463" || url.pathname !== "/casadeleilao_test") {
    throw new Error("banco de teste local obrigatório");
  }
}

async function main(): Promise<void> {
  const lotId = process.argv[2] ?? "";
  const witnessDir = process.env.AUDIT_WITNESS_DIR ?? "";
  const schema = process.env.AUDIT_PROBE_SCHEMA ?? "";
  const keyHex = process.env.AUDIT_HMAC_KEY_HEX ?? "";
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
  if (!witnessDir || !/^[a-z_][a-z0-9_]*$/.test(schema) || !/^[0-9a-f]{64}$/.test(keyHex)) {
    throw new Error("parâmetros de restart ausentes");
  }
  assertLocalTestDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const service = new AuditService(
      new AuditRepository(pool, schema),
      new FileCheckpointStore(witnessDir),
      Buffer.from(keyHex, "hex"),
    );
    const result = await service.verifyLot(lotId);
    process.stdout.write(
      JSON.stringify({
        status: result.status,
        count: result.count,
        revision: result.revision,
        reasonCode: result.reasonCode,
      }),
    );
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  process.stderr.write("restart falhou\n");
  process.exitCode = 1;
});
