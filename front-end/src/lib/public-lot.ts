import { DEMO_MODE, demoLotMeta } from "../demo/seed";
import { apiProxyTarget } from "./api-proxy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Leitura no servidor só para metadados e 404. Título e artista são públicos; preço/prazo voláteis ficam fora do preview. */
export async function fetchPublicLotMeta(id: string): Promise<{ title: string; artist: string; imageUrl: string | null } | null> {
  if (!UUID.test(id)) return null;
  // Demo: lotes do seed têm metadados no servidor; os criados no navegador usam o genérico e a página decide.
  if (DEMO_MODE) return demoLotMeta(id);
  try {
    const response = await fetch(`${apiProxyTarget()}/api/lots/${id}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (response.status === 404) return null;
    if (!response.ok) return { title: "Lote", artist: "", imageUrl: null };
    const body = (await response.json()) as { title?: unknown; artist?: unknown; imageUrl?: unknown };
    return { title: typeof body.title === "string" ? body.title : "Lote", artist: typeof body.artist === "string" ? body.artist : "", imageUrl: typeof body.imageUrl === "string" && /^\/api\/media\/[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(body.imageUrl) ? body.imageUrl : null };
  } catch {
    return { title: "Lote", artist: "", imageUrl: null };
  }
}
