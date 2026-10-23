import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { ApiException } from "../auth/api.exception";
import { DatabaseRepository } from "../database/database.repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_RESPONSE_BYTES = 32 * 1024;

export type IdempotencyScope = {
  userId: string;
  operation: string;
  resourceKey: string;
  key: string;
  requestHash: string;
};

export function parseIdempotencyKey(raw: string | undefined): string {
  if (typeof raw !== "string" || !UUID.test(raw)) throw new ApiException(400, "IDEMPOTENCIA_INVALIDA");
  return raw.toLowerCase();
}

export function requestDigest(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function withIdempotency<T extends object>(
  database: DatabaseRepository,
  scope: IdempotencyScope,
  work: (client: PoolClient) => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  return database.transaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `${scope.userId}|${scope.operation}|${scope.resourceKey}|${scope.key}`,
    ]);
    const previous = await client.query<{ request_hash: string; response: T }>(
      `SELECT request_hash, response FROM idempotency_records
       WHERE user_id = $1 AND operation = $2 AND resource_key = $3 AND idempotency_key = $4`,
      [scope.userId, scope.operation, scope.resourceKey, scope.key],
    );
    const row = previous.rows[0];
    if (row) {
      if (row.request_hash !== scope.requestHash) throw new ApiException(409, "IDEMPOTENCIA_CONFLITO");
      return { result: row.response, replayed: true };
    }
    const result = await work(client);
    const response = JSON.stringify(result);
    if (Buffer.byteLength(response, "utf8") > MAX_RESPONSE_BYTES) throw new Error("resposta idempotente grande demais");
    await client.query(
      `INSERT INTO idempotency_records (user_id, operation, resource_key, idempotency_key, request_hash, response)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [scope.userId, scope.operation, scope.resourceKey, scope.key, scope.requestHash, response],
    );
    return { result, replayed: false };
  });
}
