/**
 * Ponte do modo demo: apiFetch e useLotChannel chamam isto em vez da rede. O estado fica no localStorage
 * deste navegador; outras abas recebem o aviso de lote alterado pelo BroadcastChannel.
 */
import { ApiError } from "../lib/api-error";
import { DEMO_STATE_VERSION, DemoFailure, botBid, createSeedState, handle, lotState, restoreLot, sweep, tamperLot, type CatalogCacheItem, type DemoState } from "./engine";

const STORAGE_KEY = "arremate.demo.v1";
/** A semente se renova depois de 12 h: os lotes "encerrando" voltam a ter minutos de prazo. */
const SEED_TTL_MS = 12 * 60 * 60 * 1000;
const EVENT = "arremate-demo:lot";
const BOT_MS = 30_000;
const BOTS = ["u-licitante2", "u-licitante3", "u-licitante4", "u-licitante5"];

let memory: DemoState | null = null;
let channel: BroadcastChannel | null = null;

function load(now: number): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === DEMO_STATE_VERSION && now - parsed.seededAt < SEED_TTL_MS) return parsed;
    }
  } catch {
    /* Storage bloqueado: segue só em memória. */
  }
  if (memory && now - memory.seededAt < SEED_TTL_MS) return memory;
  return createSeedState(now);
}

function save(state: DemoState) {
  memory = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Sem storage a demo continua nesta aba. */
  }
}

function emit(lotIds: string[], state: DemoState) {
  for (const lotId of new Set(lotIds)) {
    const revision = state.lots.find((l) => l.id === lotId)?.revision ?? 0;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { lotId, revision } }));
    channel?.postMessage({ lotId, revision });
  }
}

/** Assina os avisos de um lote (mesma aba e outras abas). */
export function subscribeDemoLot(lotId: string, listener: () => void): () => void {
  const local = (event: Event) => {
    if ((event as CustomEvent<{ lotId: string }>).detail.lotId === lotId) listener();
  };
  window.addEventListener(EVENT, local);
  const remote = typeof BroadcastChannel === "function" ? new BroadcastChannel("arremate-demo") : null;
  remote?.addEventListener("message", (event: MessageEvent<{ lotId: string }>) => {
    if (event.data.lotId === lotId) listener();
  });
  return () => {
    window.removeEventListener(EVENT, local);
    remote?.close();
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DemoFailure) return new ApiError({ statusCode: error.statusCode, code: error.code, message: error.message, requestId: "demo" });
  return new ApiError({ statusCode: 500, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "demo" });
}

export async function demoFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  startDemoRuntime();
  const url = new URL(path, window.location.origin);
  const method = (init.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  if (typeof init.body === "string" && init.body.length > 0) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      throw toApiError(new DemoFailure("REQUISICAO_INVALIDA"));
    }
  }
  const headers = new Headers(init.headers);
  // Pequena latência para os estados de carregamento aparecerem como na API real.
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (method === "GET" && url.pathname === "/api/catalog/search") return searchCatalog(url.searchParams.get("q") ?? "", Number(url.searchParams.get("page") ?? "1"));
  const now = Date.now();
  const state = load(now);
  try {
    const result = handle(state, { method, path: url.pathname, query: url.searchParams, body, idempotencyKey: headers.get("Idempotency-Key") }, now);
    save(state);
    emit(result.changedLots, state);
    return structuredClone(result.body);
  } catch (error) {
    save(state);
    throw toApiError(error);
  }
}

// ---------- catálogo: The Met direto do navegador (CORS aberto), 8 por página ----------

const MET = "https://collectionapi.metmuseum.org/public/collection/v1";
const searchCache = new Map<string, number[]>();

