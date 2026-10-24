import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hash, Algorithm } from "@node-rs/argon2";
import { Pool } from "pg";

/** Contas só do E2E, no banco LOCAL de desenvolvimento (o mesmo da API em 4300). Seed de demo é a Tarefa 10. */
export type E2eUser = { email: string; password: string };
export type E2eUsers = { bidder: E2eUser; bidder2: E2eUser; auctioneer: E2eUser };

export async function ensureE2eUsers(): Promise<E2eUsers> {
  const envFile = resolve(__dirname, "../../.env");
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente para preparar as contas do E2E");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("E2E só prepara contas em banco local");
  // Uma senha por execução (definida no global-setup) para workers paralelos não se sobrescreverem.
  const password = process.env.E2E_RUN_PASSWORD ?? randomBytes(18).toString("base64url");
  const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const users: E2eUsers = {
    bidder: { email: "e2e-licitante@arremate.test", password },
    bidder2: { email: "e2e-licitante2@arremate.test", password },
    auctioneer: { email: "e2e-leiloeiro@arremate.test", password },
  };
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    for (const [email, role] of [[users.bidder.email, "BIDDER"], [users.bidder2.email, "BIDDER"], [users.auctioneer.email, "AUCTIONEER"]] as const) {
      await pool.query(
        `INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [email, role, passwordHash],
      );
    }
  } finally {
    await pool.end();
  }
  return users;
}
