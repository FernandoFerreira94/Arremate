"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_MODE } from "../demo/seed";

export const POLL_MS = 10_000;
export const HEARTBEAT_TIMEOUT_MS = 40_000;

export function createRevisionGate() {
  let last = 0;
  return {
    accept(revision: number): boolean {
      if (!Number.isFinite(revision) || revision <= last) return false;
      last = revision;
      return true;
    },
    reset() {
      last = 0;
    },
    current: () => last,
  };
}

export type ChannelState = "connecting" | "live" | "degraded";

/**
 * Um EventSource por página ativa. O evento só avisa; quem decide é o snapshot refeito (onRefresh).
 * Reconexão e foco refazem o snapshot. Canal fora: polling de 10s e estado "degraded" para a UI avisar.
 */
export function useLotChannel(lotId: string | null, onRefresh: () => void): ChannelState {
  const [state, setState] = useState<ChannelState>("connecting");
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!lotId || typeof window === "undefined") return;
    const gate = createRevisionGate();
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    if (DEMO_MODE) {
      // Demo: o aviso vem do motor no navegador (mesma aba e outras abas), sem EventSource.
      let unsubscribe: () => void = () => undefined;
      void import("../demo/client").then(({ subscribeDemoLot }) => {
        if (closed) return;
        unsubscribe = subscribeDemoLot(lotId, () => refresh.current());
        setState("live");
        refresh.current();
      });
      return () => {
        closed = true;
        unsubscribe();
      };
    }

    const startPolling = () => {
      setState("degraded");
      if (!poll) poll = setInterval(() => refresh.current(), POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(startPolling, HEARTBEAT_TIMEOUT_MS);
    };

    source = new EventSource(`/api/events?lotId=${encodeURIComponent(lotId)}`);
    source.addEventListener("ready", () => {
      if (closed) return;
      gate.reset();
      stopPolling();
      setState("live");
      arm();
      refresh.current();
    });
    source.addEventListener("lot.updated", (event) => {
      arm();
      const revision = Number((event as MessageEvent<string>).lastEventId);
      if (gate.accept(revision)) refresh.current();
    });
    source.addEventListener("ping", () => arm());
    source.onerror = () => {
      if (!closed) startPolling();
    };

    const onFocus = () => {
      if (document.visibilityState === "visible") refresh.current();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      closed = true;
      source?.close();
      stopPolling();
      if (watchdog) clearTimeout(watchdog);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [lotId]);

  return state;
}