async function searchCatalog(q: string, page: number) {
  const term = q.trim();
  const pageSize = 8;
  const safe = Math.max(1, Math.floor(page) || 1);
  if (term.length < 2) return { items: [], page: safe, pageSize, total: 0, hasMore: false };
  try {
    let ids = searchCache.get(term);
    if (!ids) {
      const response = await fetch(`${MET}/search?hasImages=true&q=${encodeURIComponent(term)}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("met");
      ids = ((await response.json()) as { objectIDs: number[] | null }).objectIDs ?? [];
      searchCache.set(term, ids);
    }
    const slice = ids.slice((safe - 1) * pageSize, safe * pageSize);
    const objects = await Promise.all(slice.map(async (objectId) => {
      const response = await fetch(`${MET}/objects/${objectId}`, { signal: AbortSignal.timeout(12000) });
      return response.ok ? ((await response.json()) as Record<string, unknown>) : null;
    }));
    const now = Date.now();
    const state = load(now);
    const items = objects.filter((o): o is Record<string, unknown> => o !== null).map((o) => {
      const image = typeof o.primaryImageSmall === "string" && o.primaryImageSmall ? o.primaryImageSmall : null;
      const importable = o.isPublicDomain === true && image !== null;
      const item: CatalogCacheItem = {
        externalId: String(o.objectID),
        title: String(o.title || "Sem título"),
        artist: String(o.artistDisplayName || "Artista desconhecido"),
        artistBio: String(o.artistDisplayBio || ""),
        date: String(o.objectDate || ""),
        medium: String(o.medium || ""),
        dimensions: String(o.dimensions || ""),
        credit: String(o.creditLine || "The Metropolitan Museum of Art"),
        sourceUrl: typeof o.objectURL === "string" ? o.objectURL : null,
        imageUrl: image,
        importable,
      };
      state.catalogCache[item.externalId] = item;
      return {
        externalId: item.externalId,
        title: item.title,
        artist: item.artist,
        date: item.date,
        medium: item.medium,
        credit: item.credit,
        sourceUrl: item.sourceUrl,
        thumbnailUrl: image,
        importable,
        reason: importable ? null : o.isPublicDomain === true ? "SEM_IMAGEM" : "LICENCA_RECUSADA",
      };
    });
    save(state);
    return { items, page: safe, pageSize, total: ids.length, hasMore: safe * pageSize < ids.length };
  } catch {
    throw toApiError(new DemoFailure("PROVEDOR_INDISPONIVEL"));
  }
}

// ---------- licitantes automáticos e relógio ----------

let started = false;

/** Bots dão lance de tempos em tempos (só com a aba visível); o relógio fecha lotes vencidos e avisa as salas. */
export function startDemoRuntime() {
  if (started || typeof window === "undefined") return;
  started = true;
  channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("arremate-demo") : null;
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    const state = load(now);
    const changed = sweep(state, now);
    if (Math.random() < 0.6) {
      const live = state.lots.filter((l) => lotState(l, now) === "LIVE");
      const me = state.sessionUserId;
      // Às vezes mira um lote que a pessoa lidera, para ela ver o "você foi superado".
      const mine = live.filter((l) => state.bids.filter((b) => b.lotId === l.id).at(-1)?.userId === me);
      const pool = mine.length > 0 && Math.random() < 0.35 ? mine : live;
      const lot = pool[Math.floor(Math.random() * pool.length)];
      const bot = BOTS[Math.floor(Math.random() * BOTS.length)] as string;
      if (lot && botBid(state, bot, lot.id, now)) changed.push(lot.id);
    }
    if (changed.length > 0) {
      save(state);
      emit(changed, state);
    }
  }, BOT_MS);
}

// ---------- controles da demo (banner e auditoria) ----------

export function resetDemo() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada a limpar */
  }
  memory = null;
  window.location.reload();
}

export function tamperDemoLot(lotId: string): boolean {
  const state = load(Date.now());
  const ok = tamperLot(state, lotId);
  save(state);
  return ok;
}

export function restoreDemoLot(lotId: string): boolean {
  const state = load(Date.now());
  const ok = restoreLot(state, lotId);
  save(state);
  return ok;
}
