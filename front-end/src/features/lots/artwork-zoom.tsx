"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { ImageOffIcon, MaximizeIcon, RotateCcwIcon, XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { ArtworkImage } from "@/components/app/artwork-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useZoom } from "@/hooks/use-zoom";
import { LENS_SIZE, lensAt, percent, zoomHint, type Lens } from "@/lib/zoom";
import { cn } from "@/lib/utils";

type Props = {
  /** Imagem normal da obra (~600 px): vitrine do lote, miniatura borrada e minimapa. */
  src: string;
  /** D28: versão de zoom (~2500 px), servida por /api/media/zoom/:externalId. */
  zoomSrc: string;
  alt: string;
  title: string;
  credit: string;
};

/**
 * D28 (Z3): clique na obra abre o Dialog com lupa, zoom 1×→2×→3×, arrastar, barra −/+/redefinir e minimapa; no celular,
 * tela cheia com pinça e duplo toque. `trigger` troca o gatilho (card da vitrine); a imagem grande só carrega ao abrir.
 */
export function ArtworkZoom({ src, zoomSrc, alt, title, credit, trigger }: Props & { trigger?: ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <button type="button" aria-label={`Ampliar imagem: ${title}`} className="group relative block w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArtworkImage src={src} alt={alt} width={1200} height={900} sizes="(min-width: 1360px) 728px, (min-width: 1024px) 58vw, 100vw" preload className="h-auto w-full rounded-lg bg-muted object-contain" />
          <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-foreground/75 px-2 py-1 text-xs font-medium text-background opacity-90 group-hover:opacity-100">
            <MaximizeIcon className="size-3.5" /> Ampliar
          </span>
        </button>}
      </DialogTrigger>
      <DialogContent
        data-testid="zoom-dialog"
        aria-describedby="zoom-help"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          "inset-0 h-dvh max-h-none w-screen gap-0 overflow-hidden rounded-none border-0 bg-stone-900 p-0 text-stone-50",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[90vh] sm:max-h-none sm:w-[min(1280px,94vw)] sm:max-w-none sm:rounded-xl sm:border sm:border-stone-700",
          "[&>button:last-child]:hidden sm:[&>button:last-child]:inline-flex [&>button:last-child]:text-stone-50 [&>button:last-child]:hover:bg-stone-800",
        )}
      >
        <ZoomBody src={src} zoomSrc={zoomSrc} alt={alt} title={title} credit={credit} />
      </DialogContent>
    </Dialog>
  );
}

