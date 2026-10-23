import { mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectImage, MediaStore } from "../src/catalog/image-importer";
import { CatalogError } from "../src/catalog/met-catalog.client";
import { jpeg, png } from "./support/met-fake";

function code(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof CatalogError) return error.code;
    throw error;
  }
  return "OK";
}

describe("inspectImage", () => {
  it("aceita JPEG e PNG com tipo e assinatura coerentes e lê dimensões", () => {
    expect(inspectImage(jpeg(640, 480), "image/jpeg")).toMatchObject({ ext: "jpg", width: 640, height: 480 });
    expect(inspectImage(png(300, 200), "image/png; charset=binary")).toMatchObject({ ext: "png", width: 300, height: 200 });
  });

  it("aceita WebP VP8X", () => {
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0, "latin1");
    webp.write("WEBP", 8, "latin1");
    webp.write("VP8X", 12, "latin1");
    webp.writeUIntLE(799, 24, 3);
    webp.writeUIntLE(599, 27, 3);
    expect(inspectImage(webp, "image/webp")).toMatchObject({ ext: "webp", width: 800, height: 600 });
  });

  it("recusa MIME fora da lista, assinatura trocada e SVG", () => {
    expect(code(() => inspectImage(jpeg(10, 10), "image/gif"))).toBe("IMAGEM_INVALIDA");
    expect(code(() => inspectImage(png(10, 10), "image/jpeg"))).toBe("IMAGEM_INVALIDA");
    expect(code(() => inspectImage(Buffer.from("<svg onload=alert(1)>"), "image/svg+xml"))).toBe("IMAGEM_INVALIDA");
    expect(code(() => inspectImage(Buffer.from("<html>"), "image/png"))).toBe("IMAGEM_INVALIDA");
  });

  it("recusa mais de 20 MP, dimensão zero e vazio", () => {
    expect(code(() => inspectImage(jpeg(5000, 4001), "image/jpeg"))).toBe("IMAGEM_INVALIDA");
    expect(code(() => inspectImage(jpeg(5000, 4000), "image/jpeg"))).toBe("OK");
    expect(code(() => inspectImage(png(0, 10), "image/png"))).toBe("IMAGEM_INVALIDA");
    expect(code(() => inspectImage(Buffer.alloc(0), "image/jpeg"))).toBe("IMAGEM_INVALIDA");
  });
});

describe("MediaStore", () => {
  let root = "";
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "media-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("grava por hash, de forma idempotente, sem temporários", async () => {
    const store = new MediaStore(root);
    const bytes = jpeg(10, 10);
    const [a, b] = await Promise.all([store.save(bytes, "jpg"), store.save(bytes, "jpg")]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}\.jpg$/);
    expect(await readdir(root)).toEqual([a]);
  });

  it("só resolve chaves geradas pelo servidor", () => {
    const store = new MediaStore(root);
    expect(store.pathFor("../../.env")).toBeNull();
    expect(store.pathFor("a".repeat(64) + ".svg")).toBeNull();
    expect(store.pathFor("a".repeat(64) + ".jpg")).toBe(join(root, "a".repeat(64) + ".jpg"));
    expect(MediaStore.typeFor("a".repeat(64) + ".png")).toBe("image/png");
  });

  it("remove órfãos antigos e preserva referenciados e recentes", async () => {
    const store = new MediaStore(root);
    const kept = await store.save(jpeg(10, 10), "jpg");
    const orphan = await store.save(jpeg(11, 11), "jpg");
    const recent = await store.save(jpeg(12, 12), "jpg");
    const old = new Date(Date.now() - 2 * 3_600_000);
    await utimes(join(root, kept), old, old);
    await utimes(join(root, orphan), old, old);
    expect(await store.removeOrphans(new Set([kept]), 3_600_000, Date.now())).toBe(1);
    expect((await readdir(root)).sort()).toEqual([kept, recent].sort());
  });
});
