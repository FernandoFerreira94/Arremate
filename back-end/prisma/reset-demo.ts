/**
 * D31: volta a demo LOCAL ao começo (lotes do catálogo recriados, licitante1 sem nenhum lance, saldos iniciais).
 * Zera só os dados de domínio, no mesmo molde do reset do E2E: mantém usuários, snapshots do catálogo, cartões
 * de teste e mídia. Usa o papel owner (o runtime não tem TRUNCATE), lendo a senha só do ambiente. A pasta de
 * testemunhas da auditoria vai para um backup (não é apagada). Depois rode `npm run db:seed --workspace back-end`.
 */
import { existsSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { assertLocalDatabase } from "./seed";

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL ausente.");
  assertLocalDatabase(raw);
  const url = new URL(raw);
  if (url.port !== "5462") throw new Error("Reset da demo só roda no banco de desenvolvimento local (porta 5462).");
  const ownerPassword = process.env.DB_OWNER_PASSWORD;
  if (!ownerPassword) throw new Error("DB_OWNER_PASSWORD ausente.");
  url.username = "auction_owner";
  url.password = encodeURIComponent(ownerPassword);
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    await pool.query(
      "TRUNCATE favorites, receipts, settlements, bids, wallet_entries, wallets, idempotency_records, sessions, notifications, lot_watches, lots RESTART IDENTITY",
    );
  } finally {
    await pool.end();
  }
  const witness = process.env.AUDIT_WITNESS_DIR ?? join(resolve(__dirname, "../.."), ".data/witness");
  if (existsSync(witness)) {
    const backup = `${witness}-antes-reset-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(witness, backup);
    console.log(`Testemunhas da auditoria movidas para ${backup}.`);
  }
  console.log("Dados de domínio zerados. Agora rode: npm run db:seed --workspace back-end");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
