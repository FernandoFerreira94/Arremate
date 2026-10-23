import type { QueryClient } from "@tanstack/react-query";

const closers = new Set<() => void>();

export function registerPrivateChannel(close: () => void): () => void {
  closers.add(close);
  return () => {
    closers.delete(close);
  };
}

export function closePrivateChannels(): void {
  for (const close of closers) close();
  closers.clear();
}

export async function endSession(
  queryClient: QueryClient,
  logout: () => Promise<void>,
  redirect: (href: string) => void,
): Promise<void> {
  try {
    await logout();
  } finally {
    closePrivateChannels();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "public" });
    redirect("/entrar");
  }
}
