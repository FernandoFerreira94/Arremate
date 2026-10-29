/**
 * Card de boas-vindas: na primeira visita o site oferece o vídeo de apresentação (28 s).
 * A escolha (assistiu ou dispensou) fica no localStorage e o card não volta a aparecer.
 * Para trocar o vídeo, substitua os arquivos em `front-end/public/media/` (ideal < 25 MB; poster leve).
 */
export const WELCOME_VIDEO = {
  src: "/media/boas-vindas.mp4",
  poster: "/media/boas-vindas-poster.jpg",
  durationLabel: "28 segundos",
} as const;

export const WELCOME_KEY = "arremate.welcome.v1";
/** Disparado em `window` quando o visitante decide; o tour do primeiro login espera por ele. */
export const WELCOME_DONE_EVENT = "arremate:welcome-done";

export type WelcomeChoice = "watched" | "dismissed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Sem storage (modo privado, bloqueio) o card não aparece, para não repetir a cada visita. */
export function welcomeSeen(store: StorageLike | null = storage()): boolean {
  if (!store) return true;
  try {
    return store.getItem(WELCOME_KEY) !== null;
  } catch {
    return true;
  }
}

export function rememberWelcome(choice: WelcomeChoice, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(WELCOME_KEY, choice);
  } catch {
    /* sem storage: a escolha vale só nesta página */
  }
}
