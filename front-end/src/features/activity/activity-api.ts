import { apiFetch } from "../../lib/api";

/** D32: lance de outra pessoa, para o feed ao vivo do canto inferior direito. */
export type ActivityItem = { id: string; lotId: string; title: string; alias: string; amountCents: string; acceptedAt: string };
export type ActivityPage = { items: ActivityItem[]; cursor: string };

/** Polling curto: o SSE é por lote e limitado a 3 conexões por IP, então o feed global não abre stream próprio. */
export const ACTIVITY_POLL_MS = 4000;
/** Quanto cada card fica na tela depois de aberto (pausa com mouse ou foco). */
export const FEED_CARD_MS = 7000;
/** Fila de espera máxima; o excedente mais antigo é descartado para o feed não atrasar em relação ao leilão. */
export const FEED_QUEUE_MAX = 12;

export async function getActivity(after: string | null): Promise<ActivityPage> {
  return (await apiFetch(after ? `/api/me/activity?after=${encodeURIComponent(after)}` : "/api/me/activity")) as ActivityPage;
}

/** Junta lances novos à fila: ignora os já vistos e os do lote cuja sala está aberta (a sala já mostra o lance). */
export function enqueue(queue: readonly ActivityItem[], seen: ReadonlySet<string>, items: readonly ActivityItem[], pathname: string): ActivityItem[] {
  const fresh = items.filter((item) => !seen.has(item.id) && pathname !== `/lotes/${item.lotId}`);
  return [...queue, ...fresh].slice(-FEED_QUEUE_MAX);
}

export type FeedState = { queue: ActivityItem[]; shown: ActivityItem[]; announce: string };
export const EMPTY_FEED: FeedState = { queue: [], shown: [], announce: "" };

/** Promove da fila para a tela até `slots` cards visíveis; anuncia o último que entrou (aria-live). */
export function promote(state: FeedState, slots: number, describe: (item: ActivityItem) => string): FeedState {
  const free = Math.max(0, slots - state.shown.length);
  if (free === 0 || state.queue.length === 0) return state;
  const next = state.queue.slice(0, free);
  const last = next.at(-1) as ActivityItem;
  return { queue: state.queue.slice(free), shown: [...state.shown, ...next], announce: describe(last) };
}
