import { signBid, signCheckpoint, signGenesis, signaturesMatch, verifyBidSignature } from "./audit-chain";
import type { PoolClient } from "pg";
import type { AuditRepository } from "./audit.repository";
import type { CheckpointStore } from "./checkpoint-store";
import type {
  AuditResult,
  CanonicalBid,
  Checkpoint,
  CheckpointBody,
  GenesisRecord,
  LotHistory,
  LotSnapshot,
  SettlementLink,
} from "./audit.types";

export type AcceptBidInput = {
  lotId: string;
  bidId: string;
  bidderUserId: string;
  alias: string;
  sequence: number;
  amountCents: bigint;
  acceptedAt: string;
  endsAt: string;
};

export type BidDraft = Omit<AcceptBidInput, "lotId" | "sequence">;
export type BidHead = { count: number; revision: number };
/** Resultado do passo decisório dentro da transação do lance. */
export type BidPlan<T> =
  | { kind: "replay"; result: T }
  | { kind: "accept"; draft: BidDraft; finish: (client: PoolClient, accepted: { sequence: number; revision: number }) => Promise<T> };

/** Resultado do passo decisório da liquidação: nada a fazer ou o vínculo a selar na testemunha. */
export type SettlementPlan<T> =
  | { kind: "skip"; result: T }
  | { kind: "settle"; link: SettlementLink; finish: (client: PoolClient, revision: number) => Promise<T> };

export class ConfirmationPendingError extends Error {
  constructor() {
    super("CONFIRMATION_PENDING");
    this.name = "ConfirmationPendingError";
  }
}

export class IntegrityBlockedError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "IntegrityBlockedError";
    this.code = code;
  }
}

export class AuditService {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: AuditRepository,
    private readonly store: CheckpointStore,
    private readonly key: Uint8Array | null,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async openGenesis(lotId: string): Promise<void> {
    await this.exclusive(lotId, async () => {
      const key = this.requireKey();
      const history = await this.repository.loadHistory(lotId);
      if (!history.lot || history.bids.length > 0 || history.lot.revision !== 0) {
        throw new Error("lote não aceita gênese");
      }
      if (await this.store.read(lotId)) {
        throw new Error("gênese já existe");
      }
      const record = genesisFromLot(history.lot);
      const genesisSignature = signGenesis(record, key);
      const body: CheckpointBody = {
        lotId,
        revision: 0,
        count: 0,
        headSignature: genesisSignature,
        genesisSignature,
        keyVersion: 1,
        endsAt: history.lot.endsAt,
        ownerId: record.ownerId,
        snapshotId: record.snapshotId,
        initialCents: record.initialCents,
        incrementCents: record.incrementCents,
        startsAt: record.startsAt,
        genesisEndsAt: record.endsAt,
        settlement: null,
      };
      await this.store.advance(0, seal(body, key));
    });
  }

  async acceptBid(input: AcceptBidInput): Promise<void> {
    await this.exclusive(input.lotId, async () => {
      await this.assertCanMutate(input.lotId);
      const key = this.requireKey();
      const current = await this.store.read(input.lotId);
      if (!current || input.sequence !== current.count + 1) {
        throw new Error("sequence divergente");
      }
      const event: CanonicalBid = {
        lotId: input.lotId,
        bidId: input.bidId,
        bidderUserId: input.bidderUserId,
        alias: input.alias,
        sequence: input.sequence,
        amountCents: input.amountCents,
        acceptedAt: input.acceptedAt,
        previousSignature: current.headSignature,
        keyVersion: 1,
      };
      const signature = signBid(event, event.previousSignature, key);
      const body: CheckpointBody = {
        lotId: current.lotId,
        revision: current.revision + 1,
        count: current.count + 1,
        headSignature: signature,
        genesisSignature: current.genesisSignature,
        keyVersion: current.keyVersion,
        endsAt: input.endsAt,
        ownerId: current.ownerId,
        snapshotId: current.snapshotId,
        initialCents: current.initialCents,
        incrementCents: current.incrementCents,
        startsAt: current.startsAt,
        genesisEndsAt: current.genesisEndsAt,
        settlement: current.settlement,
        ...(current.cancelled ? { cancelled: true } : {}),
      };
      const next = seal(body, key);
      await this.store.writePending(next);
      try {
        await this.repository.commitBid({
          lotId: input.lotId,
          expectedRevision: current.revision,
          nextRevision: next.revision,
          endsAt: input.endsAt,
          bidId: input.bidId,
          bidderUserId: input.bidderUserId,
          alias: input.alias,
          sequence: input.sequence,
          amountCents: input.amountCents,
          acceptedAt: input.acceptedAt,
          signature,
        });
      } catch (error) {
        await this.store.clearPending(input.lotId);
        throw error;
      }
      await this.store.advance(current.revision, next);
      await this.store.clearPending(input.lotId);
    });
  }

