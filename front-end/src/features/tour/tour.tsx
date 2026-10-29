"use client";

import { ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "../auth/use-session";
import { WELCOME_DONE_EVENT, welcomeSeen } from "../welcome/welcome-video";
import { cutoutFor, stepsFor, tourKey, type TourStep } from "./tour-steps";

type TourContextValue = { start: () => void };
const TourContext = createContext<TourContextValue>({ start: () => undefined });
export const useTour = () => useContext(TourContext);

function visibleTarget(step: TourStep): HTMLElement | null {
  for (const name of step.targets) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EXIT_MS = 150;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const role = session.data?.role ?? null;
  const pathname = usePathname();
  const router = useRouter();
  const userId = session.data?.userId;
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [wanted, setWanted] = useState(false);
  const autoChecked = useRef<string | null>(null);

  const start = useCallback(() => {
    setWanted(true);
    if (pathname !== "/") router.push("/");
  }, [pathname, router]);

  // Primeiro login: a vitrine abre o tour se a chave local ainda não existe.
  useEffect(() => {
    if (!userId || pathname !== "/" || autoChecked.current === userId) return;
    let seen = true;
    try {
      seen = localStorage.getItem(tourKey(userId)) !== null;
    } catch {
      seen = true;
    }
    if (seen) return;
    const begin = () => {
      autoChecked.current = userId;
      setWanted(true);
    };
    // O card de boas-vindas (primeira visita) tem prioridade; o tour começa quando ele é decidido.
    if (!welcomeSeen()) {
      window.addEventListener(WELCOME_DONE_EVENT, begin, { once: true });
      return () => window.removeEventListener(WELCOME_DONE_EVENT, begin);
    }
    const timer = window.setTimeout(begin, 0);
    return () => window.clearTimeout(timer);
  }, [userId, pathname]);

  // Espera a vitrine montar os alvos e então resolve os passos disponíveis (sem alvo = pulado).
  useEffect(() => {
    if (!wanted || pathname !== "/") return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ready = document.querySelector('[data-tour="card"]') !== null;
      if (!ready && tries < 20) return;
      window.clearInterval(timer);
      setWanted(false);
      const available = stepsFor(role, (step) => visibleTarget(step) !== null);
      if (available.length > 0) setSteps(available);
    }, 150);
    return () => window.clearInterval(timer);
  }, [wanted, pathname, role]);

  const finish = useCallback(() => {
    if (userId) {
      try {
        localStorage.setItem(tourKey(userId), new Date().toISOString());
      } catch {
        /* sem storage: o tour só volta a aparecer no próximo login */
      }
    }
    setSteps(null);
  }, [userId]);

  const value = useMemo(() => ({ start }), [start]);
  return (
    <TourContext.Provider value={value}>
      {children}
      {steps ? <TourOverlay steps={steps} onClose={finish} /> : null}
    </TourContext.Provider>
  );
}

type Box = { top: number; left: number; width: number; height: number; radius: number };

function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<"open" | "closed">("open");
  const [box, setBox] = useState<Box | null>(null);
  const [mobile, setMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.();
  }, []);

  const measure = useCallback(() => {
    const el = visibleTarget(step);
    setMobile(window.matchMedia("(max-width: 767px)").matches);
    if (!el) return setBox(null);
    const rect = el.getBoundingClientRect();
    const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--radius")) * 16 || 10;
    const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    setBox(cutoutFor(rect, Math.min(own, rect.height / 2), token));
  }, [step]);

  useLayoutEffect(() => {
    const el = visibleTarget(step);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    const frame = window.requestAnimationFrame(measure);
    const again = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(again);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [index]);

  // Saída (inverso da entrada) antes de trocar de passo, pular ou concluir.
  const leave = useCallback((after: () => void) => {
    if (reducedMotion()) return after();
    setState("closed");
    window.setTimeout(() => {
      after();
      setState("open");
    }, EXIT_MS);
  }, []);
  const go = useCallback((delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) return leave(onClose);
    leave(() => setIndex(next));
  }, [index, steps.length, leave, onClose]);
  const skip = useCallback(() => leave(onClose), [leave, onClose]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); skip(); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); go(1); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); return; }
    if (event.key === "Tab" && dialogRef.current) {
      const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); lastEl.focus(); }
      else if (!event.shiftKey && document.activeElement === lastEl) { event.preventDefault(); first.focus(); }
    }
  };

  // Tooltip: no mobile fica ancorado embaixo; no desktop abaixo do alvo (ou acima, se faltar espaço).
  const width = 340;
  let tipStyle: React.CSSProperties;
  let origin = "bottom center";
  if (mobile || !box) {
    tipStyle = { left: 16, right: 16, bottom: 16 };
  } else {
    const below = box.top + box.height + 12;
    const placeBelow = below + 220 < window.innerHeight;
    const left = Math.min(Math.max(16, box.left + box.width / 2 - width / 2), window.innerWidth - width - 16);
    const originX = Math.min(Math.max(16, box.left + box.width / 2 - left), width - 16);
    origin = `${originX}px ${placeBelow ? "top" : "bottom"}`;
    tipStyle = placeBelow ? { top: below, left, width } : { bottom: window.innerHeight - box.top + 12, left, width };
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      {/* Bloqueia cliques na página durante o tour. */}
      <div className="absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        data-testid="tour-cutout"
        className="tour-cutout pointer-events-none fixed"
        style={box ? { top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: box.radius } : { top: "50%", left: "50%", width: 0, height: 0 }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-state={state}
        className="tour-tip fixed rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{ ...tipStyle, transformOrigin: origin }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-muted-foreground" aria-label={`Passo ${index + 1} de ${steps.length}`}>{index + 1}/{steps.length}</span>
            <span className="flex gap-1" aria-hidden="true">
              {steps.map((s, i) => <span key={s.id} className={cn("size-1.5 rounded-full", i === index ? "bg-primary" : "bg-border")} />)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={skip} aria-keyshortcuts="Escape">
            <XIcon /> Pular <kbd className="ml-1 rounded border px-1 text-[10px] text-muted-foreground">Esc</kbd>
          </Button>
        </div>
        <h2 id={titleId} className="mt-3 font-serif text-lg font-semibold">{step.title}</h2>
        <p id={bodyId} className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={index === 0}><ChevronLeftIcon /> Voltar</Button>
          <Button ref={primaryRef} size="sm" onClick={() => go(1)}>
            {last ? <><CircleCheckIcon /> Concluir</> : <>Próximo <ChevronRightIcon /></>}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
