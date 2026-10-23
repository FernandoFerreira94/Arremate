import { Injectable, Logger } from "@nestjs/common";
import type { QueryResult, QueryResultRow } from "pg";
import { ApiException } from "./api.exception";
import { DatabaseRepository } from "../database/database.repository";
import type { Role } from "./return-to";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredUser = { id: string; role: Role; passwordHash: string };
export type StoredActor = { userId: string; role: Role };

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly database: DatabaseRepository) {}

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.read<{ id: string; role: string; password_hash: string }>(
      `SELECT id, role, password_hash FROM users WHERE email = $1`,
      [email],
    );
    if ((result.rowCount ?? 0) !== 1) return null;
    const row = result.rows[0];
    if (!row || !isRole(row.role)) return null;
    return { id: row.id, role: row.role, passwordHash: row.password_hash };
  }

  async createSession(userId: string, tokenHash: string): Promise<void> {
    if (!UUID.test(userId)) throw new ApiException(401, "SESSAO_NECESSARIA");
    await this.read(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, statement_timestamp() + interval '8 hours')`,
      [userId, tokenHash],
    );
  }

  async findActiveSession(tokenHash: string): Promise<StoredActor | null> {
    const result = await this.read<{ user_id: string; role: string }>(
      `SELECT u.id AS user_id, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > statement_timestamp()`,
      [tokenHash],
    );
    if ((result.rowCount ?? 0) !== 1) return null;
    const row = result.rows[0];
    if (!row || !isRole(row.role)) return null;
    return { userId: row.user_id, role: row.role };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.read(
      `UPDATE sessions SET revoked_at = statement_timestamp()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async findLotOwner(lotId: string): Promise<string | null> {
    if (!UUID.test(lotId)) return null;
    const result = await this.read<{ owner_id: string }>(`SELECT owner_id FROM lots WHERE id = $1`, [lotId]);
    if ((result.rowCount ?? 0) !== 1) return null;
    return result.rows[0]?.owner_id ?? null;
  }

  private async read<T extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<QueryResult<T>> {
    try {
      return await this.database.query<T>(text, values);
    } catch {
      this.logger.error("Falha ao consultar a sessão.");
      throw new ApiException(503, "BANCO_INDISPONIVEL");
    }
  }
}

function isRole(value: string): value is Role {
  return value === "AUCTIONEER" || value === "BIDDER";
}
