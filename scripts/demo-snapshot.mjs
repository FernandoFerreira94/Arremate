// Gera os dados estáticos do modo demo (NEXT_PUBLIC_DEMO_MODE=1): metadados das 36 obras do seed
// (back-end/prisma/seed-catalog.ts) lidos na API pública do Met e a imagem de cada uma em front-end/public/demo/obras.
// Uso: node scripts/demo-snapshot.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const source = await readFile(new URL("back-end/prisma/seed-catalog.ts", root), "utf8");
const entries = [...source.matchAll(/\{ lot: "(\d{4})", externalId: "(\d+)", initial: (\d+), estimate: \[(\d+), (\d+)\], state: "(\w+)"(?:, offsetMs: ([^,]+?))?(?:, bids: \{ n: (\d+), final: (\d+), winner: (\d+), with: \[([\d, ]+)\] \})?, condition: (\w+) \}/g)];
if (entries.length !== 36) throw new Error(`esperava 36 obras, achei ${entries.length}`);
const conditions = Object.fromEntries([...source.matchAll(/^const (PAINT|PANEL|PRINT|WOOD|LACQUER) = "([^"]+)";/gm)].map((m) => [m[1], m[2]]));
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const offset = (expr) => (expr ? Function("MIN", "HOUR", "DAY", `return ${expr};`)(MIN, HOUR, DAY) : null);

const imgDir = new URL("front-end/public/demo/obras/", root);
await mkdir(imgDir, { recursive: true });
const out = [];
for (const m of entries) {
  const [, lot, externalId, initial, low, high, state, off, n, final, winner, withs, condition] = m;
  const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${externalId}`);
  if (!res.ok) throw new Error(`Met ${externalId}: ${res.status}`);
  const o = await res.json();
  const file = new URL(`${externalId}.jpg`, imgDir);
  if (!existsSync(file)) {
    const img = await fetch(o.primaryImageSmall || o.primaryImage);
    if (!img.ok) throw new Error(`imagem ${externalId}: ${img.status}`);
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
  }
  out.push({
    lot, externalId, initial: Number(initial), estimate: [Number(low), Number(high)], state, offsetMs: offset(off),
    bids: n ? { n: Number(n), final: Number(final), winner: Number(winner), with: withs.split(",").map((s) => Number(s.trim())) } : null,
    condition: conditions[condition],
    title: o.title, artist: o.artistDisplayName || "Artista desconhecido", artistBio: o.artistDisplayBio || "", date: o.objectDate || "",
    medium: o.medium || "", dimensions: o.dimensions || "", credit: o.creditLine || "The Metropolitan Museum of Art",
    sourceUrl: o.objectURL || null,
  });
  process.stdout.write(`${lot} ${externalId} ok\n`);
}
await writeFile(new URL("front-end/src/demo/artworks.json", root), `${JSON.stringify(out, null, 1)}\n`);
