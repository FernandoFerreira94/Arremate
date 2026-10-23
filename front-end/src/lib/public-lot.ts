import { apiProxyTarget } from "./api-proxy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Leitura no servidor só para metadados e 404. Título e artista são públicos; preço/prazo voláteis ficam fora do preview. */
export async function fetchPublicLotMeta(id: string): Promise<{ title: string; artist: string } | null> {
  if (!UUID.test(id)) return null;
  try {
    const response = await fetch(`${apiProxyTarget()}/api/lots/${id}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (response.status === 404) return null;
    if (!response.ok) return { title: "Lote", artist: "" };
    const body = (await response.json()) as { title?: unknown; artist?: unknown };
    return { title: typeof body.title === "string" ? body.title : "Lote", artist: typeof body.artist === "string" ? body.artist : "" };
  } catch {
    return { title: "Lote", artist: "" };
  }
}
