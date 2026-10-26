"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/error-reporter";

/** A6: erros soltos do navegador (window.onerror e promessas sem catch) vão para o relator. */
export function ErrorListeners() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? new Error(event.message));
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
