import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import request from "supertest";
import type { Response } from "supertest";

export const ORIGIN = "http://127.0.0.1:3300";
export const PASSWORD = "senha-correta-demonstracao";

export class Session {
  private readonly jar = new Map<string, string>();

  constructor(private readonly app: INestApplication) {}

  private remember(response: Response): void {
    const raw = response.headers["set-cookie"];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of list) {
      const pair = item.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value.length === 0 || /Max-Age=0/i.test(item)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  cookie(): string {
    return [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async csrf(): Promise<string> {
    const response = await request(this.app.getHttpServer()).get("/api/auth/csrf").set("Cookie", this.cookie());
    this.remember(response);
    return response.body.csrfToken as string;
  }

  async login(email: string): Promise<void> {
    const token = await this.csrf();
    const response = await request(this.app.getHttpServer())
      .post("/api/auth/login")
      .set("Cookie", this.cookie())
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", token)
      .send({ email, password: PASSWORD });
    if (response.status !== 200) throw new Error(`login falhou: ${response.status}`);
    this.remember(response);
  }

  get(path: string) {
    return request(this.app.getHttpServer()).get(path).set("Cookie", this.cookie());
  }

  async post(path: string, body: object, headers: Record<string, string> = {}) {
    const token = await this.csrf();
    const call = request(this.app.getHttpServer())
      .post(path)
      .set("Origin", ORIGIN)
      .set("Cookie", this.cookie())
      .set("X-CSRF-Token", token);
    for (const [name, value] of Object.entries(headers)) call.set(name, value);
    return call.send(body);
  }

  /** PUT/DELETE com CSRF e Origin (favoritos, D21). */
  async mutate(method: "put" | "delete", path: string) {
    const token = await this.csrf();
    return request(this.app.getHttpServer())[method](path).set("Origin", ORIGIN).set("Cookie", this.cookie()).set("X-CSRF-Token", token);
  }
}

export async function createUser(pool: Pool, prefix: string, role: "AUCTIONEER" | "BIDDER", passwordHash: string): Promise<{ id: string; email: string }> {
  const email = `${prefix}${randomUUID()}@example.com`;
  const inserted = await pool.query<{ id: string }>(`INSERT INTO users (email, role, password_hash) VALUES ($1, $2, $3) RETURNING id`, [email, role, passwordHash]);
  const id = inserted.rows[0]?.id;
  if (!id) throw new Error("usuário de teste não foi criado");
  return { id, email };
}
