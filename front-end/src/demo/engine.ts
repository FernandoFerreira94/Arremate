/**
 * Motor do modo demo: simula no navegador as rotas que o front consome, com as mesmas regras do back
 * (back-end/src/lots/bid-rules.ts e common/money.ts): saldo reservado para quem lidera, anti-sniping de 120 s,
 * débito do vencedor e crédito do leiloeiro no fechamento. Puro e síncrono: recebe o estado e o relógio.
 * A auditoria é uma cadeia SHA-256 com "testemunha" separada (sem HMAC: não há segredo no navegador).
 */
import { DEMO_ARTWORKS, DEMO_LICENSE, bidAmounts, bidderOrder, demoImageUrl, incrementFor, seedLotId } from "./seed";
import { sha256Hex } from "./sha256";

export const DEMO_STATE_VERSION = 1;
export const DEMO_PASSWORD = "arremate-demo-2026";
export const ANTI_SNIPING_MS = 120_000;
const ENTRY_CENTS_CEILING = BigInt(999999999999);
const DEPOSIT_MIN = BigInt(100);
const DEPOSIT_MAX = BigInt(10_000_000);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Role = "AUCTIONEER" | "BIDDER";
export type DemoUser = { id: string; email: string; name: string; role: Role; passwordHash: string };
export type DemoArtwork = { externalId: string; title: string; artist: string; artistBio: string; date: string; medium: string; dimensions: string; credit: string; sourceUrl: string | null; imageUrl: string };
export type DemoLot = {
  id: string;
  ownerId: string;
  art: DemoArtwork;
  initialCents: string;
  incrementCents: string;
  startsAt: number;
  endsAt: number;
  status: "PUBLISHED" | "CANCELLED";
  closedAt: number | null;
  createdAt: number;
  revision: number;
  estimate: [string, string] | null;
  condition: string | null;
};
export type DemoBid = { lotId: string; sequence: number; userId: string; alias: string; amountCents: string; acceptedAt: number; hash: string; activity: number };
type Entry = { id: string; userId: string; kind: "DEPOSIT" | "RESERVE" | "RELEASE" | "SETTLEMENT_DEBIT" | "SETTLEMENT_CREDIT"; amountCents: string; method: "PIX" | "CARD" | null; last4: string | null; createdAt: number; reference: string };
type Notification = { id: string; userId: string; kind: "LOT_OPENED" | "OUTBID" | "NEW_BID"; lotId: string; createdAt: number; readAt: number | null };
type Card = { id: string; brand: string; last4: string; expiryMonth: number; expiryYear: number };
export type CatalogCacheItem = { externalId: string; title: string; artist: string; artistBio: string; date: string; medium: string; dimensions: string; credit: string; sourceUrl: string | null; imageUrl: string | null; importable: boolean };

export type DemoState = {
  version: number;
  seededAt: number;
  sessionUserId: string | null;
  users: DemoUser[];
  wallets: Record<string, { total: string; committed: string; revision: number }>;
  entries: Entry[];
  lots: DemoLot[];
  bids: DemoBid[];
  /** Testemunha: cabeça da cadeia gravada a cada lance, fora da tabela de lances. */
  witness: Record<string, { count: number; head: string }>;
  favorites: Record<string, string[]>;
  watches: Record<string, string[]>;
  notifications: Notification[];
  cards: Record<string, Card[]>;
  receipts: Record<string, string>;
  idempotency: Record<string, unknown>;
  catalogCache: Record<string, CatalogCacheItem>;
  activity: number;
  counter: number;
};

const MESSAGES: Record<string, [number, string]> = {
  REQUISICAO_INVALIDA: [400, "Requisição inválida."],
  CADASTRO_RECUSADO: [400, "Não foi possível criar a conta. Verifique os dados ou tente entrar."],
  GOOGLE_INDISPONIVEL: [503, "Entrar com Google está indisponível nesta demonstração."],
  CREDENCIAIS_INVALIDAS: [401, "E-mail ou senha inválidos."],
  SESSAO_NECESSARIA: [401, "Entre na sua conta para continuar."],
  ACESSO_NEGADO: [403, "Você não tem permissão para esta ação."],
  NAO_ENCONTRADO: [404, "Recurso não encontrado."],
  VALOR_INVALIDO: [400, "Informe valores maiores que zero e dentro do limite."],
  DATAS_INVALIDAS: [400, "Confira as datas: o início não pode estar no passado e o fim deve vir depois do início."],
  OBRA_NAO_ENCONTRADA: [404, "Obra não encontrada no acervo."],
  LICENCA_RECUSADA: [422, "Esta obra não está em domínio público."],
  LOTE_NAO_CANCELAVEL: [409, "Este lote não pode mais ser cancelado."],
  LOTE_COM_LANCES: [409, "Lotes com lances não podem ser cancelados."],
  BID_BELOW_MINIMUM: [409, "O lance precisa ser igual ou maior que o mínimo atual."],
  INSUFFICIENT_FUNDS: [409, "Saldo disponível insuficiente para reservar este lance."],
  ALREADY_LEADING: [409, "Você já lidera este lote; aguarde ser superado."],
  LOT_NOT_STARTED: [409, "Este lote ainda não abriu para lances."],
  LOT_ENDED: [409, "Este lote já encerrou."],
  LOT_CANCELLED: [409, "Este lote foi cancelado."],
  OWN_LOT: [409, "Você não pode dar lance no próprio lote."],
  PROVEDOR_INDISPONIVEL: [503, "O acervo do museu está indisponível. Tente novamente em instantes."],
};

