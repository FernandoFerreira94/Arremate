import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MET_API_HOST = "collectionapi.metmuseum.org";
export const MET_IMAGE_HOST = "images.metmuseum.org";
const ALLOWED_HOSTS: ReadonlySet<string> = new Set([MET_API_HOST, MET_IMAGE_HOST]);
const API_BASE = `https://${MET_API_HOST}/public/collection`;
export const CALL_TIMEOUT_MS = 5_000;
export const BUDGET_MS = 10_000;
const MAX_JSON_BYTES = 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 500;

export type CatalogErrorCode =
  | "PROVEDOR_INDISPONIVEL"
  | "PROVEDOR_RESPOSTA_INVALIDA"
  | "ORIGEM_RECUSADA"
  | "IMAGEM_INVALIDA"
  | "LICENCA_RECUSADA"
  | "OBRA_NAO_ENCONTRADA";

export class CatalogError extends Error {
  constructor(readonly code: CatalogErrorCode) {
    super(code);
    this.name = "CatalogError";
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type LookupLike = (host: string) => Promise<readonly { address: string; family: number }[]>;

export type ClientDeps = {
  fetch?: FetchLike;
  lookup?: LookupLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type Budget = { deadline: number };

export type MetObject = {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  title: string;
  artistDisplayName: string;
  artistDisplayBio: string;
  objectDate: string;
  medium: string;
  dimensions: string;
  department: string;
  classification: string;
  accessionNumber: string;
  creditLine: string;
  objectURL: string;
};

export type FetchedImage = { bytes: Buffer; contentType: string };

export class MetCatalogClient {
  private readonly fetchImpl: FetchLike;
  private readonly lookup: LookupLike;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: ClientDeps = {}) {
    this.fetchImpl = deps.fetch ?? ((url, init) => fetch(url, init));
    this.lookup = deps.lookup ?? ((host) => dnsLookup(host, { all: true, verbatim: true }));
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  newBudget(): Budget {
    return { deadline: this.now() + BUDGET_MS };
  }

  async search(query: string, offset: number, limit: number, budget: Budget): Promise<{ total: number; objectIDs: number[] }> {
    const params = new URLSearchParams({ q: query, hasImages: "true", offset: String(offset), limit: String(limit) });
    const result = await this.request(`${API_BASE}/v1.1/search?${params.toString()}`, budget, MAX_JSON_BYTES, "application/json");
    if (result.status !== 200) throw new CatalogError("PROVEDOR_INDISPONIVEL");
    return parseSearch(parseJson(result.body));
  }

  async object(id: number, budget: Budget): Promise<MetObject | null> {
    const result = await this.request(`${API_BASE}/v1/objects/${id}`, budget, MAX_JSON_BYTES, "application/json");
    if (result.status === 404) return null;
    if (result.status !== 200) throw new CatalogError("PROVEDOR_INDISPONIVEL");
    const parsed = parseObject(parseJson(result.body));
    if (parsed.objectID !== id) throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
    return parsed;
  }

  async image(url: string, budget: Budget): Promise<FetchedImage> {
    const target = safeUrl(url);
    if (target.hostname !== MET_IMAGE_HOST) throw new CatalogError("ORIGEM_RECUSADA");
    const result = await this.request(target.toString(), budget, MAX_IMAGE_BYTES, "image/jpeg, image/png, image/webp", "IMAGEM_INVALIDA");
    if (result.status !== 200) throw new CatalogError("PROVEDOR_INDISPONIVEL");
    return { bytes: result.body, contentType: result.contentType };
  }

  private async request(
    url: string,
    budget: Budget,
    maxBytes: number,
    accept: string,
    oversize: CatalogErrorCode = "PROVEDOR_RESPOSTA_INVALIDA",
  ): Promise<{ status: number; contentType: string; body: Buffer }> {
    const target = safeUrl(url);
    await this.assertPublicHost(target.hostname);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remaining = budget.deadline - this.now();
      if (remaining <= 0) throw new CatalogError("PROVEDOR_INDISPONIVEL");
      let response: Response;
      try {
        response = await this.fetchImpl(target.toString(), {
          method: "GET",
          redirect: "manual",
          headers: { accept },
          signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, remaining)),
        });
      } catch {
        if (attempt === 0 && budget.deadline - this.now() > 0) continue;
        throw new CatalogError("PROVEDOR_INDISPONIVEL");
      }
      if (response.status >= 300 && response.status < 400) {
        await discard(response);
        throw new CatalogError("ORIGEM_RECUSADA");
      }
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        await discard(response);
        const wait = retryAfterMs(response.headers.get("retry-after"), this.now());
        if (attempt === 0 && wait < budget.deadline - this.now()) {
          await this.sleep(wait);
          continue;
        }
        throw new CatalogError("PROVEDOR_INDISPONIVEL");
      }
      if (response.status === 404) {
        await discard(response);
        return { status: 404, contentType: "", body: Buffer.alloc(0) };
      }
      if (response.status !== 200) {
        await discard(response);
        throw new CatalogError("PROVEDOR_INDISPONIVEL");
      }
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
      const body = await readLimited(response, maxBytes, oversize);
      return { status: 200, contentType, body };
    }
    throw new CatalogError("PROVEDOR_INDISPONIVEL");
  }

  private async assertPublicHost(host: string): Promise<void> {
    let addresses: readonly { address: string }[];
    try {
      addresses = await this.lookup(host);
    } catch {
      throw new CatalogError("PROVEDOR_INDISPONIVEL");
    }
    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new CatalogError("ORIGEM_RECUSADA");
    }
  }
}

