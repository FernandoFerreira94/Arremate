"use client";

import { ErrorState, LoadingRows } from "./page-states";

export function RouteLoading() {
  return <LoadingRows label="Carregando página" rows={4} />;
}

export function RouteError({ reset }: { reset: () => void }) {
  return <ErrorState message="Não foi possível carregar esta página. Tente de novo." onRetry={reset} />;
}
