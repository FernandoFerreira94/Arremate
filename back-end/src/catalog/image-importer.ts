import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CatalogError, MAX_IMAGE_BYTES } from "./met-catalog.client";

export const MAX_PIXELS = 20_000_000;
export type ImageExt = "jpg" | "png" | "webp";
export const MEDIA_TYPES: Record<ImageExt, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MEDIA_KEY = /^[a-f0-9]{64}\.(jpg|png|webp)$/;

export type InspectedImage = { ext: ImageExt; mime: string; width: number; height: number };

export function inspectImage(bytes: Buffer, declaredType: string): InspectedImage {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new CatalogError("IMAGEM_INVALIDA");
  const declared = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = (Object.keys(MEDIA_TYPES) as ImageExt[]).find((key) => MEDIA_TYPES[key] === declared);
  if (!ext) throw new CatalogError("IMAGEM_INVALIDA");
  const size = ext === "jpg" ? jpegSize(bytes) : ext === "png" ? pngSize(bytes) : webpSize(bytes);
  if (!size || size.width <= 0 || size.height <= 0 || size.width * size.height > MAX_PIXELS) throw new CatalogError("IMAGEM_INVALIDA");
  return { ext, mime: MEDIA_TYPES[ext], ...size };
}

type Size = { width: number; height: number } | null;

function jpegSize(bytes: Buffer): Size {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    let marker = bytes[offset + 1] ?? 0;
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1] ?? 0;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (offset + 9 > bytes.length) return null;
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(bytes: Buffer): Size {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function webpSize(bytes: Buffer): Size {
  if (bytes.length < 30 || bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunk = bytes.toString("latin1", 12, 16);
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  return null;
}

export class MediaStore {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async save(bytes: Buffer, ext: ImageExt): Promise<string> {
    const key = `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
    await mkdir(this.root, { recursive: true });
    const target = join(this.root, key);
    if (await exists(target)) return key;
    const temporary = join(this.root, `${key}.${randomUUID()}.tmp`);
    await writeFile(temporary, bytes, { flag: "wx" });
    try {
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      if (!(await exists(target))) throw error;
    }
    return key;
  }

  pathFor(key: string): string | null {
    if (!MEDIA_KEY.test(key)) return null;
    return join(this.root, key);
  }

  static typeFor(key: string): string | null {
    const match = MEDIA_KEY.exec(key);
    return match?.[1] ? MEDIA_TYPES[match[1] as ImageExt] : null;
  }

  async removeOrphans(referenced: ReadonlySet<string>, olderThanMs: number, now: number): Promise<number> {
    let names: string[];
    try {
      names = await readdir(this.root);
    } catch {
      return 0;
    }
    let removed = 0;
    for (const name of names) {
      if (referenced.has(name)) continue;
      if (!MEDIA_KEY.test(name) && !name.endsWith(".tmp")) continue;
      const path = join(this.root, name);
      const info = await stat(path).catch(() => null);
      if (!info || now - info.mtimeMs < olderThanMs) continue;
      await unlink(path).catch(() => undefined);
      removed += 1;
    }
    return removed;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
