import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchLike, LookupLike } from "../../src/catalog/met-catalog.client";

const FIXTURES = join(__dirname, "..", "fixtures", "met");

export function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as Record<string, unknown>;
}

export function jpeg(width: number, height: number, padding = 32): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(padding, 0), Buffer.from([0xff, 0xd9])]);
}

export function png(width: number, height: number): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const dims = Buffer.alloc(8);
  dims.writeUInt32BE(width, 0);
  dims.writeUInt32BE(height, 4);
  return Buffer.concat([head, dims, Buffer.from([8, 2, 0, 0, 0, 0, 0, 0, 0])]);
}

export type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;

export class FakeMet {
  readonly calls: string[] = [];
  readonly routes = new Map<string, Route>();
  down = false;

  readonly fetch: FetchLike = async (raw, init) => {
    this.calls.push(raw);
    if (this.down) throw new TypeError("fetch failed");
    const url = new URL(raw);
    const key = `${url.hostname}${url.pathname}`;
    const route = this.routes.get(key);
    if (!route) return new Response("not found", { status: 404 });
    return route(url, init);
  };

  readonly lookup: LookupLike = async () => [{ address: "23.45.67.89", family: 4 }];

  object(record: Record<string, unknown>): void {
    this.routes.set(`collectionapi.metmuseum.org/public/collection/v1/objects/${String(record.objectID)}`, () => json(record));
  }

  image(path: string, bytes: Buffer, type = "image/jpeg"): void {
    this.routes.set(`images.metmuseum.org${path}`, () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": type, "content-length": String(bytes.length) } }));
  }

  search(body: Record<string, unknown>): void {
    this.routes.set("collectionapi.metmuseum.org/public/collection/v1.1/search", () => json(body));
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function metObject(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = fixture("object-437329.json");
  return {
    ...base,
    objectID: id,
    primaryImage: `https://images.metmuseum.org/CRDImages/test/original/${id}.jpg`,
    primaryImageSmall: `https://images.metmuseum.org/CRDImages/test/web-large/${id}.jpg`,
    ...overrides,
  };
}