export class DemoFailure extends Error {
  readonly statusCode: number;
  constructor(readonly code: string) {
    const [status, message] = MESSAGES[code] ?? [500, "Não foi possível concluir a operação."];
    super(message);
    this.name = "DemoFailure";
    this.statusCode = status;
  }
}

export type DemoRequest = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown>; idempotencyKey: string | null };
export type DemoResult = { body: unknown; changedLots: string[] };

const iso = (ms: number) => new Date(ms).toISOString();
const big = (value: string) => BigInt(value);

function nextId(state: DemoState, prefix: string): string {
  state.counter += 1;
  return `${prefix}-${state.counter.toString(36)}`;
}

function spread(key: string): number {
  return parseInt(sha256Hex(key).slice(0, 8), 16) / 0xffffffff;
}

// ---------- semente ----------

export function createSeedState(now: number): DemoState {
  const user = (id: string, email: string, name: string, role: Role): DemoUser => ({ id, email, name, role, passwordHash: sha256Hex(`${email}|${DEMO_PASSWORD}`) });
  const state: DemoState = {
    version: DEMO_STATE_VERSION,
    seededAt: now,
    sessionUserId: null,
    users: [
      user("u-leiloeiro", "leiloeiro@arremate.demo", "Leiloeiro de teste", "AUCTIONEER"),
      ...[1, 2, 3, 4, 5].map((n) => user(`u-licitante${n}`, `licitante${n}@arremate.demo`, `Licitante de teste ${n}`, "BIDDER")),
    ],
    wallets: {},
    entries: [],
    lots: [],
    bids: [],
    witness: {},
    favorites: {},
    watches: {},
    notifications: [],
    cards: {},
    receipts: {},
    idempotency: {},
    catalogCache: {},
    activity: 0,
    counter: 0,
  };
  const depositAt = now - 3 * DAY;
  // licitante1 (botão de teste) começa sem lances e com saldo para dar lance; o histórico usa licitante2..5 (D31).
  addDeposit(state, "u-licitante1", BigInt(5_000_000), "PIX", null, depositAt);
  for (const n of [2, 3, 4, 5]) for (const reais of [100_000, 50_000, 10_000, 5_000, 1_000]) addDeposit(state, `u-licitante${n}`, BigInt(reais * 100), "PIX", null, depositAt);

  for (const art of DEMO_ARTWORKS) {
    const s = spread(art.externalId);
    const offset = art.offsetMs ?? DAY;
    let startsAt: number;
    let endsAt: number;
    let lastBidAt: number;
    if (art.state === "SCHEDULED") {
      startsAt = now + offset;
      endsAt = startsAt + 5 * DAY;
      lastBidAt = now;
    } else if (art.state === "CLOSED") {
      startsAt = now - (2 * DAY + s * 10 * HOUR);
      endsAt = now - (1 + s * 20) * HOUR;
      lastBidAt = endsAt - 3 * MIN;
    } else {
      startsAt = art.state === "OPEN" ? now - (6 + s * 34) * HOUR : now - (2 * DAY + s * 10 * HOUR);
      endsAt = now + offset;
      lastBidAt = art.state === "OPEN" ? now - (5 + s * 85) * MIN : now - (2 + s * 6) * MIN;
    }
    const lot: DemoLot = {
      id: seedLotId(art.externalId),
      ownerId: "u-leiloeiro",
      art: { externalId: art.externalId, title: art.title, artist: art.artist, artistBio: art.artistBio, date: art.date, medium: art.medium, dimensions: art.dimensions, credit: art.credit, sourceUrl: art.sourceUrl, imageUrl: demoImageUrl(art.externalId) },
      initialCents: String(art.initial * 100),
      incrementCents: String(incrementFor(art.initial) * 100),
      startsAt,
      endsAt,
      status: "PUBLISHED",
      closedAt: null,
      createdAt: startsAt - HOUR,
      revision: 1,
      estimate: [String(art.estimate[0] * 100), String(art.estimate[1] * 100)],
      condition: art.condition,
    };
    state.lots.push(lot);
    if (art.bids) {
      const amounts = bidAmounts(art.initial, art.bids.final, art.bids.n);
      const order = bidderOrder(art.bids.n, art.bids.winner, art.bids.with);
      const first = startsAt + 10 * MIN;
      amounts.forEach((reais, i) => {
        const at = amounts.length === 1 ? lastBidAt : first + ((lastBidAt - first) * i) / (amounts.length - 1);
        acceptBid(state, lot, `u-licitante${(order[i] as number) + 1}`, String(reais * 100), Math.round(at), false);
      });
    }
  }
  sweep(state, now);
  state.notifications = [];
  return state;
}

// ---------- regras ----------

export function lotState(lot: DemoLot, now: number): "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED" {
  if (lot.status === "CANCELLED") return "CANCELLED";
  if (now < lot.startsAt) return "SCHEDULED";
  if (now < lot.endsAt) return "LIVE";
  return "ENDED";
}

