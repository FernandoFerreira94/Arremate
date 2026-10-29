/**
 * O card de boas-vindas (vídeo) abre na primeira visita e cobriria a página nos outros testes.
 * Mesma chave de front-end/src/features/welcome/welcome-video.ts; o teste dedicado usa um contexto sem este storage.
 */
import type { BrowserContextOptions } from "@playwright/test";

export const WELCOME_KEY = "arremate.welcome.v1";

export type StorageOrigins = Exclude<BrowserContextOptions["storageState"], string | undefined>;

export function welcomeSeenStorage(origin: string): StorageOrigins {
  return { cookies: [], origins: [{ origin, localStorage: [{ name: WELCOME_KEY, value: "e2e" }] }] };
}

/** Acrescenta a chave ao storageState salvo pelo global-setup (os contextos criados à mão não herdam o `use`). */
export function withWelcomeSeen(state: StorageOrigins, origin: string): StorageOrigins {
  const entry = welcomeSeenStorage(origin).origins[0];
  const others = state.origins.filter((item) => item.origin !== origin);
  const current = state.origins.find((item) => item.origin === origin);
  const localStorage = [...(current?.localStorage ?? []).filter((item) => item.name !== WELCOME_KEY), ...entry.localStorage];
  return { ...state, origins: [...others, { origin, localStorage }] };
}
