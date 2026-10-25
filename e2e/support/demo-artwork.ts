import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { inspectImage, MediaStore } from "../../back-end/src/catalog/image-importer";
import type { MetObject } from "../../back-end/src/catalog/met-catalog.client";
import { MET_IDS } from "./api-session";
import { e2eDatabaseUrl } from "./e2e-env";

/** Reconstrói apenas os snapshots de teste e a mídia CC0 antes de publicar lotes; nunca altera lote já assinado. */
export async function ensureE2eArtwork(): Promise<void> {
  const pool = new Pool({ connectionString: e2eDatabaseUrl(process.env.TEST_DATABASE_URL), max: 1 });
  const media = new MediaStore(resolve(__dirname, "../../.data/media-e2e"));
  try {
    for (const id of MET_IDS) {
      const folder = resolve(__dirname, "../../docs/design/pranchas/assets/obras");
      const item: MetObject = JSON.parse(await readFile(resolve(folder, id + ".json"), "utf8"));
      if (item.objectID !== Number(id) || item.isPublicDomain !== true) throw new Error("Fixture do Met sem licença/ID válidos");
      const bytes = await readFile(resolve(folder, id + ".jpg"));
      const image = inspectImage(bytes, "image/jpeg");
      const mediaKey = await media.save(bytes, image.ext);
      const attributes = { artist: item.artistDisplayName, artistBio: item.artistDisplayBio, date: item.objectDate, medium: item.medium, dimensions: item.dimensions, department: item.department, classification: item.classification, accessionNumber: item.accessionNumber, sourceUrl: item.objectURL, image: { width: image.width, height: image.height, type: image.mime } };
      await pool.query(
        `INSERT INTO catalog_item_snapshots (provider, external_id, title, attributes, credit, license, media_key)
         VALUES ('met', $1, $2, $3::jsonb, $4, 'Domínio público (The Met Open Access, CC0)', $5)
         ON CONFLICT (provider, external_id) DO UPDATE SET title=EXCLUDED.title, attributes=EXCLUDED.attributes, credit=EXCLUDED.credit, license=EXCLUDED.license, media_key=EXCLUDED.media_key`,
        [id, item.title, JSON.stringify(attributes), item.creditLine, mediaKey],
      );
    }
  } finally { await pool.end(); }
}
