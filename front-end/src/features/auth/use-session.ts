"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { currentSession, logout } from "./auth-api";
import { endSession } from "./session-query";

export const SESSION_KEY = ["session"] as const;

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: currentSession });
}

export function useLogout() {
  const client = useQueryClient();
  const router = useRouter();
  return useCallback(() => endSession(client, logout, (href) => router.replace(href)), [client, router]);
}
