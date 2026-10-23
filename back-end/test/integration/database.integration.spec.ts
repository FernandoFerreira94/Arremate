import "reflect-metadata";
import request from "supertest";
import { Pool } from "pg";
import { createApplication } from "../../src/app";

describe("PostgreSQL isolado de teste", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 2 });
  afterAll(async () => { await pool.end(); });

  it("usa banco de teste e usuário sem privilégios administrativos", async () => {
    const result = await pool.query<{ database: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; can_create: boolean }>("SELECT current_database() AS database, rolsuper, rolcreatedb, rolcreaterole, has_schema_privilege(current_user, 'public', 'CREATE') AS can_create FROM pg_roles WHERE rolname = current_user");
    expect(result.rows[0]).toEqual({ database: "casadeleilao_test", rolsuper: false, rolcreatedb: false, rolcreaterole: false, can_create: false });
  });
  it("endpoint readiness usa conexão PostgreSQL real", async () => {
    const app = await createApplication({ connectionString, logger: false });
    try {
      await app.init();
      await request(app.getHttpServer()).get("/api/health/ready").expect(200, { status: "ok", database: "up" });
    } finally { await app.close(); }
  });
});
