import { createHash } from "node:crypto";
import { ApiException } from "../auth/api.exception";
import { DatabaseRepository } from "../database/database.repository";
import { inspectImage, MediaStore } from "./image-importer";
import { CatalogError, MET_IMAGE_HOST, MetCatalogClient, type Budget, type MetObject } from "./met-catalog.client";

export const CATALOG_PAGE_SIZE = 8;
export const CATALOG_MAX_WINDOW = 10_000;
export const MET_PROVIDER = "met";
export const MET_LICENSE = "Domínio público (The Met Open Access, CC0)";
const EXTERNAL_ID = /^[1-9][0-9]{0,9}$/;
const DETAIL_CONCURRENCY = 4;

export type CatalogItemView = {
  externalId: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  credit: string;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  importable: boolean;
  reason: "LICENCA_RECUSADA" | "SEM_IMAGEM" | null;
};

export type CatalogPage = { items: CatalogItemView[]; page: number; pageSize: number; total: number; hasMore: boolean };

export type ImportedSnapshot = { id: string; mediaKey: string };

export class CatalogService {
  constructor(
    private readonly client: MetCatalogClient,
    private readonly database: DatabaseRepository,
    private readonly media: MediaStore,
  ) {}

  async search(query: string, page: number): Promise<CatalogPage> {
    const offset = (page - 1) * CATALOG_PAGE_SIZE;
    if (offset + CATALOG_PAGE_SIZE > CATALOG_MAX_WINDOW) throw new ApiException(400, "REQUISICAO_INVALIDA");
    const budget = this.client.newBudget();
    const found = await this.guard(() => this.client.search(query, offset, CATALOG_PAGE_SIZE, budget));
    const ids = found.objectIDs.slice(0, CATALOG_PAGE_SIZE);
    const details = await mapLimited(ids, DETAIL_CONCURRENCY, async (id) => {
      try {
        return await this.client.object(id, budget);
      } catch (error) {
        if (error instanceof CatalogError) return null;
        throw error;
      }
    });
    const items = details.filter((item): item is MetObject => item !== null).map(toView);
    const total = Math.min(found.total, CATALOG_MAX_WINDOW);
    return { items, page, pageSize: CATALOG_PAGE_SIZE, total, hasMore: offset + CATALOG_PAGE_SIZE < total };
  }

  async getItem(externalId: string): Promise<CatalogItemView> {
    const id = parseExternalId(externalId);
    const item = await this.guard(() => this.client.object(id, this.client.newBudget()));
    if (!item) throw new ApiException(404, "OBRA_NAO_ENCONTRADA");
    return toView(item);
  }

  async importItem(externalId: string): Promise<ImportedSnapshot> {
    const id = parseExternalId(externalId);
    const existing = await this.findSnapshot(String(id));
    if (existing) return existing;
    return this.guard(async () => {
      const budget: Budget = this.client.newBudget();
      const item = await this.client.object(id, budget);
      if (!item) throw new CatalogError("OBRA_NAO_ENCONTRADA");
      if (!item.isPublicDomain) throw new CatalogError("LICENCA_RECUSADA");
      const imageUrl = item.primaryImageSmall || item.primaryImage;
      if (!imageUrl) throw new CatalogError("IMAGEM_INVALIDA");
      const image = await this.client.image(imageUrl, budget);
      const inspected = inspectImage(image.bytes, image.contentType);
      const mediaKey = await this.media.save(image.bytes, inspected.ext);
      const attributes = {
        artist: item.artistDisplayName,
        artistBio: item.artistDisplayBio,
        date: item.objectDate,
        medium: item.medium,
        dimensions: item.dimensions,
        department: item.department,
        classification: item.classification,
        accessionNumber: item.accessionNumber,
        sourceUrl: sourcePage(item.objectURL),
        image: { width: inspected.width, height: inspected.height, type: inspected.mime },
      };
      await this.database.query(
        `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         ON CONFLICT (provider, external_id) DO NOTHING`,
        [MET_PROVIDER, String(id), item.title || "Sem título", JSON.stringify(attributes), item.creditLine || "The Metropolitan Museum of Art", MET_LICENSE, mediaKey],
      );
      const stored = await this.findSnapshot(String(id));
      if (!stored) throw new CatalogError("PROVEDOR_INDISPONIVEL");
      return stored;
    });
  }