function ZoomBody({ src, zoomSrc, alt, title, credit }: Props) {
  const zoom = useZoom();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lens, setLens] = useState<Lens | null>(null);
  const focusTarget = useRef<HTMLDivElement | null>(null);
  const hiresSrc = attempt === 0 ? zoomSrc : `${zoomSrc}?tentativa=${attempt}`;

  useEffect(() => {
    focusTarget.current?.focus();
  }, []);

  // Ref estável: um callback novo a cada render remedia e re-renderiza sem fim (React #185).
  const { viewportRef } = zoom;
  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef(node);
      focusTarget.current = node;
    },
    [viewportRef],
  );

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    setAttempt((value) => value + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={zoom.onKeyDown}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 sm:pr-16">
        <div className="min-w-0">
          <DialogTitle className="truncate font-serif text-base font-semibold text-stone-50 sm:text-lg">{title}</DialogTitle>
          <DialogDescription id="zoom-help" className="truncate text-xs text-stone-300">
            {credit}
            <span className="sr-only"> Clique ou toque duas vezes para ampliar; arraste para mover; teclas + e − mudam o zoom, 0 redefine, setas movem e Esc fecha.</span>
          </DialogDescription>
        </div>
        <span className="hidden shrink-0 rounded-md bg-stone-800 px-2 py-1 text-xs text-stone-200 sm:inline">
          {zoomHint(zoom.scale)}
        </span>
      </div>

      <div
        ref={setViewport}
        tabIndex={0}
        role="img"
        aria-label={`${alt}, zoom ${percent(zoom.scale)}`}
        data-testid="zoom-viewport"
        data-scale={zoom.scale}
        className={cn(
          "relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500",
          zoom.dragging ? "cursor-grabbing" : lens ? "cursor-none" : zoom.scale >= 3 ? "cursor-zoom-out" : "cursor-zoom-in",
        )}
        {...zoom.handlers}
        onPointerMove={(event) => {
          zoom.handlers.onPointerMove(event);
          // Lupa (27/10): só com mouse, a 1× e com a imagem em alta carregada; no toque vale a pinça.
          if (event.pointerType !== "mouse" || zoom.scale !== 1 || zoom.dragging || !loaded) return setLens(null);
          const rect = event.currentTarget.getBoundingClientRect();
          setLens(lensAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, { width: rect.width, height: rect.height }, zoom.natural));
        }}
        onPointerLeave={() => setLens(null)}
      >
        <div
          className={cn("absolute inset-0 will-change-transform", !zoom.dragging && "transition-transform duration-200 ease-out motion-reduce:transition-none")}
          style={{ transform: zoom.transform }}
        >
          {!loaded ? <Image src={src} alt="" fill sizes="100vw" aria-hidden className="scale-105 object-contain blur-md" data-testid="zoom-placeholder" draggable={false} /> : null}
          {!failed ? (
            <Image
              key={hiresSrc}
              src={hiresSrc}
              alt=""
              fill
              unoptimized
              sizes="100vw"
              draggable={false}
              data-testid="zoom-hires"
              className={cn("object-contain", !loaded && "opacity-0")}
              onLoad={(event) => {
                zoom.onImageLoad(event);
                setLoaded(true);
              }}
              onError={() => setFailed(true)}
            />
          ) : null}
        </div>

        {lens && zoom.scale === 1 ? (
          <div
            aria-hidden
            data-testid="zoom-lens"
            data-factor={lens.factor}
            className="pointer-events-none absolute rounded-full border-2 border-amber-400 bg-stone-950 bg-no-repeat shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
            style={{ left: lens.left, top: lens.top, width: LENS_SIZE, height: LENS_SIZE, backgroundImage: `url("${hiresSrc}")`, backgroundSize: lens.backgroundSize, backgroundPosition: lens.backgroundPosition }}
          />
        ) : null}

        {!loaded && !failed ? (
          <div role="status" className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="rounded-md bg-stone-900/80 px-3 py-1.5 text-sm text-stone-100">Carregando…</span>
          </div>
        ) : null}

        {failed ? (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900 px-6 text-center">
            <ImageOffIcon className="size-8 text-stone-300" aria-hidden />
            <p className="font-medium text-stone-50">Não foi possível carregar a imagem em alta.</p>
            <p className="text-sm text-stone-300">Verifique sua conexão.</p>
            <Button type="button" onClick={retry} onPointerDown={(event) => event.stopPropagation()}>Tentar de novo</Button>
          </div>
        ) : null}

        {zoom.scale > 1 && loaded ? (
          <div data-testid="zoom-minimap" aria-hidden className="pointer-events-none absolute bottom-3 right-3 w-28 overflow-hidden rounded-md border border-stone-600 bg-stone-950/80 sm:w-36">
            <div className="relative" style={{ aspectRatio: `${zoom.natural.width || 4} / ${zoom.natural.height || 3}` }}>
              <Image src={src} alt="" fill sizes="144px" className="object-cover opacity-80" />
              <div
                data-testid="zoom-minimap-rect"
                className="absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${zoom.minimap.left * 100}%`, top: `${zoom.minimap.top * 100}%`, width: `${zoom.minimap.width * 100}%`, height: `${zoom.minimap.height * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-stone-800 px-3 py-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Diminuir zoom" disabled={zoom.scale <= 1} onClick={zoom.zoomOut} className="text-stone-50 hover:bg-stone-800">
          <ZoomOutIcon />
        </Button>
        <output aria-live="polite" data-testid="zoom-level" className="min-w-14 text-center text-sm tabular-nums">{percent(zoom.scale)}</output>
        <Button type="button" variant="ghost" size="icon" aria-label="Aumentar zoom" disabled={zoom.scale >= zoom.max} onClick={zoom.zoomIn} className="text-stone-50 hover:bg-stone-800">
          <ZoomInIcon />
        </Button>
        <Button type="button" variant="ghost" aria-label="Redefinir zoom" disabled={zoom.scale === 1 && zoom.x === 0 && zoom.y === 0} onClick={zoom.reset} className="gap-1.5 text-stone-50 hover:bg-stone-800">
          <RotateCcwIcon /> <span className="hidden sm:inline">Redefinir</span>
        </Button>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="ml-auto gap-1.5 border-stone-600 bg-stone-50 text-stone-900 sm:hidden">
            <XIcon /> Fechar
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}
