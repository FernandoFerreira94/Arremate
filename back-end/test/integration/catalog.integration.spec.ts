import "reflect-metadata";
import { mkdir, mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createApplication } from "../../src/app";
import { hashPassword } from "../../src/auth/password-hash";
import { CatalogService } from "../../src/catalog/catalog.service";
import { createUser, PASSWORD, Session } from "../support/http-session";
import { FakeMet, fixture, jpeg, metObject } from "../support/met-fake";

const PREFIX = "tarefa4-catalogo-";

describe("catálogo do Met", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000, max: 4 });
  const fake = new FakeMet();
  const externalIds: string[] = [];
  let app: INestApplication;
  let mediaDir = "";
  let passwordHash = "";
  let now = 1_800_000_000_000;

  function freshId(): number {
    const id = 7_000_000_000 + Math.floor(Math.random() * 999_999_999);
    externalIds.push(String(id));
    return id;
  }

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    mediaDir = await mkdtemp(join(tmpdir(), "catalog-media-"));
    app = await createApplication({
      connectionString,
      logger: false,
      now: () => now,
      allowedOrigins: ["http://127.0.0.1:3300"],
      catalogFetch: fake.fetch,
      catalogLookup: fake.lookup,
      mediaDir,
      auditKey: null,
    });
    await app.init();
  });

  beforeEach(() => {
    now += 120_000;
    fake.down = false;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM catalog_item_snapshots WHERE provider = 'met' AND external_id = ANY($1::text[])`, [externalIds]);
    await pool.query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIX}%`]);
    await app?.close();
    await pool.end();
    await rm(mediaDir, { recursive: true, force: true });
  });

  async function auctioneer(): Promise<Session> {
    const user = await createUser(pool, PREFIX, "AUCTIONEER", passwordHash);
    const session = new Session(app);
    await session.login(user.email);
    return session;
  }

  it("busca só para leiloeiro, com 8 itens por página e licença sinalizada", async () => {
    const ids = (fixture("search-sunflowers.json").objectIDs as number[]).slice();
    fake.search({ total: 153, objectIDs: ids });
    for (const id of ids) fake.object(metObject(id, { isPublicDomain: id !== ids[1], title: `Obra ${id}` }));
    fake.object(fixture("object-436524.json"));
    const seller = await auctioneer();
    const response = await seller.get("/api/catalog/search?q=sunflowers&page=1");
    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(8);
    expect(response.body.total).toBe(153);
    expect(response.body.hasMore).toBe(true);
    expect(response.body.items).toHaveLength(8);
    const sunflowers = response.body.items.find((item: { externalId: string }) => item.externalId === "436524");
    expect(sunflowers).toMatchObject({ title: "Sunflowers", importable: true, reason: null });
    expect(sunflowers.thumbnailUrl).toMatch(/^https:\/\/images\.metmuseum\.org\//);
    const closed = response.body.items.find((item: { externalId: string }) => item.externalId === String(ids[1]));
    expect(closed).toMatchObject({ importable: false, reason: "LICENCA_RECUSADA", thumbnailUrl: null });

    const bidder = new Session(app);
    const user = await createUser(pool, PREFIX, "BIDDER", passwordHash);
    await bidder.login(user.email);
    expect((await bidder.get("/api/catalog/search?q=sunflowers")).status).toBe(403);
    expect((await request(app.getHttpServer()).get("/api/catalog/search?q=sunflowers")).status).toBe(401);
  });

  it("valida a consulta e a janela de paginação", async () => {
    const seller = await auctioneer();
    expect((await seller.get("/api/catalog/search?q=")).status).toBe(400);
    expect((await seller.get("/api/catalog/search?q=a&page=0")).status).toBe(400);
    expect((await seller.get("/api/catalog/search?q=a&page=1251")).status).toBe(400);
    expect((await seller.get(`/api/catalog/search?q=${"a".repeat(101)}`)).status).toBe(400);
    expect((await seller.get("/api/catalog/items/abc")).status).toBe(400);
  });

  it("responde 503 claro quando o provedor cai", async () => {
    fake.down = true;
    const seller = await auctioneer();
    const response = await seller.get("/api/catalog/search?q=sunflowers");
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("PROVEDOR_INDISPONIVEL");
  });

  it("limita a busca a 30 por minuto por ator", async () => {
    fake.search({ total: 0, objectIDs: null });
    const seller = await auctioneer();
    for (let i = 0; i < 30; i += 1) expect((await seller.get("/api/catalog/search?q=x")).status).toBe(200);
    const limited = await seller.get("/api/catalog/search?q=x");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("LIMITE_EXCEDIDO");
  });

  it("importa uma vez sob concorrência, guarda título como texto e serve a mídia sem o provedor", async () => {
    const id = freshId();
    const title = `<script>alert("x")</script> Retrato`;
    fake.object(metObject(id, { title }));
    fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(800, 600));
    const catalog = app.get(CatalogService);
    const [a, b, c] = await Promise.all([catalog.importItem(String(id)), catalog.importItem(String(id)), catalog.importItem(String(id))]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    const rows = await pool.query<{ title: string; media_key: string; license: string; attributes: { image: { width: number } } }>(
      `SELECT title, media_key, license, attributes FROM catalog_item_snapshots WHERE provider = 'met' AND external_id = $1`,
      [String(id)],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.title).toBe(title);
    expect(rows.rows[0]?.media_key).toMatch(/^[a-f0-9]{64}\.jpg$/);
    expect(rows.rows[0]?.attributes.image.width).toBe(800);

    fake.down = true;
    await expect(catalog.importItem(String(id))).resolves.toEqual(a);
    const media = await request(app.getHttpServer()).get(`/api/media/${a.mediaKey}`);
    expect(media.status).toBe(200);
    expect(media.headers["content-type"]).toBe("image/jpeg");
    expect(media.headers["x-content-type-options"]).toBe("nosniff");
    expect(media.headers["cache-control"]).toContain("immutable");
    expect(Buffer.compare(media.body as Buffer, jpeg(800, 600))).toBe(0);
    expect((await request(app.getHttpServer()).get("/api/media/..%2F..%2F.env")).status).toBe(404);
    expect((await request(app.getHttpServer()).get(`/api/media/${"0".repeat(64)}.jpg`)).status).toBe(404);
  });

  it("D28: zoom entrega a versão em alta quando existe e cai na mídia normal da obra quando não", async () => {
    const id = freshId();
    fake.object(metObject(id));
    fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(600, 400));
    const snapshot = await app.get(CatalogService).importItem(String(id));
    const server = app.getHttpServer();

    const fallback = await request(server).get(`/api/media/zoom/${id}`);
    expect(fallback.status).toBe(200);
    expect(fallback.headers["content-type"]).toBe("image/jpeg");
    expect(fallback.headers["cache-control"]).not.toContain("immutable");
    expect(Buffer.compare(fallback.body as Buffer, jpeg(600, 400))).toBe(0);

    await mkdir(join(mediaDir, "zoom"), { recursive: true });
    await writeFile(join(mediaDir, "zoom", `${id}.jpg`), jpeg(2500, 1666));
    const hires = await request(server).get(`/api/media/zoom/${id}`);
    expect(hires.status).toBe(200);
    expect(Buffer.compare(hires.body as Buffer, jpeg(2500, 1666))).toBe(0);
    expect(snapshot.mediaKey).toMatch(/\.jpg$/);

    expect((await request(server).get("/api/media/zoom/..%2F..%2F.env")).status).toBe(404);
    expect((await request(server).get("/api/media/zoom/999999999")).status).toBe(404);
  });

  it("QA ALTA 1: mídia do snapshot ausente neste checkout é restaurada do Met só se o sha256 bater", async () => {
    const id = freshId();
    fake.object(metObject(id));
    fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(640, 480));
    const { mediaKey } = await app.get(CatalogService).importItem(String(id));
    const server = app.getHttpServer();
    await unlink(join(mediaDir, mediaKey));

    const restored = await request(server).get(`/api/media/${mediaKey}`);
    expect(restored.status).toBe(200);
    expect(Buffer.compare(restored.body as Buffer, jpeg(640, 480))).toBe(0);
    expect((await stat(join(mediaDir, mediaKey))).isFile()).toBe(true);

    await unlink(join(mediaDir, mediaKey));
    fake.image(`/CRDImages/test/web-large/${id}.jpg`, jpeg(641, 480));
    expect((await request(server).get(`/api/media/${mediaKey}`)).status).toBe(404);
    fake.down = true;
    expect((await request(server).get(`/api/media/${mediaKey}`)).status).toBe(404);
    expect((await request(server).get(`/api/media/${"0".repeat(64)}.jpg`)).status).toBe(404);
  });

  it("recusa licença não pública, imagem inválida e origem fora da allowlist sem gravar", async () => {
    const catalog = app.get(CatalogService);
    const closed = freshId();
    fake.object(metObject(closed, { isPublicDomain: false }));
    await expect(catalog.importItem(String(closed))).rejects.toMatchObject({ response: { code: "LICENCA_RECUSADA" } });

    const fakeImage = freshId();
    fake.object(metObject(fakeImage));
    fake.image(`/CRDImages/test/web-large/${fakeImage}.jpg`, Buffer.from("<svg onload=alert(1)>"), "image/jpeg");
    await expect(catalog.importItem(String(fakeImage))).rejects.toMatchObject({ response: { code: "IMAGEM_INVALIDA" } });

    const foreign = freshId();
    fake.object(metObject(foreign, { primaryImageSmall: "https://evil.example/x.jpg", primaryImage: "" }));
    await expect(catalog.importItem(String(foreign))).rejects.toMatchObject({ response: { code: "ORIGEM_RECUSADA" } });

    const stored = await pool.query(`SELECT 1 FROM catalog_item_snapshots WHERE provider = 'met' AND external_id = ANY($1::text[])`, [[String(closed), String(fakeImage), String(foreign)]]);
    expect(stored.rowCount).toBe(0);
  });
});