  /**
   * Lance atômico: decide, grava lance + revisão + efeitos (carteira/idempotência) numa única transação
   * e só então avança a testemunha. Se a testemunha falhar depois do commit, a intenção fica pendente
   * e o lote bloqueia mutações até `retryCheckpoint` (fail-closed).
   */
  async acceptBidAtomic<T>(lotId: string, decide: (client: PoolClient, head: BidHead) => Promise<BidPlan<T>>): Promise<T> {
    return this.exclusive(lotId, async () => {
      await this.assertCanMutate(lotId);
      const key = this.requireKey();
      const current = await this.store.read(lotId);
      if (!current) throw new IntegrityBlockedError("CONFIRMATION_PENDING");
      const state: { next: Checkpoint | null } = { next: null };
      let committed = false;
      try {
        const result = await this.repository.transaction(async (client) => {
          const plan = await decide(client, { count: current.count, revision: current.revision });
          if (plan.kind === "replay") return plan.result;
          const sequence = current.count + 1;
          const event: CanonicalBid = {
            lotId,
            bidId: plan.draft.bidId,
            bidderUserId: plan.draft.bidderUserId,
            alias: plan.draft.alias,
            sequence,
            amountCents: plan.draft.amountCents,
            acceptedAt: plan.draft.acceptedAt,
            previousSignature: current.headSignature,
            keyVersion: 1,
          };
          const signature = signBid(event, event.previousSignature, key);
          const next = seal(nextBody(current, signature, plan.draft.endsAt), key);
          await this.store.writePending(next);
          state.next = next;
          await this.repository.insertBid(client, {
            lotId,
            expectedRevision: current.revision,
            nextRevision: next.revision,
            endsAt: plan.draft.endsAt,
            bidId: plan.draft.bidId,
            bidderUserId: plan.draft.bidderUserId,
            alias: plan.draft.alias,
            sequence,
            amountCents: plan.draft.amountCents,
            acceptedAt: plan.draft.acceptedAt,
            signature,
          });
          return plan.finish(client, { sequence, revision: next.revision });
        });
        committed = true;
        const pending = state.next;
        if (pending) {
          await this.store.advance(current.revision, pending);
          await this.store.clearPending(lotId);
        }
        return result;
      } catch (error) {
        if (committed) throw new ConfirmationPendingError();
        if (state.next) await this.store.clearPending(lotId);
        throw error;
      }
    });
  }

  /**
   * Liquidação atômica: decide e grava settlement/recibo/lançamentos numa transação, sela o vínculo
   * (vencedor, recibo, data) no envelope e só então avança a testemunha. Lote não íntegro não liquida.
   */
  async settleAtomic<T>(lotId: string, decide: (client: PoolClient, head: BidHead) => Promise<SettlementPlan<T>>): Promise<T> {
    return this.exclusive(lotId, async () => {
      await this.assertCanMutate(lotId);
      const key = this.requireKey();
      const current = await this.store.read(lotId);
      if (!current) throw new IntegrityBlockedError("CONFIRMATION_PENDING");
      const state: { next: Checkpoint | null } = { next: null };
      let committed = false;
      try {
        const result = await this.repository.transaction(async (client) => {
          const plan = await decide(client, { count: current.count, revision: current.revision });
          if (plan.kind === "skip") return plan.result;
          const next = seal({ ...withoutEnvelope(current), revision: current.revision + 1, settlement: plan.link }, key);
          await this.store.writePending(next);
          state.next = next;
          return plan.finish(client, next.revision);
        });
        committed = true;
        const pending = state.next;
        if (pending) {
          await this.store.advance(current.revision, pending);
          await this.store.clearPending(lotId);
        }
        return result;
      } catch (error) {
        if (committed) throw new ConfirmationPendingError();
        if (state.next) await this.store.clearPending(lotId);
        throw error;
      }
    });
  }

