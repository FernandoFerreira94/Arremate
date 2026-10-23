import { createHmac, timingSafeEqual } from "node:crypto";
import type { CanonicalBid, Checkpoint, CheckpointBody, GenesisRecord } from "./audit.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SIGNATURE = /^[0-9a-f]{64}$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const TOKEN = /^[A-Za-z0-9_-]{1,200}$/;
const CHECKPOINT_FIELDS = [
  "lotId",
  "revision",
  "count",
  "headSignature",
  "genesisSignature",
  "keyVersion",
  "endsAt",
  "ownerId",
  "snapshotId",
  "initialCents",
  "incrementCents",
  "startsAt",
  "genesisEndsAt",
  "settlementId",
  "winnerBidId",
  "receiptToken",
  "settledAt",
] as const;

export function canonicalBidBytes(event: CanonicalBid): Buffer {
  assertSupportedVersion(event.keyVersion);
  assertUuid(event.lotId, "lotId");
  assertUuid(event.bidId, "bidId");
  assertUuid(event.bidderUserId, "bidderUserId");
  assertSequence(event.sequence);
  assertCents(event.amountCents, "amountCents");
  assertInstant(event.acceptedAt, "acceptedAt");
  assertSignature(event.previousSignature, "previousSignature");
  if (typeof event.alias !== "string") {
    throw new Error("alias inválido");
  }
  const aliasBytes = Buffer.from(event.alias, "utf8");
  const header =
    "v1\n" +
    `lotId=${event.lotId}\n` +
    `bidId=${event.bidId}\n` +
    `bidderUserId=${event.bidderUserId}\n` +
    `sequence=${event.sequence}\n` +
    `amountCents=${event.amountCents.toString()}\n` +
    `acceptedAt=${event.acceptedAt}\n` +
    `previousSignature=${event.previousSignature}\n` +
    `keyVersion=${event.keyVersion}\n` +
    `aliasBytes=${aliasBytes.length}\n`;
  return Buffer.concat([Buffer.from(header, "utf8"), aliasBytes, Buffer.from("\n", "utf8")]);
}

export function canonicalGenesisBytes(record: GenesisRecord): Buffer {
  assertSupportedVersion(record.keyVersion);
  assertUuid(record.lotId, "lotId");
  assertUuid(record.ownerId, "ownerId");
  assertUuid(record.snapshotId, "snapshotId");
  assertCents(record.initialCents, "initialCents");
  assertCents(record.incrementCents, "incrementCents");
  assertInstant(record.startsAt, "startsAt");
  assertInstant(record.endsAt, "endsAt");
  const body =
    "v1\n" +
    "record=genesis\n" +
    `lotId=${record.lotId}\n` +
    `ownerId=${record.ownerId}\n` +
    `snapshotId=${record.snapshotId}\n` +
    `initialCents=${record.initialCents.toString()}\n` +
    `incrementCents=${record.incrementCents.toString()}\n` +
    `startsAt=${record.startsAt}\n` +
    `endsAt=${record.endsAt}\n` +
    `keyVersion=${record.keyVersion}\n`;
  return Buffer.from(body, "utf8");
}

export function signBid(event: CanonicalBid, previousSignature: string, key: Uint8Array): string {
  if (previousSignature !== event.previousSignature) {
    throw new Error("previousSignature divergente");
  }
  assertKey(key);
  return createHmac("sha256", key).update(canonicalBidBytes(event)).digest("hex");
}

export function signGenesis(record: GenesisRecord, key: Uint8Array): string {
  assertKey(key);
  return createHmac("sha256", key).update(canonicalGenesisBytes(record)).digest("hex");
}

export function canonicalCheckpointBytes(body: CheckpointBody): Buffer {
  assertSupportedVersion(body.keyVersion);
  assertUuid(body.lotId, "lotId");
  assertUuid(body.ownerId, "ownerId");
  assertUuid(body.snapshotId, "snapshotId");
  assertRevision(body.revision, "revision");
  assertRevision(body.count, "count");
  assertSignature(body.headSignature, "headSignature");
  assertSignature(body.genesisSignature, "genesisSignature");
  assertInstant(body.endsAt, "endsAt");
  assertCents(body.initialCents, "initialCents");
  assertCents(body.incrementCents, "incrementCents");
  assertInstant(body.startsAt, "startsAt");
  assertInstant(body.genesisEndsAt, "genesisEndsAt");
  const settlement = settlementFields(body);
  const text =
    "v1\n" +
    "record=checkpoint\n" +
    `lotId=${body.lotId}\n` +
    `revision=${body.revision}\n` +
    `count=${body.count}\n` +
    `headSignature=${body.headSignature}\n` +
    `genesisSignature=${body.genesisSignature}\n` +
    `keyVersion=${body.keyVersion}\n` +
    `endsAt=${body.endsAt}\n` +
    `ownerId=${body.ownerId}\n` +
    `snapshotId=${body.snapshotId}\n` +
    `initialCents=${body.initialCents.toString()}\n` +
    `incrementCents=${body.incrementCents.toString()}\n` +
    `startsAt=${body.startsAt}\n` +
    `genesisEndsAt=${body.genesisEndsAt}\n` +
    `settlementId=${settlement.settlementId}\n` +
    `winnerBidId=${settlement.winnerBidId}\n` +
    `receiptToken=${settlement.receiptToken}\n` +
    `settledAt=${settlement.settledAt}\n`;
  return Buffer.from(text, "utf8");
}

export function signCheckpoint(body: CheckpointBody, key: Uint8Array): string {
  assertKey(key);
  return createHmac("sha256", key).update(canonicalCheckpointBytes(body)).digest("hex");
}

