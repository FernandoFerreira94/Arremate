"use client";

import { PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { rememberWelcome, WELCOME_DONE_EVENT, WELCOME_VIDEO, welcomeSeen, type WelcomeChoice } from "./welcome-video";

type Stage = "hidden" | "ask" | "playing";

/** Espera a introdução da marca (data-arremate-intro) terminar antes de abrir o card. */
function afterIntro(callback: () => void): () => void {
  const root = document.documentElement;
  if (!root.hasAttribute("data-arremate-intro")) {
    callback();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (root.hasAttribute("data-arremate-intro")) return;
    observer.disconnect();
    callback();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-arremate-intro"] });
  return () => observer.disconnect();
}

/**
 * Primeira visita: card grande oferecendo o vídeo de apresentação. Sem autoplay; o som só toca
 * depois do clique em "Assistir". A decisão fica no localStorage e avisa o tour pelo evento.
 */
export function WelcomeCard() {
  const [stage, setStage] = useState<Stage>("hidden");
  const watchRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (welcomeSeen()) return;
    return afterIntro(() => setStage("ask"));
  }, []);

  const decide = useCallback((choice: WelcomeChoice) => {
    rememberWelcome(choice);
    window.dispatchEvent(new Event(WELCOME_DONE_EVENT));
  }, []);

  const close = useCallback(() => {
    if (stage === "ask") decide("dismissed");
    setStage("hidden");
  }, [stage, decide]);

  const watch = () => {
    decide("watched");
    setStage("playing");
  };

  // O play acontece após o gesto do usuário, por isso pode tocar com som.
  useEffect(() => {
    if (stage !== "playing") return;
    videoRef.current?.play().catch(() => undefined);
  }, [stage]);

  return (
    <Dialog open={stage !== "hidden"} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        className="sm:max-w-3xl"
        data-testid="welcome-card"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (stage === "playing" ? videoRef.current : watchRef.current)?.focus();
        }}
      >
        <DialogTitle>Conheça o Arremate em {WELCOME_VIDEO.durationLabel}</DialogTitle>
        <DialogDescription>
          {stage === "playing"
            ? "Vitrine, sala do lote, lance e auditoria. Feche quando quiser; o vídeo não volta a aparecer."
            : "Um vídeo curto mostra a vitrine, o lance e a auditoria desta demonstração. Quer assistir agora?"}
        </DialogDescription>

        {stage === "playing" ? (
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-lg bg-foreground"
            controls
            playsInline
            preload="metadata"
            poster={WELCOME_VIDEO.poster}
            src={WELCOME_VIDEO.src}
            aria-label="Vídeo de apresentação do Arremate"
          >
            <a href={WELCOME_VIDEO.src}>Baixar o vídeo</a>
          </video>
        ) : (
          <button
            type="button"
            onClick={watch}
            className="group relative aspect-video w-full overflow-hidden rounded-lg bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Assistir ao vídeo de apresentação"
            tabIndex={-1}
          >
            {/* Poster estático (JPEG leve); a tag <img> evita a configuração do next/image para um único arquivo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WELCOME_VIDEO.poster} alt="" className="size-full object-cover" width={960} height={540} />
            <span className="absolute inset-0 flex items-center justify-center bg-foreground/20 transition-colors duration-150 group-hover:bg-foreground/30">
              <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <PlayIcon className="ml-1 size-7" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {stage === "playing" ? (
            <Button variant="outline" onClick={close}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>Agora não</Button>
              <Button ref={watchRef} onClick={watch}><PlayIcon /> Assistir</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
