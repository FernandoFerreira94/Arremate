import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApplication } from "../../src/app";
import type { ErrorEvent } from "../../src/observability/error-event";
import { ErrorReporter } from "../../src/observability/error-reporter.service";
import { ORIGIN } from "../support/http-session";

describe("POST /api/client-errors (A6)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  let app: INestApplication;
  const sent: ErrorEvent[] = [];

  beforeAll(async () => {
    app = await createApplication({ connectionString, logger: false, allowedOrigins: [ORIGIN], auditKey: null, settlementIntervalMs: false, errorReporter: new ErrorReporter({ send: (event) => sent.push(event) }) });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = () => request(app.getHttpServer()).post("/api/client-errors");

  it("aceita relato válido da origem do site sem CSRF e saneia", async () => {
    const response = await post().set("Origin", ORIGIN).send({ name: "TypeError", message: "x is undefined para ana@x.com", url: `${ORIGIN}/lotes/1?token=abc`, digest: "123" });
    expect(response.status).toBe(202);
    expect(sent.at(-1)).toMatchObject({ source: "client", name: "TypeError", message: "x is undefined para [email]", url: `${ORIGIN}/lotes/1` });
  });

  it("recusa origem estranha (403), corpo inválido (400) e grande demais (413)", async () => {
    expect((await post().set("Origin", "http://evil.test").send({ message: "a" })).status).toBe(403);
    expect((await post().send({ message: "a" })).status).toBe(403);
    expect((await post().set("Origin", ORIGIN).send({ message: "a", cookie: "x" })).status).toBe(400);
    expect((await post().set("Origin", ORIGIN).send({ message: "a".repeat(9000) })).status).toBe(413);
  });

  it("limita por IP (429)", async () => {
    let last = 0;
    for (let i = 0; i < 25; i += 1) last = (await post().set("Origin", ORIGIN).send({ message: `erro ${i}` })).status;
    expect(last).toBe(429);
  });
});
