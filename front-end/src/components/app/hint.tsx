"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Cartãozinho de contexto no lugar do `title` nativo (pedido do Fernando, 27/10): título e uma linha
 * explicando o que o botão ou o card faz. Abre no hover e no foco do teclado; o nome acessível continua
 * no próprio elemento (aria-label), então leitor de tela não perde nada.
 */
export function Hint({ title, description, side = "bottom", children }: { title: ReactNode; description?: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <p className="font-medium leading-snug">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}
