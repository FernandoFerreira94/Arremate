"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthSheetProvider } from "@/features/auth/auth-sheet";
import { PendingFavoriteRunner } from "@/features/favorites/use-favorites";
import { TourProvider } from "@/features/tour/tour";

/** Um QueryClient por aba. Sessão e saldo não são compartilhados entre usuários nem guardados fora dele. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 0 }, mutations: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthSheetProvider>
        <TourProvider>
          <PendingFavoriteRunner />
          {children}
        </TourProvider>
      </AuthSheetProvider>
    </QueryClientProvider>
  );
}