  /**
   * Cancelamento atômico: decide e grava a nova situação numa transação, sela `cancelled` no envelope
   * e só então avança a testemunha. Assim um `UPDATE lots SET status` direto no banco é detectado.
   */
  async cancelAtomic(lotId: string, decide: (client: PoolClient, revision: number) => Promise<void>): Promise<void> {
    await this.exclusive(lotId, async () => {
      await this.assertCanMutate(lotId);
      const key = this.requireKey();
      const current = await this.store.read(lotId);
      if (!current) throw new IntegrityBlockedError("CONFIRMATION_PENDING");
      const next = seal({ ...withoutEnvelope(current), revision: current.revision + 1, cancelled: true }, key);
      let committed = false;
      try {
        await this.repository.transaction(async (client) => {
          await this.store.writePending(next);
          await decide(client, current.revision);
        });
        committed = true;
        await this.store.advance(current.revision, next);
        await this.store.clearPending(lotId);
      } catch (error) {
        if (committed) throw new ConfirmationPendingError();
        await this.store.clearPending(lotId);
        throw error;
      }
    });
  }

  /**
   * Nova tentativa para toda intenção pendente (startup e `npm run audit:retry`). Confirma a intenção
   * quando o banco confere com ela; descarta quando o banco confere com a testemunha confirmada (a
   * transação não chegou a gravar). Banco divergente dos dois fica bloqueado: nada é reassinado.
   */
  async recoverPending(): Promise<{ confirmed: number; discarded: number; blocked: string[] }> {
    const summary = { confirmed: 0, discarded: 0, blocked: [] as string[] };
    if (!this.key || !this.store.pendingLots) return summary;
    for (const lotId of await this.store.pendingLots()) {
      const outcome = await this.exclusive(lotId, async () => {
        const pending = await this.store.readPending(lotId);
        if (!pending) return "none" as const;
        const history = await this.repository.loadHistory(lotId);
        const committed = await this.store.read(lotId);
        const now = this.clock();
        if (this.classify(history, pending, null, now).status === "INTACT") {
          if (!committed || committed.envelopeSignature !== pending.envelopeSignature) await this.store.advance(committed ? committed.revision : 0, pending);
          await this.store.clearPending(lotId);
          return "confirmed" as const;
        }
        if (committed && this.classify(history, committed, null, now).status === "INTACT") {
          await this.store.clearPending(lotId);
          return "discarded" as const;
        }
        return "blocked" as const;
      }).catch(() => "blocked" as const);
      if (outcome === "confirmed") summary.confirmed += 1;
      if (outcome === "discarded") summary.discarded += 1;
      if (outcome === "blocked") summary.blocked.push(lotId);
    }
    return summary;
  }

  async retryCheckpoint(lotId: string): Promise<void> {
    await this.exclusive(lotId, async () => {
      this.requireKey();
      const pending = await this.store.readPending(lotId);
      if (!pending) {
        throw new Error("sem intenção pendente; não reassinar o banco");
      }
      const history = await this.repository.loadHistory(lotId);
      if (this.classify(history, pending, null, this.clock()).status !== "INTACT") {
        throw new Error("banco não confere com a intenção; não reassinar o banco");
      }
      const committed = await this.store.read(lotId);
      if (committed && committed.revision === pending.revision && committed.envelopeSignature === pending.envelopeSignature) {
        await this.store.clearPending(lotId);
        return;
      }
      await this.store.advance(committed ? committed.revision : 0, pending);
      await this.store.clearPending(lotId);
    });
  }