const lotBids = (state: DemoState, lotId: string) => state.bids.filter((b) => b.lotId === lotId);
const leaderOf = (state: DemoState, lotId: string): DemoBid | null => lotBids(state, lotId).at(-1) ?? null;

function wallet(state: DemoState, userId: string) {
  state.wallets[userId] ??= { total: "0", committed: "0", revision: 0 };
  return state.wallets[userId];
}

function moveWallet(state: DemoState, userId: string, deltaTotal: bigint, deltaCommitted: bigint) {
  const w = wallet(state, userId);
  w.total = String(big(w.total) + deltaTotal);
  w.committed = String(big(w.committed) + deltaCommitted);
  w.revision += 1;
}

function addEntry(state: DemoState, entry: Omit<Entry, "id">) {
  state.entries.push({ id: nextId(state, "e"), ...entry });
}

function addDeposit(state: DemoState, userId: string, amount: bigint, method: "PIX" | "CARD", last4: string | null, at: number) {
  moveWallet(state, userId, amount, BigInt(0));
  addEntry(state, { userId, kind: "DEPOSIT", amountCents: String(amount), method, last4, createdAt: at, reference: method === "PIX" ? "Depósito via Pix (simulado)" : "Depósito no cartão de teste" });
}

function chainHash(prev: string, lotId: string, bid: Pick<DemoBid, "sequence" | "alias" | "amountCents" | "acceptedAt">): string {
  return sha256Hex(`${prev}|${lotId}|${bid.sequence}|${bid.alias}|${bid.amountCents}|${iso(bid.acceptedAt)}`);
}

function notify(state: DemoState, id: string, userId: string, kind: Notification["kind"], lotId: string, at: number) {
  const existing = state.notifications.find((n) => n.id === id);
  if (existing) {
    existing.createdAt = at;
    existing.readAt = null;
  } else state.notifications.push({ id, userId, kind, lotId, createdAt: at, readAt: null });
  const mine = state.notifications.filter((n) => n.userId === userId);
  if (mine.length > 30) {
    const drop = new Set(mine.sort((a, b) => a.createdAt - b.createdAt).slice(0, mine.length - 30).map((n) => n.id));
    state.notifications = state.notifications.filter((n) => !drop.has(n.id));
  }
}

/** Aceita o lance já validado: libera a reserva de quem liderava, reserva do novo líder e estende a cadeia. */
function acceptBid(state: DemoState, lot: DemoLot, userId: string, amountCents: string, at: number, sideEffects: boolean): DemoBid {
  const bids = lotBids(state, lot.id);
  const previous = bids.at(-1) ?? null;
  if (previous) {
    moveWallet(state, previous.userId, BigInt(0), -big(previous.amountCents));
    addEntry(state, { userId: previous.userId, kind: "RELEASE", amountCents: previous.amountCents, method: null, last4: null, createdAt: at, reference: lot.art.title });
  }
  moveWallet(state, userId, BigInt(0), big(amountCents));
  addEntry(state, { userId, kind: "RESERVE", amountCents, method: null, last4: null, createdAt: at, reference: lot.art.title });
  const alias = bids.find((b) => b.userId === userId)?.alias ?? `Licitante ${new Set(bids.map((b) => b.userId)).size + 1}`;
  state.activity += 1;
  const draft = { sequence: bids.length + 1, alias, amountCents, acceptedAt: at };
  const bid: DemoBid = { lotId: lot.id, userId, ...draft, hash: chainHash(previous?.hash ?? "GENESIS", lot.id, draft), activity: state.activity };
  state.bids.push(bid);
  state.witness[lot.id] = { count: bid.sequence, head: bid.hash };
  lot.revision += 1;
  if (sideEffects) {
    if (previous && previous.userId !== userId) notify(state, `outbid:${lot.id}:${previous.userId}`, previous.userId, "OUTBID", lot.id, at);
    notify(state, `newbid:${lot.id}`, lot.ownerId, "NEW_BID", lot.id, at);
  }
  return bid;
}

/** Fechamento e avisos que dependem do relógio; roda antes de cada requisição. Devolve os lotes que mudaram. */
export function sweep(state: DemoState, now: number): string[] {
  const changed: string[] = [];
  for (const lot of state.lots) {
    if (lot.status !== "PUBLISHED") continue;
    if (lot.startsAt <= now) {
      for (const [userId, ids] of Object.entries(state.watches)) {
        if (ids.includes(lot.id) && !state.notifications.some((n) => n.id === `opened:${lot.id}:${userId}`)) notify(state, `opened:${lot.id}:${userId}`, userId, "LOT_OPENED", lot.id, lot.startsAt);
      }
    }
    if (lot.endsAt > now || lot.closedAt !== null) continue;
    const winner = leaderOf(state, lot.id);
    lot.closedAt = lot.endsAt;
    lot.revision += 1;
    if (winner) {
      moveWallet(state, winner.userId, -big(winner.amountCents), -big(winner.amountCents));
      addEntry(state, { userId: winner.userId, kind: "SETTLEMENT_DEBIT", amountCents: winner.amountCents, method: null, last4: null, createdAt: lot.endsAt, reference: lot.art.title });
      moveWallet(state, lot.ownerId, big(winner.amountCents), BigInt(0));
      addEntry(state, { userId: lot.ownerId, kind: "SETTLEMENT_CREDIT", amountCents: winner.amountCents, method: null, last4: null, createdAt: lot.endsAt, reference: lot.art.title });
      state.receipts[sha256Hex(`receipt|${lot.id}|${winner.hash}`).slice(0, 32)] = lot.id;
    }
    changed.push(lot.id);
  }
  return changed;
}

