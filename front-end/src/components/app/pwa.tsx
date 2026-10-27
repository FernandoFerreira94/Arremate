"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";

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
export function InstallAppButton({ className }: { className?: string }) {
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
    const timer = appleTouch ? window.setTimeout(() => setIos(true), 0) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
      window.clearTimeout(timer);
    };
  }, []);

  if (prompt) {
    return (
      <button
        type="button"
        className={className}
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice.catch(() => undefined);
          setPrompt(null);
        }}
      >
        <DownloadIcon className="size-4" aria-hidden /> Instalar o app
      </button>
    );
  }
  if (ios) return <p className="text-xs opacity-80">No iPhone: Compartilhar → Adicionar à Tela de Início para usar como app.</p>;
  return null;
}
