import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { authFile, apiLoginFresh } from "./api-session";
import { ensureE2eUsers } from "./demo-users";

/**
 * Uma senha e um login por conta por execução: o limite de login (10/min por IP) é regra do produto,
 * então as suítes reutilizam a sessão salva em vez de logar de novo.
 */
export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_PASSWORD ??= randomBytes(18).toString("base64url");
  const users = await ensureE2eUsers();
  mkdirSync(".playwright-auth", { recursive: true });
  for (const role of ["auctioneer", "bidder", "bidder2"] as const) {
    const session = await apiLoginFresh(users[role]);
    await session.ctx.storageState({ path: authFile(role) });
    await session.ctx.dispose();
  }
}