export function safeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CatalogError("ORIGEM_RECUSADA");
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") throw new CatalogError("ORIGEM_RECUSADA");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new CatalogError("ORIGEM_RECUSADA");
  return url;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return privateV4(address);
  if (version !== 6) return true;
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return privateV4(mapped[1]);
  if (lower === "::" || lower === "::1") return true;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  return false;
}

function privateV4(address: string): boolean {
  const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

export function retryAfterMs(header: string | null, now: number): number {
  if (!header) return 1_000;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return 1_000;
  return Math.max(0, date - now);
}

async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // corpo descartado
  }
}

async function readLimited(response: Response, maxBytes: number, oversize: CatalogErrorCode): Promise<Buffer> {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await discard(response);
    throw new CatalogError(oversize);
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new CatalogError(oversize);
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError("PROVEDOR_INDISPONIVEL");
  }
  return Buffer.concat(chunks);
}

function parseJson(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  }
}

function parseSearch(value: unknown): { total: number; objectIDs: number[] } {
  if (typeof value !== "object" || value === null) throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  const record = value as Record<string, unknown>;
  const total = record.total;
  const ids = record.objectIDs ?? [];
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number" || !Number.isInteger(id) || id <= 0)) {
    throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  }
  return { total, objectIDs: ids as number[] };
}

function parseObject(value: unknown): MetObject {
  if (typeof value !== "object" || value === null) throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  const record = value as Record<string, unknown>;
  const id = record.objectID;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  if (typeof record.isPublicDomain !== "boolean") throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  for (const field of ["primaryImage", "primaryImageSmall", "title", "creditLine", "objectURL"]) {
    if (typeof record[field] !== "string") throw new CatalogError("PROVEDOR_RESPOSTA_INVALIDA");
  }
  return {
    objectID: id,
    isPublicDomain: record.isPublicDomain,
    primaryImage: text(record.primaryImage, 2_000),
    primaryImageSmall: text(record.primaryImageSmall, 2_000),
    title: text(record.title),
    artistDisplayName: text(record.artistDisplayName),
    artistDisplayBio: text(record.artistDisplayBio),
    objectDate: text(record.objectDate),
    medium: text(record.medium),
    dimensions: text(record.dimensions),
    department: text(record.department),
    classification: text(record.classification),
    accessionNumber: text(record.accessionNumber),
    creditLine: text(record.creditLine),
    objectURL: text(record.objectURL, 2_000),
  };
}

function text(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  let clean = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) continue;
    clean += char;
  }
  return clean.trim().slice(0, max);
}
