"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "../../lib/utils";

type Props = { src: string; alt: string; width: number; height: number; sizes: string; className?: string; preload?: boolean; referrerPolicy?: "no-referrer" };

export function ArtworkImage(props: Props) {
  return <ArtworkMedia key={props.src} {...props} />;
}

function ArtworkMedia({ src, alt, width, height, sizes, className, preload = false, referrerPolicy }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div role={alt ? "img" : undefined} aria-label={alt ? alt + " — Imagem indisponível" : undefined} aria-hidden={!alt || undefined} className={cn("flex items-center justify-center bg-muted px-1 text-center text-xs text-muted-foreground", className)} style={{ aspectRatio: width + "/" + height }}>Imagem indisponível</div>;
  }
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} preload={preload} referrerPolicy={referrerPolicy} onError={() => setFailed(true)} />;
}
