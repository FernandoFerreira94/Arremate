import { randomUUID } from "node:crypto";
import { expect, request, type APIRequestContext } from "@playwright/test";
import { resolve } from "node:path";
import type { E2eUser, E2eUsers } from "./demo-users";

const BASE = "http://127.0.0.1:3300";
/** Obras CC0 do The Met já usadas nas pranchas (docs/design/pranchas/assets/obras). */
export const MET_IDS = ["436535", "437329", "436105", "437984", "10481"] as const;

export type ApiSession = { ctx: APIRequestContext; post: (path: string, data: unknown, key?: string) => Promise<unknown> };
export type Role = keyof E2eUsers;

export const authFile = (role: Role): string => resolve(__dirname, "../../.playwright-auth", `${role}.json`);

/** Sessão HTTP pelo proxy do site (mesma origem), com CSRF; nada de atalho direto no banco. */
export async function apiLoginFresh(user: E2eUser): Promise<ApiSession> {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const csrf = async () => ((await (await ctx.get("/api/auth/csrf")).json()) as { csrfToken: string }).csrfToken;
  const login = await ctx.post("/api/auth/login", { data: { email: user.email, password: user.password }, headers: { "X-CSRF-Token": await csrf() } });
  expect(login.status(), "login da conta E2E").toBeLessThan(300);
  return withPost(ctx);
}

/** Reaproveita a sessão gravada pelo global-setup. */
export async function apiAs(role: Role): Promise<ApiSession> {
  return withPost(await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE }, storageState: authFile(role) }));
}

function withPost(ctx: APIRequestContext): ApiSession {
  const csrf = async () => ((await (await ctx.get("/api/auth/csrf")).json()) as { csrfToken: string }).csrfToken;
  const post = async (path: string, data: unknown, key = randomUUID()) => {
    const response = await ctx.post(path, { data, headers: { "X-CSRF-Token": await csrf(), "Idempotency-Key": key } });
    const text = await response.text();
    if (!response.ok()) throw new Error(`${path} -> ${response.status()} ${text}`);
    return text ? (JSON.parse(text) as unknown) : null;
  };
  return { ctx, post };
}

export type LotTiming = { startsInMs?: number; endsInMs: number; externalId?: string };

export async function publishLot(seller: ApiSession, timing: LotTiming): Promise<string> {
  const now = Date.now();
  const lot = (await seller.post("/api/lots", {
    externalId: timing.externalId ?? MET_IDS[0],
    initialCents: "10000",
    incrementCents: "1000",
    startsAt: new Date(now + (timing.startsInMs ?? 0)).toISOString(),
    endsAt: new Date(now + timing.endsInMs).toISOString(),
  })) as { id: string };
  return lot.id;
}

export async function deposit(bidder: ApiSession, cents: string): Promise<void> {
  await bidder.post("/api/wallet/deposits", { amountCents: cents });
}
