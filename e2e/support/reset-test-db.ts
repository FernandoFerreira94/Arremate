import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { e2eDatabaseUrl } from "./e2e-env";

/**
 * Zera os dados de domínio do banco LOCAL de teste (5463) antes do E2E, para a vitrine do E2E
 * começar limpa e nunca tocar no banco de desenvolvimento. Mantém usuários e snapshots do catálogo.
 * Usa o papel owner (o runtime não tem TRUNCATE), lendo a senha só do ambiente.
 */
export async function resetE2eDatabase(): Promise<void> {
  const envFile = resolve(__dirname, "../../.env");
  if (!process.env.DB_OWNER_PASSWORD && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = new URL(e2eDatabaseUrl(process.env.TEST_DATABASE_URL));
  const ownerPassword = process.env.DB_OWNER_PASSWORD;
  if (!ownerPassword) throw new Error("DB_OWNER_PASSWORD ausente para limpar o banco de teste do E2E");
  url.username = "auction_owner";
  url.password = encodeURIComponent(ownerPassword);
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    await pool.query(
      "TRUNCATE favorites, receipts, settlements, bids, wallet_entries, wallets, idempotency_records, sessions, lots RESTART IDENTITY",
    );
  } finally {
    await pool.end();
  }
}
