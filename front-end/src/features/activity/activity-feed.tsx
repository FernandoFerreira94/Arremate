"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { formatBrl } from "@/lib/money";
import { useSession } from "../auth/use-session";
import { ACTIVITY_POLL_MS, EMPTY_FEED, enqueue, FEED_CARD_MS, FEED_QUEUE_MAX, getActivity, promote, type ActivityItem, type FeedState } from "./activity-api";

const VISIBLE_DESKTOP = 3;
const VISIBLE_MOBILE = 1;
const LEAVE_MS = 300;

function useVisibleSlots(): number {
  const [slots, setSlots] = useState(VISIBLE_DESKTOP);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setSlots(query.matches ? VISIBLE_MOBILE : VISIBLE_DESKTOP);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return slots;
}

/**
 * D32: feed ao vivo de lances de outras pessoas, no canto inferior direito. Cada card monta um círculo com o
 * martelo da L3, entra da direita só com o nome da obra e abre como accordion com o lance. Some sozinho
 * (pausa com mouse ou foco); com movimento reduzido aparece pronto, sem animação.
 */
export function ActivityFeed() {
  const role = useSession().data?.role;
  // Remonta a cada sessão: trocar de conta zera fila e cursor.
  return role ? <Feed key={role} /> : null;
}

const describe = (item: ActivityItem) => `Novo lance em ${item.title}: ${formatBrl(item.amountCents)}.`;

function Feed() {
  const pathname = usePathname();
  const slots = useVisibleSlots();
  const [state, setState] = useState<FeedState>(EMPTY_FEED);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const cursor = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const path = useRef(pathname);
  const slotsRef = useRef(slots);
  useEffect(() => {
    path.current = pathname;
    slotsRef.current = slots;
  }, [pathname, slots]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const page = await getActivity(cursor.current);
        if (stopped) return;
        cursor.current = page.cursor;
        // Filtra antes do updater: o updater do setState pode rodar depois de marcar os ids como vistos.
        const fresh = enqueue([], seen.current, page.items, path.current);
        for (const item of page.items) seen.current.add(item.id);
        if (fresh.length > 0) setState((current) => promote({ ...current, queue: [...current.queue, ...fresh].slice(-FEED_QUEUE_MAX) }, slotsRef.current, describe));
      } catch {
        // Feed é acessório: falha de rede só espera a próxima rodada.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), ACTIVITY_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  function dismiss(id: string) {
    setLeaving((current) => new Set(current).add(id));
    window.setTimeout(() => {
      setState((current) => promote({ ...current, shown: current.shown.filter((item) => item.id !== id) }, slotsRef.current, describe));
      setLeaving((current) => {
        const copy = new Set(current);
        copy.delete(id);
        return copy;
      });
    }, LEAVE_MS);
  }

  return (
    <section aria-label="Lances ao vivo" className="activity-feed" data-testid="activity-feed">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{state.announce}</p>
      <ol className="flex flex-col-reverse gap-2">
        {state.shown.map((item) => (
          <FeedCard key={item.id} item={item} leaving={leaving.has(item.id)} onDismiss={() => dismiss(item.id)} />
        ))}
      </ol>
    </section>
  );
}

function FeedCard({ item, leaving, onDismiss }: { item: ActivityItem; leaving: boolean; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismissRef.current(), FEED_CARD_MS);
    return () => window.clearTimeout(timer);
  }, [paused]);

  return (
    <li
      className="feed-card"
      data-leaving={leaving ? "" : undefined}
      data-testid="activity-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="feed-card__badge" aria-hidden>
        <svg viewBox="0 0 48 48" className="feed-card__ring">
          <circle cx="24" cy="24" r="22" pathLength="1" />
        </svg>
        {/* Martelo da L3 (public/brand/l3-simbolo-paper.svg) em papel sobre o bordô. */}
        <svg viewBox="0 0 32 32" className="feed-card__mark">
          <g transform="rotate(-40 16 15)">
            <rect x="8.5" y="6" width="15" height="7.5" rx="1.6" fill="#F6F3EC" />
            <rect x="11" y="6" width="1.6" height="7.5" fill="#A9823A" />
            <rect x="19.4" y="6" width="1.6" height="7.5" fill="#A9823A" />
            <rect x="14.7" y="12" width="2.6" height="13" rx="1.3" fill="#F6F3EC" />
          </g>
          <rect x="5" y="24.6" width="13" height="3" rx="1" fill="#A9823A" />
        </svg>
      </span>
      <div className="feed-card__body">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate font-serif text-sm font-semibold" title={item.title}>{item.title}</p>
          <button type="button" onClick={onDismiss} aria-label={`Fechar aviso de ${item.title}`} className="-m-1 grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
            <XIcon className="size-3.5" />
          </button>
        </div>
        <div className="feed-card__details">
          <div className="min-h-0 overflow-hidden">
            <p className="pt-1 text-xs text-muted-foreground">
              <span className="font-semibold tabular-nums text-primary">{formatBrl(item.amountCents)}</span> · {item.alias} deu lance agora
            </p>
            <Link href={`/lotes/${item.lotId}`} className="mt-1 inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline">
              Ver lote
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
