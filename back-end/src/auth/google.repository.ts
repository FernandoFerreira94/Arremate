import { DatabaseRepository } from "../database/database.repository";
import { ApiException } from "./api.exception";
import type { GoogleIdentity } from "./google-token";
import type { Role } from "./return-to";

export type OAuthState = { state_hash: string; browser_hash: string; code_verifier: string; nonce: string; return_to: string | null; user_id: string | null; session_hash: string | null };
export class GoogleRepository {
  constructor(private readonly database: DatabaseRepository) {}

  async start(state: OAuthState): Promise<void> {
    await this.database.transaction(async client => {
      await client.query(`DELETE FROM oauth_states WHERE expires_at <= statement_timestamp()`);
      await client.query(`INSERT INTO oauth_states (state_hash,browser_hash,code_verifier,nonce,return_to,user_id,session_hash,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,statement_timestamp()+interval '10 minutes')`,
      [state.state_hash,state.browser_hash,state.code_verifier,state.nonce,state.return_to,state.user_id,state.session_hash]);
    });
  }

  async consume(stateHash: string, browserHash: string): Promise<OAuthState | null> {
    const result = await this.database.query<OAuthState>(`DELETE FROM oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>statement_timestamp() RETURNING *`, [stateHash,browserHash]);
    return result.rows[0] ?? null;
  }

  async identity(identity: GoogleIdentity, linkingUserId: string | null): Promise<{ id: string; role: Role }> {
    return this.database.transaction(async client => {
      // Serializa a resolução do mesmo subject/e-mail entre callbacks concorrentes.
      for (const scope of [`google:${identity.subject}`, `google-email:${identity.email}`].sort()) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [scope]);
      }
      const linked = await client.query<{ id: string; role: Role }>(`SELECT id,role FROM users WHERE google_subject=$1 FOR UPDATE`, [identity.subject]);
      if (linked.rows[0]) {
        if (linkingUserId && linked.rows[0].id !== linkingUserId) throw new ApiException(400,"GOOGLE_RECUSADO");
        return linked.rows[0];
      }
      const existing = await client.query<{ id: string; role: Role; google_subject: string | null }>(`SELECT id,role,google_subject FROM users WHERE email=$1 FOR UPDATE`, [identity.email]);
      const user = existing.rows[0];
      if (user) {
        if (!linkingUserId || user.id !== linkingUserId || user.google_subject) throw new ApiException(400,"GOOGLE_RECUSADO");
        await client.query(`UPDATE users SET google_subject=$1 WHERE id=$2`, [identity.subject,user.id]);
        return { id: user.id, role: user.role };
      }
      if (linkingUserId) throw new ApiException(400,"GOOGLE_RECUSADO");
      const created = await client.query<{ id: string; role: Role }>(`INSERT INTO users (name,email,role,google_subject) VALUES ($1,$2,'BIDDER',$3) RETURNING id,role`, [identity.name,identity.email,identity.subject]);
      return created.rows[0];
    });
  }
}
