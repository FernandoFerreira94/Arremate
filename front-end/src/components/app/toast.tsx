"use client";

import { XIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Toast local (D22): o Sonner não está instalado e não entra dependência nova. Região aria-live, some em `durationMs`
 * (8 s por padrão), fecha no X ou por ação. Embaixo à direita no desktop, no topo no mobile.
 */
export type ToastInput = { id: string; render: (close: () => void) => React.ReactNode; durationMs?: number };
type ToastApi = { show: (toast: ToastInput) => void; dismiss: (id: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast fora do ToastProvider");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInput[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);
  const show = useCallback(
    (toast: ToastInput) => {
      setToasts((list) => [...list.filter((t) => t.id !== toast.id), toast].slice(-3));
      const old = timers.current.get(toast.id);
      if (old) clearTimeout(old);
      timers.current.set(toast.id, setTimeout(() => dismiss(toast.id), toast.durationMs ?? 8000));
    },
    [dismiss],
  );
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:top-auto sm:right-0 sm:bottom-0 sm:items-end sm:p-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastInput; onClose: (id: string) => void }) {
  const close = () => onClose(toast.id);
  return (
    <div role="status" className={cn("pointer-events-auto relative w-full max-w-sm rounded-xl border bg-card p-4 pr-10 text-card-foreground shadow-lg")}>
      {toast.render(close)}
      <button type="button" onClick={close} aria-label="Fechar aviso" className="absolute top-1 right-1 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