// ---------- visões ----------

function lotView(state: DemoState, lot: DemoLot, now: number) {
  const bids = lotBids(state, lot.id);
  const current = bids.at(-1)?.amountCents ?? null;
  return {
    id: lot.id,
    externalId: lot.art.externalId,
    title: lot.art.title,
    artist: lot.art.artist,
    date: lot.art.date,
    medium: lot.art.medium,
    credit: lot.art.credit,
    license: DEMO_LICENSE,
    imageUrl: lot.art.imageUrl,
    initialCents: lot.initialCents,
    incrementCents: lot.incrementCents,
    currentCents: current,
    minimumNextCents: String(current === null ? big(lot.initialCents) : big(current) + big(lot.incrementCents)),
    bidCount: bids.length,
    startsAt: iso(lot.startsAt),
    endsAt: iso(lot.endsAt),
    state: lotState(lot, now),
    settlementPending: false,
    serverNow: iso(now),
  };
}

function publicLot(state: DemoState, lot: DemoLot, now: number) {
  const view = lotView(state, lot, now);
  const result = lot.status === "CANCELLED" ? "CANCELLED" : view.state !== "ENDED" ? "OPEN" : lot.closedAt === null ? "CLOSED_PENDING" : view.bidCount > 0 ? "SETTLED" : "CLOSED_NO_BIDS";
  return {
    ...view,
    dimensions: lot.art.dimensions,
    sourceUrl: lot.art.sourceUrl,
    result,
    artistBio: lot.art.artistBio || undefined,
    estimate: lot.estimate ? { lowCents: lot.estimate[0], highCents: lot.estimate[1], simulated: true } : null,
    conditionReport: lot.condition ? { text: lot.condition, simulated: true } : null,
  };
}

function paged<T>(items: T[], page: number, pageSize: number) {
  const safe = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
  return { items: items.slice((safe - 1) * pageSize, safe * pageSize), page: safe, pageSize, total: items.length };
}

const saoPauloDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));

function showcaseMatches(lot: DemoLot, tab: string, now: number): boolean {
  const s = lotState(lot, now);
  if (tab === "live") return s === "LIVE";
  if (tab === "scheduled") return s === "SCHEDULED";
  if (tab === "ended") return s === "ENDED";
  if (tab === "ending") return s === "LIVE" && saoPauloDay(lot.endsAt) === saoPauloDay(now);
  return true;
}

function showcaseOrder(now: number) {
  const rank = (l: DemoLot) => (l.startsAt <= now && l.endsAt > now ? 0 : l.startsAt > now ? 1 : 2);
  return (a: DemoLot, b: DemoLot) => rank(a) - rank(b) || (rank(a) < 2 ? a.endsAt - b.endsAt : b.endsAt - a.endsAt) || a.id.localeCompare(b.id);
}

export function verifyChain(state: DemoState, lotId: string): { status: "INTACT" | "TAMPERED"; count: number } {
  const bids = lotBids(state, lotId);
  const witness = state.witness[lotId] ?? { count: 0, head: "GENESIS" };
  let prev = "GENESIS";
  for (const [i, bid] of bids.entries()) {
    const expected = chainHash(prev, lotId, bid);
    if (bid.sequence !== i + 1 || bid.hash !== expected) return { status: "TAMPERED", count: witness.count };
    prev = expected;
  }
  if (bids.length !== witness.count || prev !== witness.head) return { status: "TAMPERED", count: witness.count };
  return { status: "INTACT", count: bids.length };
}

/** "Adultera direto no banco": muda o valor de um lance sem refazer a cadeia, como um UPDATE manual faria. */
export function tamperLot(state: DemoState, lotId: string): boolean {
  const bid = lotBids(state, lotId).at(0);
  if (!bid) return false;
  bid.amountCents = String(big(bid.amountCents) + BigInt(100));
  return true;
}

/** Desfaz a adulteração da demo recalculando os valores originais a partir da testemunha não é possível; restaura pela semente. */
export function restoreLot(state: DemoState, lotId: string): boolean {
  const bids = lotBids(state, lotId);
  if (bids.length === 0) return false;
  let prev = "GENESIS";
  for (const bid of bids) {
    if (chainHash(prev, lotId, bid) !== bid.hash) {
      // O valor adulterado é sempre +R$ 1 no primeiro lance; procura o valor que fecha o hash.
      for (const delta of [-BigInt(100), BigInt(100)]) {
        const candidate = { ...bid, amountCents: String(big(bid.amountCents) + delta) };
        if (chainHash(prev, lotId, candidate) === bid.hash) bid.amountCents = candidate.amountCents;
      }
    }
    prev = bid.hash;
  }
  return verifyChain(state, lotId).status === "INTACT";
}

function receiptTokenFor(state: DemoState, lotId: string): string | null {
  return Object.entries(state.receipts).find(([, id]) => id === lotId)?.[0] ?? null;
}

// ---------- rotas ----------

