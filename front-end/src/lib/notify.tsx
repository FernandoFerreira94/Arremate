"use client";

import { CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast, type ExternalToast } from "sonner";
import { ApiError } from "./api-error";
import { reportClientError } from "./error-reporter";

/**
 * C2 (plano erros-e-toasts, G2): um só caminho para toasts. Sucesso 4 s, aviso 6 s, erro 8 s; toast com ação fica
 * até fechar. A mensagem vem da API (`message`) quando existir; senão, o texto local (fallback).
 */
export const TOAST_DURATION = { success: 4000, info: 4000, warning: 6000, error: 8000, action: Number.POSITIVE_INFINITY } as const;

export type ToastAction = { label: string; onClick: () => void };

export function messageOf(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string" && value.message.trim()) return value.message;
  return fallback;
}

export function notifySuccess(message: string, options: { id?: string; action?: ToastAction } = {}) {
  return toast.success(message, withAction({ id: options.id, duration: TOAST_DURATION.success }, options.action));
}

export function notifyInfo(message: string, options: { id?: string } = {}) {
  return toast.info(message, { id: options.id, duration: TOAST_DURATION.info });
}

export function notifyWarning(message: string, description?: string) {
  return toast.warning(message, { description, duration: TOAST_DURATION.warning });
}

/**
 * Erro: ApiError mostra a mensagem do servidor e o código para suporte (completo, com botão de copiar).
 * 401 leva para /entrar; CONFIRMATION_PENDING vira aviso. Erro inesperado (não ApiError) também é relatado.
 */
export function notifyError(error: unknown, fallback = "Não foi possível concluir a operação.", options: { id?: string; retry?: () => void } = {}) {
  if (error instanceof ApiError) {
    if (error.code === "CONFIRMATION_PENDING") return notifyWarning("Confirmação pendente.", "Repita com a mesma chave em instantes.");
    const id = options.id;
    const shown = toast.error(error.message || fallback, withAction({ id, duration: TOAST_DURATION.error, description: error.requestId ? <SupportCode code={error.requestId} /> : undefined }, options.retry ? { label: "Tentar de novo", onClick: options.retry } : undefined));
    if (error.statusCode === 401 && error.code === "SESSAO_NECESSARIA" && typeof window !== "undefined" && window.location.pathname !== "/entrar") {
      const back = `${window.location.pathname}${window.location.search}`;
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- módulo fora de componente; navegação completa limpa o cache da sessão expirada
      window.location.assign(`/entrar?returnTo=${encodeURIComponent(back)}`);
    }
    return shown;
  }
  reportClientError(error);
  return toast.error(fallback, withAction({ id: options.id, duration: TOAST_DURATION.error, description: "Tente de novo." }, options.retry ? { label: "Tentar de novo", onClick: options.retry } : undefined));
}

/** Erro já traduzido em texto (sem ApiError), ex.: desfecho do cancelamento. */
export function notifyErrorText(message: string) {
  return toast.error(message, { duration: TOAST_DURATION.error });
}

/** Carregando sem prazo; vira sucesso (4 s) ou erro (8 s) no mesmo toast. */
export async function notifyPromise<T>(promise: Promise<T>, texts: { loading: string; success: string | ((value: T) => string); error?: string }): Promise<T> {
  const id = toast.loading(texts.loading, { duration: TOAST_DURATION.action });
  try {
    const value = await promise;
    notifySuccess(typeof texts.success === "function" ? texts.success(value) : texts.success, { id: String(id) });
    return value;
  } catch (error) {
    notifyError(error, texts.error, { id: String(id) });
    throw error;
  }
}

function withAction(options: ExternalToast, action?: ToastAction): ExternalToast {
  if (!action) return options;
  return { ...options, duration: TOAST_DURATION.action, action: { label: action.label, onClick: action.onClick } };
}

/** Código para suporte completo e copiável (G2). */
export function SupportCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span>
        Código para suporte: <span className="font-mono break-all" data-testid="support-code">{code}</span>
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? <CheckIcon className="size-3" aria-hidden /> : <CopyIcon className="size-3" aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}
