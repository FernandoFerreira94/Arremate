"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Role } from "@/features/auth/auth-api";
import { useSession } from "@/features/auth/use-session";
import { AccessDenied, ErrorState, LoadingRows } from "./page-states";

const DENIED: Record<Role, string> = {
  AUCTIONEER: "Esta página é só para leiloeiros.",
  BIDDER: "Esta página é só para licitantes.",
};

/** Guarda de UX. A autorização de verdade continua no back. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const anonymous = session.isSuccess && session.data === null;

  useEffect(() => {
    if (anonymous) router.replace(`/entrar?returnTo=${encodeURIComponent(pathname)}`);
  }, [anonymous, pathname, router]);

  if (session.isPending || anonymous) return <LoadingRows label="Conferindo sua sessão" />;
  if (session.isError) return <ErrorState message="Não foi possível conferir sua sessão." onRetry={() => void session.refetch()} />;
  if (session.data?.role !== role) return <AccessDenied message={DENIED[role]} />;
  return <>{children}</>;
}