function sessionUser(state: DemoState): DemoUser | null {
  return state.users.find((u) => u.id === state.sessionUserId) ?? null;
}

function requireUser(state: DemoState, role?: Role): DemoUser {
  const user = sessionUser(state);
  if (!user) throw new DemoFailure("SESSAO_NECESSARIA");
  if (role && user.role !== role) throw new DemoFailure("ACESSO_NEGADO");
  return user;
}

function findLot(state: DemoState, id: string): DemoLot {
  const lot = state.lots.find((l) => l.id === id.toLowerCase());
  if (!lot) throw new DemoFailure("NAO_ENCONTRADO");
  return lot;
}

function money(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new DemoFailure("VALOR_INVALIDO");
  const amount = BigInt(value);
  if (amount <= BigInt(0) || amount > ENTRY_CENTS_CEILING) throw new DemoFailure("VALOR_INVALIDO");
  return amount;
}

function returnTo(value: unknown, role: Role): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return role === "AUCTIONEER" ? "/painel" : "/";
}

function walletView(state: DemoState, userId: string) {
  const w = wallet(state, userId);
  return { totalCents: w.total, committedCents: w.committed, availableCents: String(big(w.total) - big(w.committed)), revision: w.revision };
}

function notificationsView(state: DemoState, userId: string) {
  const items = state.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((n) => {
      const lot = state.lots.find((l) => l.id === n.lotId);
      return { id: n.id, kind: n.kind, lotId: n.lotId, title: lot?.art.title ?? "Lote", imageUrl: lot?.art.imageUrl ?? "", initialCents: lot?.initialCents ?? "0", createdAt: iso(n.createdAt), readAt: n.readAt === null ? null : iso(n.readAt) };
    });
  return { items, unread: items.filter((n) => n.readAt === null).length };
}

function placeBid(state: DemoState, user: DemoUser, lot: DemoLot, amountValue: unknown, now: number) {
  const amount = money(amountValue);
  const leader = leaderOf(state, lot.id);
  // Mesma ordem de recusas de decideBid (bid-rules.ts).
  if (lot.status === "CANCELLED") throw new DemoFailure("LOT_CANCELLED");
  if (now >= lot.endsAt) throw new DemoFailure("LOT_ENDED");
  if (now < lot.startsAt) throw new DemoFailure("LOT_NOT_STARTED");
  if (lot.ownerId === user.id) throw new DemoFailure("OWN_LOT");
  if (leader?.userId === user.id) throw new DemoFailure("ALREADY_LEADING");
  const minimum = leader === null ? big(lot.initialCents) : big(leader.amountCents) + big(lot.incrementCents);
  if (amount < minimum) throw new DemoFailure("BID_BELOW_MINIMUM");
  const w = wallet(state, user.id);
  if (big(w.total) - big(w.committed) < amount) throw new DemoFailure("INSUFFICIENT_FUNDS");
  const extended = lot.endsAt - now < ANTI_SNIPING_MS;
  if (extended) lot.endsAt = now + ANTI_SNIPING_MS;
  const bid = acceptBid(state, lot, user.id, String(amount), now, true);
  return {
    bid: { alias: bid.alias, amountCents: bid.amountCents, sequence: bid.sequence, acceptedAt: iso(bid.acceptedAt) },
    lotRevision: lot.revision,
    endsAt: iso(lot.endsAt),
    extended,
    serverNow: iso(now),
    walletRevision: wallet(state, user.id).revision,
  };
}

/** Lance de um licitante automático (bot da demo); recusas viram null. */
export function botBid(state: DemoState, userId: string, lotId: string, now: number): boolean {
  const user = state.users.find((u) => u.id === userId);
  const lot = state.lots.find((l) => l.id === lotId);
  if (!user || !lot) return false;
  const leader = leaderOf(state, lot.id);
  const minimum = leader === null ? big(lot.initialCents) : big(leader.amountCents) + big(lot.incrementCents);
  try {
    placeBid(state, user, lot, String(minimum), now);
    return true;
  } catch {
    return false;
  }
}

