"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "./hint";

const INSTALL_USED = "arremate:install-used";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** PWA: registra o service worker só no build de produção (em dev o HMR não combina com cache). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}

/**
 * Botão "Instalar app" quando o navegador oferece a instalação (Chrome, Edge, Android).
 * No iPhone não há esse evento: a dica é "Compartilhar → Adicionar à Tela de Início".
 */
export function InstallAppButton({ className, variant = "full" }: { className?: string; variant?: "full" | "icon" }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    // Só em dispositivo Apple de toque, onde o Safari não dispara beforeinstallprompt.
    const appleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    window.addEventListener(INSTALL_USED, installed);
    const timer = appleTouch ? window.setTimeout(() => setIos(true), 0) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener(INSTALL_USED, installed);
      window.clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    // O evento só pode ser usado uma vez (header e rodapé recebem o mesmo): depois de usado, os dois somem.
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // já usado pelo outro botão ou recusado pelo navegador
    }
    setPrompt(null);
    window.dispatchEvent(new Event(INSTALL_USED));
  };
  // Header (27/10): ícone discreto entre a busca e o tema; o rodapé mantém o botão com texto e a dica do iPhone.
  if (variant === "icon") {
    if (!prompt) return null;
    return (
      <Hint title="Instalar o Arremate" description="Abre como aplicativo, com ícone na área de trabalho ou na tela inicial.">
        <Button type="button" variant="ghost" size="icon" aria-label="Instalar o app Arremate" className={className} onClick={() => void install()}>
          <DownloadIcon />
        </Button>
      </Hint>
    );
  }
  if (prompt) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => void install()}
      >
        <DownloadIcon className="size-4" aria-hidden /> Instalar o app
      </button>
    );
  }
  if (ios) return <p className="text-xs opacity-80">No iPhone: Compartilhar → Adicionar à Tela de Início para usar como app.</p>;
  return null;
}