export function encodeCheckpoint(checkpoint: Checkpoint): Buffer {
  const { envelopeSignature, ...body } = checkpoint;
  assertSignature(envelopeSignature, "envelopeSignature");
  return Buffer.concat([canonicalCheckpointBytes(body), Buffer.from(`envelopeSignature=${envelopeSignature}\n`, "utf8")]);
}

export function parseCheckpoint(bytes: Buffer): Checkpoint {
  const text = bytes.toString("utf8");
  const marker = "\nenvelopeSignature=";
  const index = text.lastIndexOf(marker);
  if (index < 0 || !text.endsWith("\n")) {
    throw new Error("testemunha ilegível");
  }
  const envelopeSignature = text.slice(index + marker.length, -1);
  const body = parseCheckpointBody(text.slice(0, index + 1));
  assertSignature(envelopeSignature, "envelopeSignature");
  return { ...body, envelopeSignature };
}

export function verifyBidSignature(event: CanonicalBid, signature: string, key: Uint8Array): boolean {
  const expected = signBid(event, event.previousSignature, key);
  return signaturesMatch(expected, signature);
}

export function signaturesMatch(expected: string, actual: string): boolean {
  if (!SIGNATURE.test(expected) || !SIGNATURE.test(actual)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

function assertSupportedVersion(keyVersion: number): void {
  if (keyVersion !== 1) {
    throw new Error("keyVersion não suportada");
  }
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength < 32) {
    throw new Error("chave de auditoria curta");
  }
}

function assertUuid(value: string, field: string): void {
  if (!UUID.test(value)) {
    throw new Error(`${field} inválido`);
  }
}

function assertSequence(sequence: number): void {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence inválida");
  }
}

function assertCents(value: bigint, field: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw new Error(`${field} inválido`);
  }
}

function assertInstant(value: string, field: string): void {
  if (!INSTANT.test(value)) {
    throw new Error(`${field} inválido`);
  }
}

function assertSignature(value: string, field: string): void {
  if (!SIGNATURE.test(value)) {
    throw new Error(`${field} inválido`);
  }
}

function assertRevision(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} inválido`);
  }
}

function settlementFields(body: CheckpointBody): {
  settlementId: string;
  winnerBidId: string;
  receiptToken: string;
  settledAt: string;
} {
  if (!body.settlement) {
    return { settlementId: "-", winnerBidId: "-", receiptToken: "-", settledAt: "-" };
  }
  assertUuid(body.settlement.settlementId, "settlementId");
  if (body.settlement.winnerBidId !== null) {
    assertUuid(body.settlement.winnerBidId, "winnerBidId");
  }
  if (body.settlement.receiptToken !== null && !TOKEN.test(body.settlement.receiptToken)) {
    throw new Error("receiptToken inválido");
  }
  assertInstant(body.settlement.settledAt, "settledAt");
  return {
    settlementId: body.settlement.settlementId,
    winnerBidId: body.settlement.winnerBidId ?? "-",
    receiptToken: body.settlement.receiptToken ?? "-",
    settledAt: body.settlement.settledAt,
  };
}

function parseCheckpointBody(bodyText: string): CheckpointBody {
  const lines = bodyText.split("\n");
  if (lines.at(-1) !== "") {
    throw new Error("testemunha ilegível");
  }
  lines.pop();
  if (lines.length !== CHECKPOINT_FIELDS.length + 2 || lines[0] !== "v1" || lines[1] !== "record=checkpoint") {
    throw new Error("testemunha ilegível");
  }
  const values = new Map<string, string>();
  for (let index = 0; index < CHECKPOINT_FIELDS.length; index += 1) {
    const name = CHECKPOINT_FIELDS[index];
    const line = lines[index + 2] ?? "";
    const prefix = `${name}=`;
    if (!line.startsWith(prefix)) {
      throw new Error("testemunha ilegível");
    }
    values.set(name, line.slice(prefix.length));
  }
  const settlementId = requiredField(values, "settlementId");
  const winnerBidId = requiredField(values, "winnerBidId");
  const receiptToken = requiredField(values, "receiptToken");
  const settledAt = requiredField(values, "settledAt");
  const empty = settlementId === "-" && winnerBidId === "-" && receiptToken === "-" && settledAt === "-";
  return {
    lotId: requiredField(values, "lotId"),
    revision: parseInteger(requiredField(values, "revision")),
    count: parseInteger(requiredField(values, "count")),
    headSignature: requiredField(values, "headSignature"),
    genesisSignature: requiredField(values, "genesisSignature"),
    keyVersion: parseInteger(requiredField(values, "keyVersion")),
    endsAt: requiredField(values, "endsAt"),
    ownerId: requiredField(values, "ownerId"),
    snapshotId: requiredField(values, "snapshotId"),
    initialCents: parseCents(requiredField(values, "initialCents")),
    incrementCents: parseCents(requiredField(values, "incrementCents")),
    startsAt: requiredField(values, "startsAt"),
    genesisEndsAt: requiredField(values, "genesisEndsAt"),
    settlement: empty
      ? null
      : {
          settlementId,
          winnerBidId: winnerBidId === "-" ? null : winnerBidId,
          receiptToken: receiptToken === "-" ? null : receiptToken,
          settledAt,
        },
  };
}

function requiredField(values: ReadonlyMap<string, string>, name: string): string {
  const value = values.get(name);
  if (value === undefined) {
    throw new Error("testemunha ilegível");
  }
  return value;
}

function parseInteger(value: string): number {
  if (!INTEGER.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("testemunha ilegível");
  }
  return Number(value);
}

function parseCents(value: string): bigint {
  if (!INTEGER.test(value)) {
    throw new Error("testemunha ilegível");
  }
  return BigInt(value);
}