export function handle(state: DemoState, request: DemoRequest, now: number): DemoResult {
  const changedLots = sweep(state, now);
  const { method, query, body } = request;
  const parts = request.path.replace(/^\/api\//, "").split("/").filter(Boolean).map(decodeURIComponent);
  const route = `${method} ${parts.map((p, i) => (i > 0 && (parts[i - 1] === "lots" || parts[i - 1] === "receipts" || parts[i - 1] === "notifications" || parts[i - 1] === "cards") && !["next", "upcoming", "read-all"].includes(p) ? ":id" : p)).join("/")}`;
  const id = parts[1] && parts[0] === "lots" ? parts[1] : parts[2] ?? parts[1] ?? "";
  const page = Number(query.get("page") ?? "1");
  const done = (value: unknown): DemoResult => ({ body: value, changedLots });
  const idempotent = (compute: () => unknown): unknown => {
    const key = request.idempotencyKey ? `${request.path}|${request.idempotencyKey}` : null;
    if (key && key in state.idempotency) return state.idempotency[key];
    const value = compute();
    if (key) state.idempotency[key] = value;
    return value;
  };

  switch (route) {
    case "GET auth/csrf":
      return done({ csrfToken: "demo" });
    case "GET auth/session": {
      const user = sessionUser(state);
      return done({ user: user ? { role: user.role, userId: user.id, name: user.name } : null });
    }
    case "POST auth/login": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const user = state.users.find((u) => u.email === email && u.passwordHash === sha256Hex(`${email}|${String(body.password ?? "")}`));
      if (!user) throw new DemoFailure("CREDENCIAIS_INVALIDAS");
      state.sessionUserId = user.id;
      return done({ role: user.role, returnTo: returnTo(body.returnTo, user.role) });
    }
    case "POST auth/register": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const password = String(body.password ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || password.length < 8 || body.termsAccepted !== true || state.users.some((u) => u.email === email)) throw new DemoFailure("CADASTRO_RECUSADO");
      const user: DemoUser = { id: nextId(state, "u"), email, name, role: "BIDDER", passwordHash: sha256Hex(`${email}|${password}`) };
      state.users.push(user);
      state.sessionUserId = user.id;
      return done({ role: user.role, returnTo: "/" });
    }
    case "POST auth/logout":
      state.sessionUserId = null;
      return done(null);
    case "GET auth/google/status":
      return done({ available: false });
    case "POST auth/google/start":
      throw new DemoFailure("GOOGLE_INDISPONIVEL");

    case "GET lots": {
      const q = (query.get("q") ?? "").trim().toLowerCase();
      const tab = query.get("state") ?? "";
      const base = state.lots.filter((l) => l.status !== "CANCELLED" && (!q || l.art.title.toLowerCase().includes(q) || l.art.artist.toLowerCase().includes(q)));
      const items = base.filter((l) => showcaseMatches(l, tab, now)).sort(showcaseOrder(now));
      const counts = { live: 0, scheduled: 0, ended: 0, ending: 0 };
      for (const lot of base) for (const key of Object.keys(counts) as (keyof typeof counts)[]) if (showcaseMatches(lot, key, now)) counts[key] += 1;
      const result = paged(items, page, 8);
      return done({ ...result, items: result.items.map((l) => publicLot(state, l, now)), serverNow: iso(now), counts });
    }
    case "GET lots/next":
    case "GET lots/upcoming": {
      const upcoming = state.lots.filter((l) => lotState(l, now) === "SCHEDULED").sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
      if (parts[1] === "next") return done({ lot: upcoming[0] ? publicLot(state, upcoming[0], now) : null, serverNow: iso(now) });
      const limit = Math.min(20, Math.max(1, Number(query.get("limit") ?? "5")));
      return done({ items: upcoming.slice(0, limit).map((l) => publicLot(state, l, now)), serverNow: iso(now) });
    }
    case "POST lots": {
      const user = requireUser(state, "AUCTIONEER");
      return done(idempotent(() => {
        const externalId = String(body.externalId ?? "");
        const seed = DEMO_ARTWORKS.find((a) => a.externalId === externalId);
        const cached = state.catalogCache[externalId];
        if (!seed && !cached) throw new DemoFailure("OBRA_NAO_ENCONTRADA");
        if (cached && (!cached.importable || !cached.imageUrl)) throw new DemoFailure("LICENCA_RECUSADA");
        const initial = money(body.initialCents);
        const increment = money(body.incrementCents);
        const startsAt = Date.parse(String(body.startsAt ?? ""));
        const endsAt = Date.parse(String(body.endsAt ?? ""));
        if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt < now - 5 * MIN || endsAt <= startsAt) throw new DemoFailure("DATAS_INVALIDAS");
        const art: DemoArtwork = seed
          ? { externalId, title: seed.title, artist: seed.artist, artistBio: seed.artistBio, date: seed.date, medium: seed.medium, dimensions: seed.dimensions, credit: seed.credit, sourceUrl: seed.sourceUrl, imageUrl: demoImageUrl(externalId) }
          : { ...(cached as CatalogCacheItem), imageUrl: (cached as CatalogCacheItem).imageUrl as string };
        const lot: DemoLot = { id: crypto.randomUUID(), ownerId: user.id, art, initialCents: String(initial), incrementCents: String(increment), startsAt, endsAt, status: "PUBLISHED", closedAt: null, createdAt: now, revision: 1, estimate: null, condition: null };
        state.lots.push(lot);
        changedLots.push(lot.id);
        return lotView(state, lot, now);
      }));
    }
    case "GET lots/:id":
      return done(publicLot(state, findLot(state, id), now));
    case "GET lots/:id/bids": {
      const lot = findLot(state, id);
      const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? "50")));
      const items = lotBids(state, lot.id).slice().reverse().map((b) => ({ alias: b.alias, amountCents: b.amountCents, sequence: b.sequence, acceptedAt: iso(b.acceptedAt) }));
      return done(paged(items, page, limit));
    }
    case "GET lots/:id/audit": {
      const lot = findLot(state, id);
      const check = verifyChain(state, lot.id);
      return done({
        lotId: lot.id,
        status: check.status,
        revision: lot.revision,
        count: check.count,
        verifiedAt: iso(now),
        reasonCode: check.status === "INTACT" ? "OK" : "CHAIN_MISMATCH",
        message: check.status === "INTACT" ? "Demonstração: cadeia SHA-256 recalculada no seu navegador." : "Um lance foi alterado fora do fluxo de lances; o hash recalculado não bate com a testemunha.",
      });
    }
    case "POST lots/:id/bids": {
      const user = requireUser(state, "BIDDER");
      const lot = findLot(state, id);
      const result = idempotent(() => placeBid(state, user, lot, body.amountCents, now));
      changedLots.push(lot.id);
      return done(result);
    }
    case "PUT lots/:id/favorite":
    case "DELETE lots/:id/favorite":
    case "PUT lots/:id/watch":
    case "DELETE lots/:id/watch": {
      const user = requireUser(state);
      const lot = findLot(state, id);
      const store = parts[2] === "favorite" ? state.favorites : state.watches;
      const on = method === "PUT";
      const list = (store[user.id] ?? []).filter((x) => x !== lot.id);
      store[user.id] = on ? [lot.id, ...list] : list;
      return done(parts[2] === "favorite" ? { lotId: lot.id, favorite: on } : { lotId: lot.id, watching: on });
    }
    case "POST lots/:id/cancel": {
      const user = requireUser(state, "AUCTIONEER");
      const lot = findLot(state, id);
      if (lot.ownerId !== user.id) throw new DemoFailure("ACESSO_NEGADO");
      if (lot.status === "CANCELLED" || lotState(lot, now) === "ENDED") throw new DemoFailure("LOTE_NAO_CANCELAVEL");
      if (lotBids(state, lot.id).length > 0) throw new DemoFailure("LOTE_COM_LANCES");
      lot.status = "CANCELLED";
      lot.revision += 1;
      changedLots.push(lot.id);
      return done(lotView(state, lot, now));
    }
    case "GET receipts/:id": {
      const lotId = state.receipts[id];
      if (!lotId) throw new DemoFailure("NAO_ENCONTRADO");
      const lot = findLot(state, lotId);
      const winner = leaderOf(state, lot.id) as DemoBid;
      const check = verifyChain(state, lot.id);
      const owner = state.users.find((u) => u.id === lot.ownerId);
      return done({
        code: `ARR-${id.slice(0, 8).toUpperCase()}`,
        simulated: true,
        valid: check.status === "INTACT",
        lotId: lot.id,
        artwork: { externalId: lot.art.externalId, title: lot.art.title, artist: lot.art.artist, credit: lot.art.credit, license: DEMO_LICENSE, imageUrl: lot.art.imageUrl },
        winnerAlias: winner.alias,
        sellerAlias: owner?.name ?? "Leiloeiro",
        amountCents: winner.amountCents,
        startsAt: iso(lot.startsAt),
        endsAt: iso(lot.endsAt),
        settledAt: iso(lot.closedAt ?? lot.endsAt),
        audit: { status: check.status, verifiedAt: iso(now), message: check.status === "INTACT" ? "Cadeia de lances íntegra." : "A cadeia de lances não confere." },
      });
    }

    case "GET me/activity": {
      const me = state.sessionUserId;
      const after = Number(query.get("after") ?? "NaN");
      if (!Number.isFinite(after)) return done({ items: [], cursor: String(state.activity) });
      const items = state.bids
        .filter((b) => b.activity > after && b.userId !== me)
        .map((b) => ({ id: `${b.lotId}:${b.sequence}`, lotId: b.lotId, title: state.lots.find((l) => l.id === b.lotId)?.art.title ?? "Lote", alias: b.alias, amountCents: b.amountCents, acceptedAt: iso(b.acceptedAt) }));
      return done({ items, cursor: String(state.activity) });
    }
    case "GET me/participations":
    case "GET me/awards": {
      const user = requireUser(state);
      const lotFilter = query.get("lotId")?.toLowerCase() ?? null;
      const lots = state.lots
        .filter((l) => (!lotFilter || l.id === lotFilter) && state.bids.some((b) => b.lotId === l.id && b.userId === user.id))
        .sort((a, b) => b.endsAt - a.endsAt);
      if (parts[1] === "awards") {
        const won = lots.filter((l) => l.closedAt !== null && leaderOf(state, l.id)?.userId === user.id);
        return done(paged(won.map((l) => ({ lotId: l.id, title: l.art.title, imageUrl: l.art.imageUrl, amountCents: (leaderOf(state, l.id) as DemoBid).amountCents, settledAt: iso(l.closedAt as number), receiptToken: receiptTokenFor(state, l.id) ?? "" })), page, 8));
      }
      const items = lots.map((l) => {
        const mine = lotBids(state, l.id).filter((b) => b.userId === user.id);
        const leader = leaderOf(state, l.id);
        const s = lotState(l, now);
        const leading = leader?.userId === user.id;
        const outcome = s === "CANCELLED" ? "CANCELLED" : s !== "ENDED" ? (leading ? "LEADING" : "OUTBID") : l.closedAt === null ? "PENDING" : leading ? "WON" : "LOST";
        return {
          lotId: l.id,
          title: l.art.title,
          imageUrl: l.art.imageUrl,
          endsAt: iso(l.endsAt),
          state: s === "SCHEDULED" ? "LIVE" : s,
          myBids: mine.slice().reverse().map((b) => ({ amountCents: b.amountCents, acceptedAt: iso(b.acceptedAt) })),
          myTopCents: mine.at(-1)?.amountCents ?? "0",
          currentCents: leader?.amountCents ?? null,
          outcome,
          receiptToken: outcome === "WON" ? receiptTokenFor(state, l.id) : null,
        };
      });
      return done(paged(items, page, 8));
    }
    case "GET me/favorites": {
      const user = requireUser(state);
      const ids = state.favorites[user.id] ?? [];
      const lots = ids.map((x) => state.lots.find((l) => l.id === x)).filter((l): l is DemoLot => Boolean(l));
      const open = lots.filter((l) => l.status === "PUBLISHED" && l.endsAt > now);
      const closed = lots.filter((l) => !(l.status === "PUBLISHED" && l.endsAt > now));
      return done({ items: [...open, ...closed].map((l) => publicLot(state, l, now)), lotIds: ids, serverNow: iso(now) });
    }
    case "GET me/watches":
      return done({ lotIds: state.watches[requireUser(state).id] ?? [] });
    case "GET me/notifications":
      return done(notificationsView(state, requireUser(state).id));
    case "POST me/notifications/read-all":
    case "POST me/notifications/:id/read": {
      const user = requireUser(state);
      for (const n of state.notifications) if (n.userId === user.id && n.readAt === null && (parts[2] === "read-all" || n.id === parts[2])) n.readAt = now;
      return done(notificationsView(state, user.id));
    }

    case "GET seller/lots": {
      const user = requireUser(state, "AUCTIONEER");
      const tab = query.get("state");
      const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? "10")));
      const mine = state.lots.filter((l) => l.ownerId === user.id).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
      const tabOf = (l: DemoLot) => ({ LIVE: "live", SCHEDULED: "scheduled", ENDED: "ended", CANCELLED: "cancelled" })[lotState(l, now)];
      const counts = { all: mine.length, live: 0, scheduled: 0, ended: 0, cancelled: 0 };
      for (const l of mine) counts[tabOf(l) as "live"] += 1;
      const result = paged(tab ? mine.filter((l) => tabOf(l) === tab) : mine, page, limit);
      return done({ ...result, items: result.items.map((l) => lotView(state, l, now)), counts });
    }
    case "GET seller/summary": {
      const user = requireUser(state, "AUCTIONEER");
      const mine = state.lots.filter((l) => l.ownerId === user.id);
      const summary = { settledCreditCents: BigInt(0), settled: 0, closedNoBids: 0, open: 0, pending: 0, cancelled: 0 };
      for (const l of mine) {
        const s = lotState(l, now);
        if (s === "CANCELLED") summary.cancelled += 1;
        else if (s !== "ENDED") summary.open += 1;
        else if (l.closedAt === null) summary.pending += 1;
        else {
          const winner = leaderOf(state, l.id);
          if (winner) {
            summary.settled += 1;
            summary.settledCreditCents += big(winner.amountCents);
          } else summary.closedNoBids += 1;
        }
      }
      return done({ ...summary, settledCreditCents: String(summary.settledCreditCents) });
    }

    case "GET wallet":
      return done(walletView(state, requireUser(state).id));
    case "POST wallet/deposits": {
      const user = requireUser(state, "BIDDER");
      return done(idempotent(() => {
        const amount = money(body.amountCents);
        if (amount < DEPOSIT_MIN || amount > DEPOSIT_MAX) throw new DemoFailure("VALOR_INVALIDO");
        const methodName = body.method === "CARD" ? "CARD" : "PIX";
        let last4: string | null = null;
        if (methodName === "CARD") {
          const card = (state.cards[user.id] ?? []).find((c) => c.id === body.cardId);
          if (!card) throw new DemoFailure("REQUISICAO_INVALIDA");
          last4 = card.last4;
        }
        addDeposit(state, user.id, amount, methodName, last4, now);
        return walletView(state, user.id);
      }));
    }
    case "GET wallet/cards":
      return done({ items: state.cards[requireUser(state).id] ?? [] });
    case "POST wallet/cards": {
      const user = requireUser(state, "BIDDER");
      const existing = state.cards[user.id]?.[0];
      if (existing) return done(existing);
      const card: Card = { id: nextId(state, "card"), brand: "Visa", last4: "4242", expiryMonth: 12, expiryYear: new Date(now).getUTCFullYear() + 4 };
      state.cards[user.id] = [card];
      return done(card);
    }
    case "DELETE wallet/cards/:id": {
      const user = requireUser(state);
      state.cards[user.id] = (state.cards[user.id] ?? []).filter((c) => c.id !== parts[2]);
      return done(null);
    }
    case "GET wallet/entries": {
      const user = requireUser(state);
      const filter = query.get("filter") ?? "all";
      const kinds: Record<string, Entry["kind"][]> = { deposits: ["DEPOSIT"], bids: ["RESERVE", "RELEASE"], awards: ["SETTLEMENT_DEBIT", "SETTLEMENT_CREDIT"] };
      const items = state.entries
        .filter((e) => e.userId === user.id && (!kinds[filter] || kinds[filter].includes(e.kind)))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((e) => ({ id: e.id, kind: e.kind, amountCents: e.amountCents, method: e.method, last4: e.last4, createdAt: iso(e.createdAt), reference: e.reference }));
      return done(paged(items, page, 10));
    }
    default:
      throw new DemoFailure("NAO_ENCONTRADO");
  }
}