  async verifyLot(lotId: string): Promise<AuditResult> {
    const verifiedAt = this.clock();
    if (!this.key || this.key.byteLength < 32) {
      return indeterminate("MISSING_KEY", "Chave de verificação ausente.", verifiedAt);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const before = await this.store.read(lotId);
        const pendingBefore = await this.store.readPending(lotId);
        const history = await this.repository.loadHistory(lotId);
        const after = await this.store.read(lotId);
        const pendingAfter = await this.store.readPending(lotId);
        if (!sameCheckpoint(before, after) || !sameCheckpoint(pendingBefore, pendingAfter)) {
          continue;
        }
        return this.classify(history, before, pendingBefore, verifiedAt);
      } catch (error) {
        if (error instanceof Error && error.message === "testemunha ilegível") {
          return indeterminate("WITNESS_UNREADABLE", "Testemunha ilegível.", verifiedAt);
        }
        throw error;
      }
    }
    return indeterminate("CONCURRENT_READ", "Leitura cruzou uma atualização; o resultado não foi fechado.", verifiedAt);
  }

  async assertCanMutate(lotId: string): Promise<void> {
    const verified = await this.verifyLot(lotId);
    if (verified.status !== "INTACT") {
      throw new IntegrityBlockedError(verified.status === "INDETERMINATE" ? "CONFIRMATION_PENDING" : verified.reasonCode);
    }
  }

  private classify(history: LotHistory, checkpoint: Checkpoint | null, pending: Checkpoint | null, verifiedAt: string): AuditResult {
    const key = this.requireKey();
    if (!checkpoint) {
      return indeterminate("MISSING_WITNESS", "Testemunha do lote ausente.", verifiedAt);
    }
    if (!envelopeValid(checkpoint, key)) {
      return indeterminate("WITNESS_UNREADABLE", "Testemunha ilegível.", verifiedAt);
    }
    if (history.ambiguous) {
      return tampered("DUPLICATE_ROW", "Há mais de uma linha para o mesmo lote ou liquidação.", checkpoint, verifiedAt);
    }
    if (pending && pending.revision > checkpoint.revision) {
      return indeterminate("CONFIRMATION_GAP", "Confirmação do lote incompleta.", verifiedAt, checkpoint.revision, null);
    }
    if (!history.lot) {
      return tampered("LOT_REMOVED", "Lote ausente com testemunha remanescente.", checkpoint, verifiedAt);
    }
    if (!genesisValid(checkpoint, key) || !metadataMatches(history.lot, checkpoint)) {
      return tampered("LOT_METADATA_MISMATCH", "Metadados do lote não conferem com a gênese.", checkpoint, verifiedAt);
    }
    const chain = walkChain(history, checkpoint, key);
    if (chain === "broken") {
      return tampered("CHAIN_MISMATCH", "Assinatura ou encadeamento não confere.", checkpoint, verifiedAt);
    }
    if (chain.count < checkpoint.count) {
      return tampered("HISTORY_TRUNCATED", "Histórico menor que a testemunha.", checkpoint, verifiedAt);
    }
    if (chain.count > checkpoint.count || chain.head !== checkpoint.headSignature) {
      return indeterminate("CONFIRMATION_GAP", "Confirmação do lote incompleta.", verifiedAt, checkpoint.revision, null);
    }
    if (history.lot.endsAt !== checkpoint.endsAt || history.lot.revision !== checkpoint.revision || !settlementMatches(history.settlement, checkpoint.settlement)) {
      return tampered("ENVELOPE_MISMATCH", "Extensão ou resultado não conferem com o envelope.", checkpoint, verifiedAt);
    }
    if (history.lot.status !== expectedStatus(checkpoint)) {
      return tampered("STATUS_MISMATCH", "Situação do lote não confere com o envelope.", checkpoint, verifiedAt);
    }
    return {
      status: "INTACT",
      revision: checkpoint.revision,
      count: checkpoint.count,
      verifiedAt,
      reasonCode: "INTACT",
      message: "O histórico confere com a testemunha.",
    };
  }

  private requireKey(): Uint8Array {
    if (!this.key || this.key.byteLength < 32) {
      throw new Error("chave de auditoria ausente");
    }
    return this.key;
  }

  private async exclusive<T>(lotId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(lotId) ?? Promise.resolve();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(lotId, tail);
    await previous;
    try {
      return await action();
    } finally {
      release();
      // Auditoria item 14: sem ninguém na fila, a entrada sai do mapa (não cresce um por lote para sempre).
      if (this.tails.get(lotId) === tail) this.tails.delete(lotId);
    }
  }
}

function nextBody(current: Checkpoint, signature: string, endsAt: string): CheckpointBody {
  return {
    lotId: current.lotId,
    revision: current.revision + 1,
    count: current.count + 1,
    headSignature: signature,
    genesisSignature: current.genesisSignature,
    keyVersion: current.keyVersion,
    endsAt,
    ownerId: current.ownerId,
    snapshotId: current.snapshotId,
    initialCents: current.initialCents,
    incrementCents: current.incrementCents,
    startsAt: current.startsAt,
    genesisEndsAt: current.genesisEndsAt,
    settlement: current.settlement,
    ...(current.cancelled ? { cancelled: true } : {}),
  };
}

function withoutEnvelope(checkpoint: Checkpoint): CheckpointBody {
  const copy: Partial<Checkpoint> = { ...checkpoint };
  delete copy.envelopeSignature;
  return copy as CheckpointBody;
}

