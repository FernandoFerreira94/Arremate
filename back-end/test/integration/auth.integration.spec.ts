import "reflect-metadata";
import { createHash, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import type { Response } from "supertest";
import { createApplication } from "../../src/app";
import { hashPassword } from "../../src/auth/password-hash";

const ORIGIN = "http://127.0.0.1:3300";
const EMAIL_PREFIX = "tarefa3-";

describe("sessão HTTP", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  let app: INestApplication;
  let now = 1_700_000_000_000;
  let passwordHash = "";
  const logLines: string[] = [];

  beforeAll(async () => {
    passwordHash = await hashPassword("senha-correta-demonstracao");
    app = await createApplication({
      connectionString,
      logger: false,
      now: () => now,
      allowedOrigins: [ORIGIN],
    });
    await app.init();
  });

  beforeEach(() => {
    now += 120_000;
    logLines.length = 0;
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM lots WHERE owner_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`${EMAIL_PREFIX}%`],
    );
    await pool.query(`DELETE FROM catalog_item_snapshots WHERE external_id LIKE $1`, [`${EMAIL_PREFIX}%`]);
    await pool.query(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`${EMAIL_PREFIX}%`],
    );
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%`]);
    await app?.close();
    await pool.end();
  });

  function remember(jar: Map<string, string>, response: Response): void {
    const raw = response.headers["set-cookie"];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of list) {
      const pair = item.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value.length === 0 || /Max-Age=0/i.test(item)) jar.delete(name);
      else jar.set(name, value);
    }
  }

  function cookieHeader(jar: Map<string, string>): string {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async function issueCsrf(jar: Map<string, string>): Promise<string> {
    const response = await request(app.getHttpServer()).get("/api/auth/csrf").set("Cookie", cookieHeader(jar));
    expect(response.status).toBe(200);
    remember(jar, response);
    expect(typeof response.body.csrfToken).toBe("string");
    expect(response.body.csrfToken.length).toBeGreaterThan(20);
    return response.body.csrfToken as string;
  }

  async function postLogin(jar: Map<string, string>, body: Record<string, string>, extra: { origin?: string; csrf?: string; skipCsrf?: boolean } = {}) {
    const csrf = extra.skipCsrf ? undefined : extra.csrf ?? await issueCsrf(jar);
    const call = request(app.getHttpServer()).post("/api/auth/login").set("Cookie", cookieHeader(jar)).send(body);
    if (extra.origin !== "") call.set("Origin", extra.origin ?? ORIGIN);
    if (csrf) call.set("X-CSRF-Token", csrf);
    const response = await call;
    remember(jar, response);
    return response;
  }

  async function createUser(role: "AUCTIONEER" | "BIDDER"): Promise<{ id: string; email: string }> {
    const email = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [email, role, passwordHash],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("usuário de teste não foi criado");
    return { id, email };
  }

  it("emite csrf e entra com credencial válida sem vazar cookie, e-mail ou id", async () => {
    const user = await createUser("BIDDER");
    const jar = new Map<string, string>();
    const csrfResponse = await request(app.getHttpServer()).get("/api/auth/csrf");
    expect(csrfResponse.status).toBe(200);
    expect(csrfResponse.headers["access-control-allow-origin"]).toBeUndefined();
    expect(csrfResponse.headers["cache-control"]).toContain("no-store");
    remember(jar, csrfResponse);
    const setCookie = headerList(csrfResponse);
    expect(setCookie.join(";")).toMatch(/HttpOnly/i);
    expect(setCookie.join(";")).toMatch(/SameSite=Lax/i);
    expect(setCookie.join(";")).not.toMatch(/Domain=/i);
    expect(JSON.stringify(csrfResponse.body)).not.toContain(jar.get("csrf"));

    const response = await postLogin(jar, { email: user.email, password: "senha-correta-demonstracao" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ role: "BIDDER", returnTo: "/", message: "Login realizado." });
    const session = jar.get("session");
    expect(session).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain(session);
    expect(JSON.stringify(response.body)).not.toContain(user.email);
    expect(JSON.stringify(response.body)).not.toContain(user.id);
    const stored = await pool.query<{ token_hash: string; seconds: string }>(
      `SELECT token_hash, EXTRACT(EPOCH FROM (expires_at - created_at))::text AS seconds
       FROM sessions WHERE user_id = $1`,
      [user.id],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.token_hash).toBe(createHash("sha256").update(session ?? "").digest("hex"));
    expect(stored.rows[0]?.token_hash).not.toContain(session);
    expect(Number(stored.rows[0]?.seconds)).toBeGreaterThan(8 * 3600 - 5);
    expect(Number(stored.rows[0]?.seconds)).toBeLessThan(8 * 3600 + 5);

    const me = await request(app.getHttpServer()).get("/api/auth/me").set("Cookie", cookieHeader(jar)).set("X-Role", "AUCTIONEER").set("X-User-Id", randomUUID());
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ role: "BIDDER", userId: user.id, name: "Participante" });
    expect(JSON.stringify(me.body)).not.toContain(session);
  });

  it("responde credencial inválida do mesmo jeito para senha errada e e-mail desconhecido", async () => {
    const user = await createUser("BIDDER");
    const wrong = await postLogin(new Map(), { email: user.email, password: "senha-errada" });
    const missing = await postLogin(new Map(), { email: `${EMAIL_PREFIX}${randomUUID()}@example.com`, password: "senha-correta-demonstracao" });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toMatchObject({ code: "CREDENCIAIS_INVALIDAS", message: "E-mail ou senha inválidos." });
    expect(missing.body).toMatchObject({ code: missing.body.code, message: wrong.body.message });
    expect(missing.body.code).toBe(wrong.body.code);
    expect(JSON.stringify(wrong.body)).not.toContain("senha-errada");
    expect(headerList(wrong).join(";")).not.toContain("session=");
  });

  it("recusa sessão expirada e revogada com o mesmo 401", async () => {
    const user = await createUser("BIDDER");
    const jar = new Map<string, string>();
    expect((await postLogin(jar, { email: user.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    await pool.query(`UPDATE sessions SET expires_at = statement_timestamp() - interval '1 second' WHERE user_id = $1`, [user.id]);
    const expired = await request(app.getHttpServer()).get("/api/auth/me").set("Cookie", cookieHeader(jar));
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe("SESSAO_NECESSARIA");

    const again = new Map<string, string>();
    expect((await postLogin(again, { email: user.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    await pool.query(`UPDATE sessions SET revoked_at = statement_timestamp() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
    const revoked = await request(app.getHttpServer()).get("/api/auth/me").set("Cookie", cookieHeader(again));
    expect(revoked.status).toBe(401);
    expect(revoked.body.code).toBe("SESSAO_NECESSARIA");
    expect(revoked.body.message).toBe(expired.body.message);
  });

  it("revoga a sessão no logout e não aceita o cookie de novo", async () => {
    const user = await createUser("BIDDER");
    const jar = new Map<string, string>();
    expect((await postLogin(jar, { email: user.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    const csrf = await issueCsrf(jar);
    const logout = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(jar))
      .set("X-CSRF-Token", csrf);
    expect(logout.status).toBe(204);
    expect(logout.text).toBe("");
    const row = await pool.query<{ revoked_at: Date | null }>(`SELECT revoked_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [user.id]);
    expect(row.rows[0]?.revoked_at).not.toBeNull();
    const me = await request(app.getHttpServer()).get("/api/auth/me").set("Cookie", cookieHeader(jar));
    expect(me.status).toBe(401);
  });

  it("nega depósito e lance ao leiloeiro e criação ao licitante, sem gravar efeito", async () => {
    const auctioneer = await createUser("AUCTIONEER");
    const bidder = await createUser("BIDDER");
    const auctioneerJar = new Map<string, string>();
    const bidderJar = new Map<string, string>();
    expect((await postLogin(auctioneerJar, { email: auctioneer.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    expect((await postLogin(bidderJar, { email: bidder.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    const lotId = randomUUID();

    const deposit = await mutate(auctioneerJar, "post", "/api/wallet/deposits", {});
    const bid = await mutate(auctioneerJar, "post", `/api/lots/${lotId}/bids`, {});
    const create = await mutate(bidderJar, "post", "/api/lots", { role: "AUCTIONEER", userId: auctioneer.id });
    expect(deposit.status).toBe(403);
    expect(bid.status).toBe(403);
    expect(create.status).toBe(403);
    expect(deposit.body.code).toBe("ACESSO_NEGADO");
    expect(create.body.code).toBe("ACESSO_NEGADO");

    const bidderDeposit = await mutate(bidderJar, "post", "/api/wallet/deposits", {});
    const auctioneerCreate = await mutate(auctioneerJar, "post", "/api/lots", {});
    expect(bidderDeposit.status).not.toBe(403);
    expect(auctioneerCreate.status).not.toBe(403);
    const wallets = await pool.query(`SELECT id FROM wallets WHERE user_id = $1`, [bidder.id]);
    const lots = await pool.query(`SELECT id FROM lots WHERE owner_id = $1`, [auctioneer.id]);
    expect(wallets.rowCount).toBe(0);
    expect(lots.rowCount).toBe(0);
    expect(JSON.stringify(bidderDeposit.body).toLowerCase()).not.toContain("not implemented");
  });

  it("responde 404 quando outro leiloeiro tenta o lote e ignora userId injetado", async () => {
    const owner = await createUser("AUCTIONEER");
    const other = await createUser("AUCTIONEER");
    const snapshot = await pool.query<{ id: string }>(
      `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
       VALUES ('met', $1, 'Obra', '{}'::jsonb, 'Met', 'CC0', $2) RETURNING id`,
      [`${EMAIL_PREFIX}${randomUUID()}`, `media/${randomUUID()}`],
    );
    const snapshotId = snapshot.rows[0]?.id;
    if (!snapshotId) throw new Error("snapshot de teste não foi criado");
    const lot = await pool.query<{ id: string }>(
      `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
       VALUES ($1, $2, 1000, 100, statement_timestamp(), statement_timestamp() + interval '1 hour') RETURNING id`,
      [owner.id, snapshotId],
    );
    const lotId = lot.rows[0]?.id;
    if (!lotId) throw new Error("lote de teste não foi criado");
    const ownerJar = new Map<string, string>();
    const otherJar = new Map<string, string>();
    expect((await postLogin(ownerJar, { email: owner.email, password: "senha-correta-demonstracao" })).status).toBe(200);
    expect((await postLogin(otherJar, { email: other.email, password: "senha-correta-demonstracao" })).status).toBe(200);

    const forbidden = await mutate(otherJar, "post", `/api/lots/${lotId}/cancel`, {}, { "X-User-Id": owner.id });
    expect(forbidden.status).toBe(404);
    expect(forbidden.body.code).toBe("NAO_ENCONTRADO");
    expect(JSON.stringify(forbidden.body)).not.toContain(owner.id);
    expect(JSON.stringify(forbidden.body)).not.toContain(owner.email);

    const injected = await mutate(otherJar, "post", `/api/lots/${lotId}/cancel`, { userId: owner.id, role: "AUCTIONEER" });
    expect(injected.status).toBe(400);
    expect(injected.body.code).toBe("REQUISICAO_INVALIDA");

    const own = await mutate(ownerJar, "post", `/api/lots/${lotId}/cancel`, {});
    expect(own.status).toBe(200);
    const status = await pool.query<{ status: string }>(`SELECT status FROM lots WHERE id = $1`, [lotId]);
    expect(status.rows[0]?.status).toBe("CANCELLED");
  });

  it("recusa role e userId no login e não promove o papel", async () => {
    const user = await createUser("BIDDER");
    const response = await postLogin(new Map(), {
      email: user.email,
      password: "senha-correta-demonstracao",
      role: "AUCTIONEER",
      userId: randomUUID(),
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("REQUISICAO_INVALIDA");
    expect(headerList(response).join(";")).not.toContain("session=");
    const role = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [user.id]);
    expect(role.rows[0]?.role).toBe("BIDDER");
  });

  it("recusa csrf ausente, incorreto, origem externa e origem ausente no login", async () => {
    const user = await createUser("BIDDER");
    const body = { email: user.email, password: "senha-correta-demonstracao" };
    const missing = await postLogin(new Map(), body, { skipCsrf: true });
    const jar = new Map<string, string>();
    const token = await issueCsrf(jar);
    const wrong = await postLogin(jar, body, { csrf: `${token}xx` });
    const external = await postLogin(new Map(), body, { origin: "https://evil.example" });
    const absent = await postLogin(new Map(), body, { origin: "" });
    for (const response of [missing, wrong, external, absent]) {
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("CSRF_RECUSADO");
      expect(headerList(response).join(";")).not.toContain("session=");
    }
  });

  it("recusa returnTo externo e devolve o caminho local permitido", async () => {
    const bidder = await createUser("BIDDER");
    const auctioneer = await createUser("AUCTIONEER");
    const evil = await postLogin(new Map(), { email: bidder.email, password: "senha-correta-demonstracao", returnTo: "https://evil" });
    const slash = await postLogin(new Map(), { email: bidder.email, password: "senha-correta-demonstracao", returnTo: "//evil" });
    expect(evil.status).toBe(400);
    expect(slash.status).toBe(400);
    expect(JSON.stringify(evil.body)).not.toContain("evil");
    expect(headerList(evil).join(";")).not.toContain("session=");
    const home = await postLogin(new Map(), { email: auctioneer.email, password: "senha-correta-demonstracao" });
    expect(home.status).toBe(200);
    expect(home.body.returnTo).toBe("/painel/lotes");
    const wallet = await postLogin(new Map(), { email: bidder.email, password: "senha-correta-demonstracao", returnTo: "/carteira" });
    expect(wallet.status).toBe(200);
    expect(wallet.body.returnTo).toBe("/carteira");
  });

  it("não coloca o cookie no JSON nem no log e ignora X-Forwarded-For no limite", async () => {
    const user = await createUser("BIDDER");
    const spies = ["error", "warn", "log", "debug", "verbose"].map((method) =>
      jest.spyOn(Logger.prototype, method as "error").mockImplementation((message: unknown) => {
        logLines.push(String(message));
      }),
    );
    try {
      const jar = new Map<string, string>();
      const response = await postLogin(jar, { email: user.email, password: "senha-correta-demonstracao" });
      expect(response.status).toBe(200);
      const session = jar.get("session") ?? "";
      expect(session.length).toBeGreaterThan(20);
      expect(JSON.stringify(response.body)).not.toContain(session);
      expect(logLines.join("\n")).not.toContain(session);
      expect(logLines.join("\n")).not.toContain("senha-correta-demonstracao");
    } finally {
      for (const spy of spies) spy.mockRestore();
    }

    now += 120_000;
    const limited = new Map<string, string>();
    await issueCsrf(limited);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const failure = await request(app.getHttpServer())
        .post("/api/auth/login")
        .set("Origin", ORIGIN)
        .set("Cookie", cookieHeader(limited))
        .set("X-CSRF-Token", "token-errado")
        .set("X-Forwarded-For", `203.0.113.${attempt}`)
        .send({ email: user.email, password: "senha-errada" });
      expect(failure.status).toBe(403);
    }
    const blocked = await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(limited))
      .set("X-CSRF-Token", "token-errado")
      .set("X-Forwarded-For", "198.51.100.20")
      .send({ email: user.email, password: "senha-correta-demonstracao" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("LIMITE_EXCEDIDO");
    expect(JSON.stringify(blocked.body)).not.toContain("198.51.100.20");
  });

  it("usa cookie __Host- e Secure quando a API está em produção", async () => {
    const user = await createUser("BIDDER");
    const prod = await createApplication({
      connectionString,
      logger: false,
      now: () => now + 999_000,
      allowedOrigins: [ORIGIN],
      productionCookies: true,
    });
    try {
      await prod.init();
      const csrf = await request(prod.getHttpServer()).get("/api/auth/csrf");
      const jar = new Map<string, string>();
      remember(jar, csrf);
      expect(jar.has("__Host-csrf")).toBe(true);
      expect(headerList(csrf).join(";")).toMatch(/Secure/i);
      expect(headerList(csrf).join(";")).not.toMatch(/Domain=/i);
      const login = await request(prod.getHttpServer())
        .post("/api/auth/login")
        .set("Origin", ORIGIN)
        .set("Cookie", cookieHeader(jar))
        .set("X-CSRF-Token", csrf.body.csrfToken as string)
        .send({ email: user.email, password: "senha-correta-demonstracao" });
      remember(jar, login);
      expect(login.status).toBe(200);
      expect(jar.has("__Host-session")).toBe(true);
      expect(headerList(login).join(";")).toMatch(/__Host-session=/);
      expect(headerList(login).join(";")).toMatch(/Secure/i);
      expect(headerList(login).join(";")).not.toMatch(/Domain=/i);
      expect(JSON.stringify(login.body)).not.toContain(jar.get("__Host-session"));
    } finally {
      await prod.close();
    }
  });

  async function mutate(jar: Map<string, string>, method: "post", path: string, body: Record<string, string>, headers: Record<string, string> = {}) {
    const csrf = await issueCsrf(jar);
    const call = request(app.getHttpServer())[method](path)
      .set("Origin", ORIGIN)
      .set("Cookie", cookieHeader(jar))
      .set("X-CSRF-Token", csrf)
      .send(body);
    for (const [name, value] of Object.entries(headers)) call.set(name, value);
    return call;
  }
});

function headerList(response: Response): string[] {
  const raw = response.headers["set-cookie"];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}
