"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function GoogleButton({ returnTo, linking = false, disabled = false }: { returnTo?: string; linking?: boolean; disabled?: boolean }) {
  const status = useQuery({ queryKey: ["public", "google-status"], queryFn: async () => (await apiFetch("/api/auth/google/status")) as { available: boolean } });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  async function start() {
    setSending(true);
    setError(false);
    try {
      const result = await apiFetch("/api/auth/google/start", { method: "POST", body: JSON.stringify({ returnTo }) }) as { url: string };
      const target = new URL(result.url);
      if (target.origin !== "https://accounts.google.com") throw new Error("Destino inválido");
      window.location.assign(target.href);
    } catch {
      setError(true);
      setSending(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="lg" disabled={disabled || !status.data?.available || sending} onClick={() => void start()}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current"><path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.02v2.51h3.23c1.9-1.75 2.99-4.33 2.99-7.36ZM12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22ZM6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.06a10 10 0 0 0 0 9.04l3.34-2.59ZM12 5.95c1.47 0 2.79.51 3.83 1.51l2.88-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.34 2.59c.79-2.36 3-4.12 5.6-4.12Z" /></svg>
        {sending ? "Conectando…" : linking ? "Vincular Google" : "Continuar com Google"}
      </Button>
      {!status.isPending && !status.data?.available ? <p className="text-center text-xs text-muted-foreground">indisponível na demo</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">Não foi possível entrar com o Google. Tente de novo.</p> : null}
      {!linking ? <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" /></div> : null}
    </div>
  );
}