function seal(body: CheckpointBody, key: Uint8Array): Checkpoint {
  return { ...body, envelopeSignature: signCheckpoint(body, key) };
}

function genesisFromLot(lot: LotSnapshot): GenesisRecord {
  return {
    lotId: lot.lotId,
    ownerId: lot.ownerId,
    snapshotId: lot.snapshotId,
    initialCents: lot.initialCents,
    incrementCents: lot.incrementCents,
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    keyVersion: 1,
  };
}

function envelopeValid(checkpoint: Checkpoint, key: Uint8Array): boolean {
  const { envelopeSignature, ...body } = checkpoint;
  return signaturesMatch(signCheckpoint(body, key), envelopeSignature);
}

function genesisValid(checkpoint: Checkpoint, key: Uint8Array): boolean {
  const record: GenesisRecord = {
    lotId: checkpoint.lotId,
    ownerId: checkpoint.ownerId,
    snapshotId: checkpoint.snapshotId,
    initialCents: checkpoint.initialCents,
    incrementCents: checkpoint.incrementCents,
    startsAt: checkpoint.startsAt,
    endsAt: checkpoint.genesisEndsAt,
    keyVersion: checkpoint.keyVersion,
  };
  return signaturesMatch(signGenesis(record, key), checkpoint.genesisSignature);
}

function metadataMatches(lot: LotSnapshot, checkpoint: Checkpoint): boolean {
  return (
    lot.lotId === checkpoint.lotId &&
    lot.ownerId === checkpoint.ownerId &&
    lot.snapshotId === checkpoint.snapshotId &&
    lot.initialCents === checkpoint.initialCents &&
    lot.incrementCents === checkpoint.incrementCents &&
    lot.startsAt === checkpoint.startsAt
  );
}

/** A situação do lote não é assinada à parte: decorre do envelope (cancelamento ou liquidação selados). */
function expectedStatus(checkpoint: Checkpoint): string {
  if (checkpoint.cancelled) return "CANCELLED";
  if (checkpoint.settlement) return checkpoint.settlement.winnerBidId ? "SETTLED" : "CLOSED_NO_BIDS";
  return "PUBLISHED";
}

function settlementMatches(actual: SettlementLink | null, expected: SettlementLink | null): boolean {
  if (!actual && !expected) {
    return true;
  }
  if (!actual || !expected) {
    return false;
  }
  return (
    actual.settlementId === expected.settlementId &&
    actual.winnerBidId === expected.winnerBidId &&
    actual.receiptToken === expected.receiptToken &&
    actual.settledAt === expected.settledAt
  );
}

function walkChain(history: LotHistory, checkpoint: Checkpoint, key: Uint8Array): { count: number; head: string } | "broken" {
  let previous = checkpoint.genesisSignature;
  for (let index = 0; index < history.bids.length; index += 1) {
    const stored = history.bids[index];
    if (!stored || stored.sequence !== index + 1 || stored.lotId !== checkpoint.lotId) {
      return "broken";
    }
    const event: CanonicalBid = {
      lotId: stored.lotId,
      bidId: stored.bidId,
      bidderUserId: stored.bidderUserId,
      alias: stored.alias,
      sequence: stored.sequence,
      amountCents: stored.amountCents,
      acceptedAt: stored.acceptedAt,
      previousSignature: previous,
      keyVersion: checkpoint.keyVersion,
    };
    if (!verifyBidSignature(event, stored.signature, key)) {
      return "broken";
    }
    previous = stored.signature;
  }
  return { count: history.bids.length, head: previous };
}

function sameCheckpoint(left: Checkpoint | null, right: Checkpoint | null): boolean {
  if (!left || !right) {
    return left === right;
  }
  return left.revision === right.revision && left.envelopeSignature === right.envelopeSignature && left.count === right.count;
}

function indeterminate(reasonCode: string, message: string, verifiedAt: string, revision: number | null = null, count: number | null = null): AuditResult {
  return { status: "INDETERMINATE", revision, count, verifiedAt, reasonCode, message };
}

function tampered(reasonCode: string, message: string, checkpoint: Checkpoint, verifiedAt: string): AuditResult {
  return {
    status: "TAMPERED",
    revision: checkpoint.revision,
    count: checkpoint.count,
    verifiedAt,
    reasonCode,
    message,
  };
}
