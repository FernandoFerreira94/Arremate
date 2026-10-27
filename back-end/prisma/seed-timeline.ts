/**
 * Linha do tempo realista para a DEMO (pedido do Fernando, 27/10/2026): os lances do seed são dados pelo
 * serviço normal, todos no mesmo minuto. Aqui o seed, que é o autor da gênese, recua o início do lote e
 * espalha os horários dos lances; em seguida reassina gênese, cadeia e envelope com a mesma chave, pela
 * mesma ordem da confirmação (pending → commit → checkpoint). Uso exclusivo do seed: a API nunca reassina.
 */
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { signBid, signCheckpoint, signGenesis } from "../src/audit/audit-chain";
import type { CanonicalBid, Checkpoint, CheckpointBody } from "../src/audit/audit.types";
import type { CheckpointStore } from "../src/audit/checkpoint-store";

export type TimelineSigner = { key: Uint8Array; store: CheckpointStore };

const SECOND = 1000;

/** Pseudoaleatório estável por lote: reexecutar dá os mesmos horários. */
function unit(seed: string, index: number): number {
  return createHash("sha256").update(`${seed}|${index}`).digest().readUInt32BE(0) / 0xffffffff;
}

/**
 * Horários crescentes entre `startMs` e `lastMs`: mais espaçados no começo e mais próximos no fim,
 * como um leilão de verdade, com segundos variados e pelo menos 20 s entre lances.
 */
export function spreadBidTimes(seed: string, startMs: number, lastMs: number, n: number): number[] {
  if (n <= 0) return [];
  const span = lastMs - startMs;
  if (span < n * 90 * SECOND) throw new Error("janela curta demais para espalhar os lances");
  const times: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const position = n === 1 ? 1 : i / (n - 1);
    const eased = Math.pow(position, 0.55);
    const jitter = (unit(seed, i) - 0.5) * (span / n) * 0.6;
    let t = Math.round(startMs + span * (0.08 + 0.92 * eased) + (i === n - 1 ? 0 : jitter));
    if (i > 0) t = Math.max(t, (times[i - 1] as number) + 20 * SECOND + Math.round(unit(seed, i + 100) * 40 * SECOND));
    times.push(t);
  }
  const overflow = (times[n - 1] as number) - lastMs;
  return overflow > 0 ? times.map((t) => t - overflow) : times;
}

type BidRow = { id: string; user_id: string; alias: string; sequence: number; amount_cents: string };

/** Recua o início do lote para `startsAt` e redistribui os horários dos lances até `lastBidAt`, mantendo a auditoria íntegra. */
export async function backdateLotHistory(pool: Pool, signer: TimelineSigner, lotId: string, startsAt: Date, lastBidAt: Date): Promise<void> {
  const current = await signer.store.read(lotId);
  if (!current) throw new Error("lote sem testemunha");
  const bids = (await pool.query<BidRow>(`SELECT id, user_id, alias, sequence, amount_cents::text AS amount_cents FROM bids WHERE lot_id = $1 ORDER BY sequence`, [lotId])).rows;
  const times = spreadBidTimes(lotId, startsAt.getTime(), lastBidAt.getTime(), bids.length).map((t) => new Date(t).toISOString());
  const startsIso = startsAt.toISOString();
  const genesisSignature = signGenesis(
    {
      lotId,
      ownerId: current.ownerId,
      snapshotId: current.snapshotId,
      initialCents: current.initialCents,
      incrementCents: current.incrementCents,
      startsAt: startsIso,
      endsAt: current.genesisEndsAt,
      keyVersion: current.keyVersion,
    },
    signer.key,
  );
  let previous = genesisSignature;
  const signatures = bids.map((bid, index) => {
    const event: CanonicalBid = {
      lotId,
      bidId: bid.id,
      bidderUserId: bid.user_id,
      alias: bid.alias,
      sequence: bid.sequence,
      amountCents: BigInt(bid.amount_cents),
      acceptedAt: times[index] as string,
      previousSignature: previous,
      keyVersion: current.keyVersion,
    };
    previous = signBid(event, previous, signer.key);
    return previous;
  });
  const body: CheckpointBody = { ...current, revision: current.revision + 1, startsAt: startsIso, genesisSignature, headSignature: previous };
  delete (body as Partial<Checkpoint>).envelopeSignature;
  const next: Checkpoint = { ...body, envelopeSignature: signCheckpoint(body, signer.key) };

  await signer.store.writePending(next);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(`UPDATE lots SET starts_at = $2, revision = $3 WHERE id = $1 AND revision = $4`, [lotId, startsIso, next.revision, current.revision]);
    if (updated.rowCount !== 1) throw new Error("lote mudou durante o ajuste da linha do tempo");
    for (const [index, bid] of bids.entries()) {
      await client.query(`UPDATE bids SET accepted_at = $2, signature = $3 WHERE id = $1`, [bid.id, times[index], signatures[index]]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await signer.store.clearPending(lotId);
    throw error;
  } finally {
    client.release();
  }
  await signer.store.advance(current.revision, next);
  await signer.store.clearPending(lotId);
}
