"use client";

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/use-theme";

const MOBILE = "(max-width: 640px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Mobile (≤ 640 px) no topo central, abaixo do header (T2). */
function useMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE).matches, () => false);
}

/**
 * Toaster do Arremate (Sonner, G1/G2; substitui o toast local da D22). Segue o tema do site. Desktop embaixo à esquerda,
 * porque o canto direito é do feed de lances (D32); mobile no topo. Até 3 visíveis, sempre abertos em coluna: o aviso novo
 * entra embaixo e empurra os anteriores para cima. Corpo --card e cor de estado só na borda esquerda e no ícone (prancha T1/T2).
 */
export function AppToaster() {
  const mobile = useMobile();
  const theme = useTheme() ?? "light";
  return (
    <Toaster
      theme={theme}
      position={mobile ? "top-center" : "bottom-left"}
      offset={mobile ? { top: 72, left: 8, right: 8 } : 24}
      mobileOffset={{ top: 72, left: 8, right: 8 }}
      visibleToasts={3}
      expand
      gap={12}
      closeButton
      containerAriaLabel="Notificações"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        error: <CircleAlertIcon className="size-4 text-destructive" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        info: <InfoIcon className="size-4 text-scheduled" />,
        loading: <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border border-l-4 border-border bg-card p-4 pr-10 text-card-foreground shadow-lg sm:w-[356px] data-[type=success]:border-l-success data-[type=error]:border-l-destructive data-[type=warning]:border-l-warning data-[type=info]:border-l-scheduled data-[type=loading]:border-l-muted-foreground",
          icon: "mt-0.5 shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-sm font-semibold text-foreground",
          description: "text-xs text-muted-foreground",
          actionButton: "mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover",
          cancelButton: "mt-2 inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium",
          closeButton: "absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted",
        },
      }}
    />
  );
}
