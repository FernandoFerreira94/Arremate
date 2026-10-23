import { ApiException } from "../auth/api.exception";

/** Evento público: só ID e revisão. A UI refaz o snapshot autoritativo; o evento nunca carrega valores ou usuários. */
export type LotUpdatedEvent = { type: "lot.updated"; lotId: string; revision: number };
type Listener = (event: LotUpdatedEvent) => void;

/** Pub/sub em memória de uma instância. Várias instâncias exigiriam um barramento externo (limite declarado). */
export class LotEventsService {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly revisions = new Map<string, number>();
  private total = 0;

  constructor(
    private readonly perLot = 200,
    private readonly global = 2000,
  ) {}

  subscribe(lotId: string, listener: Listener): () => void {
    const set = this.listeners.get(lotId) ?? new Set<Listener>();
    if (set.size >= this.perLot || this.total >= this.global) throw new ApiException(429, "LIMITE_CONEXOES");
    set.add(listener);
    this.listeners.set(lotId, set);
    this.total += 1;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      set.delete(listener);
      this.total -= 1;
      if (set.size === 0) this.listeners.delete(lotId);
    };
  }

  publish(lotId: string): void {
    const revision = (this.revisions.get(lotId) ?? 0) + 1;
    this.revisions.set(lotId, revision);
    const event: LotUpdatedEvent = { type: "lot.updated", lotId, revision };
    for (const listener of [...(this.listeners.get(lotId) ?? [])]) {
      try {
        listener(event);
      } catch {
        // um ouvinte quebrado não derruba os demais
      }
    }
  }

  listenerCount(lotId: string): number {
    return this.listeners.get(lotId)?.size ?? 0;
  }
}
