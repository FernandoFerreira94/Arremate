import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApplication } from "../src/app";
import { DatabaseRepository } from "../src/database/database.repository";
import { Pool } from "pg";
import { Logger } from "@nestjs/common";

describe("Health e erros seguros", () => {
  let app: INestApplication;
  const ping = jest.fn<Promise<void>, []>();

  beforeAll(async () => {
    app = await createApplication({ database: { ping }, logger: false });
    await app.init();
  });
  beforeEach(() => { ping.mockReset(); ping.mockResolvedValue(undefined); });
  afterAll(async () => { await app?.close(); });

  it("liveness funciona sem consultar o banco", async () => {
    await request(app.getHttpServer()).get("/api/health/live").expect(200, { status: "ok" });
    expect(ping).not.toHaveBeenCalled();
  });
  it("readiness confirma uma consulta real do repository", async () => {
    await request(app.getHttpServer()).get("/api/health/ready").expect(200, { status: "ok", database: "up" });
    expect(ping).toHaveBeenCalledTimes(1);
    expect(app.get(DatabaseRepository)).toBeDefined();
  });
  it("falha de banco retorna 503 sem expor dados internos", async () => {
    ping.mockRejectedValueOnce(new Error("postgresql://private.invalid/internal-secret"));
    const response = await request(app.getHttpServer()).get("/api/health/ready").expect(503);
    expect(response.body).toMatchObject({ statusCode: 503, code: "BANCO_INDISPONIVEL", message: "Banco de dados temporariamente indisponível." });
    expect(JSON.stringify(response.body)).not.toContain("internal-secret");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await request(app.getHttpServer()).get("/api/health/live").expect(200);
    await request(app.getHttpServer()).get("/api/health/ready").expect(200);
  });
  it("rota inexistente tem erro pt-BR sem stack", async () => {
    const response = await request(app.getHttpServer()).get("/api/nao-existe").expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, message: "Recurso não encontrado." });
    expect(response.body).not.toHaveProperty("stack");
  });

  it("erro em conexão ociosa não derruba processo nem expõe dados internos", async () => {
    const on = jest.spyOn(Pool.prototype, "on");
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const repository = new DatabaseRepository("postgresql://invalid.local/test");
    try {
      const pool = on.mock.instances[0];
      expect(pool).toBeDefined();
      expect(() => pool.emit("error", new Error("sensitive-connection-details"))).not.toThrow();
      expect(warn).toHaveBeenCalledWith("Conexão ociosa do banco foi encerrada; próximas consultas tentarão reconectar.");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-connection-details");
    } finally {
      await repository.onModuleDestroy();
      on.mockRestore();
      warn.mockRestore();
    }
  });
});
