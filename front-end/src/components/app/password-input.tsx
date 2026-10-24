"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { passwordToggle } from "./password-toggle";

/** Campo de senha com botão de mostrar/ocultar (ícone de olho), reutilizando o Input do projeto. */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const toggle = passwordToggle(visible);
  return (
    <div className="relative">
      <Input {...props} type={toggle.type} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={toggle.label}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {visible ? <EyeOffIcon aria-hidden="true" className="size-[18px]" /> : <EyeIcon aria-hidden="true" className="size-[18px]" />}
      </button>
    </div>
  );
}

export { PasswordInput };