  async removeOrphanMedia(olderThanMs: number, now: number): Promise<number> {
    const rows = await this.database.query<{ media_key: string }>(`SELECT media_key FROM catalog_item_snapshots`);
    return this.media.removeOrphans(new Set(rows.rows.map((row) => row.media_key)), olderThanMs, now);
  }

  /**
   * QA ALTA 1: o banco local é compartilhado entre checkouts, mas a mídia fica no <MEDIA_DIR> de cada um.
   * Se o snapshot aponta para um arquivo que não está aqui, baixa de novo a mesma imagem do Met e só aceita
   * se o sha256 bater com a chave gravada (o snapshot assinado não muda).
   */
  async restoreMedia(key: string): Promise<boolean> {
    const pending = this.restoring.get(key);
    if (pending) return pending;
    const work = this.fetchMissingMedia(key).finally(() => this.restoring.delete(key));
    this.restoring.set(key, work);
    return work;
  }

  private readonly restoring = new Map<string, Promise<boolean>>();

  private async fetchMissingMedia(key: string): Promise<boolean> {
    const result = await this.database.query<{ external_id: string }>(
      `SELECT external_id FROM catalog_item_snapshots WHERE provider = $1 AND media_key = $2 LIMIT 1`,
      [MET_PROVIDER, key],
    );
    const externalId = result.rows[0]?.external_id;
    if (!externalId) return false;
    try {
      const budget = this.client.newBudget();
      const item = await this.client.object(Number(externalId), budget);
      const imageUrl = item?.primaryImageSmall || item?.primaryImage;
      if (!imageUrl) return false;
      const image = await this.client.image(imageUrl, budget);
      const inspected = inspectImage(image.bytes, image.contentType);
      const expected = key.slice(0, key.lastIndexOf("."));
      if (createHash("sha256").update(image.bytes).digest("hex") !== expected || !key.endsWith(`.${inspected.ext}`)) return false;
      return (await this.media.save(image.bytes, inspected.ext)) === key;
    } catch {
      return false;
    }
  }

  /** D28: mídia normal da obra, usada pelo zoom quando não há versão em alta. */
  async snapshotMediaKey(externalId: string): Promise<string | null> {
    return (await this.findSnapshot(externalId))?.mediaKey ?? null;
  }

  private async findSnapshot(externalId: string): Promise<ImportedSnapshot | null> {
    const result = await this.database.query<{ id: string; media_key: string }>(
      `SELECT id, media_key FROM catalog_item_snapshots WHERE provider = $1 AND external_id = $2`,
      [MET_PROVIDER, externalId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, mediaKey: row.media_key } : null;
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof CatalogError) throw toApi(error);
      throw error;
    }
  }
}

export function parseExternalId(value: string): number {
  if (typeof value !== "string" || !EXTERNAL_ID.test(value)) throw new ApiException(400, "REQUISICAO_INVALIDA");
  return Number(value);
}

function toApi(error: CatalogError): ApiException {
  switch (error.code) {
    case "LICENCA_RECUSADA":
      return new ApiException(422, "LICENCA_RECUSADA");
    case "IMAGEM_INVALIDA":
      return new ApiException(422, "IMAGEM_INVALIDA");
    case "OBRA_NAO_ENCONTRADA":
      return new ApiException(404, "OBRA_NAO_ENCONTRADA");
    case "ORIGEM_RECUSADA":
      return new ApiException(502, "ORIGEM_RECUSADA");
    case "PROVEDOR_RESPOSTA_INVALIDA":
      return new ApiException(502, "PROVEDOR_RESPOSTA_INVALIDA");
    default:
      return new ApiException(503, "PROVEDOR_INDISPONIVEL");
  }
}

function toView(item: MetObject): CatalogItemView {
  const thumbnail = imageUrl(item.primaryImageSmall || item.primaryImage);
  const reason = !item.isPublicDomain ? "LICENCA_RECUSADA" : thumbnail ? null : "SEM_IMAGEM";
  return {
    externalId: String(item.objectID),
    title: item.title || "Sem título",
    artist: item.artistDisplayName,
    date: item.objectDate,
    medium: item.medium,
    credit: item.creditLine,
    sourceUrl: sourcePage(item.objectURL),
    thumbnailUrl: item.isPublicDomain ? thumbnail : null,
    importable: reason === null,
    reason,
  };
}

function imageUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === MET_IMAGE_HOST && url.port === "" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourcePage(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "www.metmuseum.org" && url.port === "" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}
