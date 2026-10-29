import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { authFile, apiLoginFresh } from "./api-session";
import { ensureE2eUsers } from "./demo-users";
import { resetE2eDatabase } from "./reset-test-db";
import { ensureE2eArtwork } from "./demo-artwork";
import { E2E_BASE } from "./e2e-env";
import { withWelcomeSeen, type StorageOrigins } from "./welcome";

/**
 * Uma senha e um login por conta por execução: o limite de login (10/min por IP) é regra do produto,
 * então as suítes reutilizam a sessão salva em vez de logar de novo.
 */
export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_PASSWORD ??= randomBytes(18).toString("base64url");
  await resetE2eDatabase();
  await ensureE2eArtwork();
  const users = await ensureE2eUsers();
  mkdirSync(".playwright-auth", { recursive: true });
  for (const role of ["auctioneer", "bidder", "bidder2"] as const) {
    const session = await apiLoginFresh(users[role]);
    await session.ctx.storageState({ path: authFile(role) });
    await session.ctx.dispose();
    const saved = JSON.parse(readFileSync(authFile(role), "utf8")) as StorageOrigins;
    writeFileSync(authFile(role), JSON.stringify(withWelcomeSeen(saved, E2E_BASE)));
  }
}
