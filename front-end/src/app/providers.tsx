"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthSheetProvider } from "@/features/auth/auth-sheet";
import { PendingFavoriteRunner } from "@/features/favorites/use-favorites";
import { TourProvider } from "@/features/tour/tour";
import { WelcomeCard } from "@/features/welcome/welcome-card";
import { AppToaster } from "@/components/app/toast";
import { ActivityFeed } from "@/features/activity/activity-feed";
import { ErrorListeners } from "@/components/app/error-listeners";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistration } from "@/components/app/pwa";
import { NotificationToaster } from "@/features/notifications/use-notifications";
import { PendingWatchRunner } from "@/features/notifications/use-watches";

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
      <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <AuthSheetProvider>
        <TourProvider>
          <ErrorListeners />
          <ServiceWorkerRegistration />
          <PendingFavoriteRunner />
          <PendingWatchRunner />
          <NotificationToaster />
          <WelcomeCard />
          {children}
          <ActivityFeed />
          <AppToaster />
        </TourProvider>
      </AuthSheetProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
