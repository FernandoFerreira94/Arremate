import type { Role } from "../auth/auth-api";

export type TourStep = { id: string; title: string; body: string; targets: string[]; roles?: Role[] };

export const tourKey = (userId: string) => `arremate.tour.v1.${userId}`;

/** R12: textos da prancha. Em cada passo vale o primeiro alvo visível (no mobile, nav/saldo/perfil caem no menu ☰). */
export const TOUR_STEPS: TourStep[] = [
  { id: "nav", title: "Navegação", body: "Leilões, Como funciona e Suporte ficam aqui. Em Leilões você filtra Ao vivo, Agendados e Encerrados.", targets: ["nav", "menu"] },
  { id: "balance", title: "Seu saldo", body: "Este é o saldo disponível da carteira. Toque para creditar valor simulado por Pix ou cartão de teste.", targets: ["balance", "menu"], roles: ["BIDDER"] },
  { id: "card", title: "Cards e Detalhes", body: "Cada card mostra lance atual e tempo restante. \u201cDetalhes\u201d abre a ficha completa da obra.", targets: ["card"] },
  { id: "favorite", title: "Favoritar", body: "Toque no coração para acompanhar o lote em Meus favoritos.", targets: ["favorite"] },
  { id: "bids", title: "Últimos lances", body: "Passe o mouse no número de lances para ver os 5 mais recentes, com horário e intervalo.", targets: ["bids"] },
  { id: "room", title: "Sala do lote e lance", body: "Na sala, use Mínimo, +1 ou +2 e confirme. O valor fica comprometido enquanto você lidera.", targets: ["room"] },
  { id: "profile", title: "Seu perfil", body: "Carteira, cartões, lances, favoritos e \u201cVer tour de novo\u201d ficam neste menu.", targets: ["profile", "menu"] },
];

export type Rect = { top: number; left: number; width: number; height: number };

/** Recorte = retângulo do alvo + 8 px; raio = raio computado do alvo (ou o token) + 8 px, para acompanhar a forma. */
export function cutoutFor(rect: Rect, elementRadiusPx: number, tokenRadiusPx: number, padding = 8): Rect & { radius: number } {
  const base = elementRadiusPx > 0 ? elementRadiusPx : tokenRadiusPx;
  return { top: rect.top - padding, left: rect.left - padding, width: rect.width + padding * 2, height: rect.height + padding * 2, radius: base + padding };
}

export function stepsFor(role: Role | null | undefined, has: (step: TourStep) => boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => (!step.roles || (role != null && step.roles.includes(role))) && has(step));
}
