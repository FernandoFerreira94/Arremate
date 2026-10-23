import { createHash } from "node:crypto";
import { ApiException } from "../auth/api.exception";
import type { AuditService } from "../audit/audit.service";
import type { AuditStatus } from "../audit/audit.types";
import type { MoneyText } from "../common/money";
import { ReceiptsRepository } from "./receipts.repository";

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
/** O vendedor não tem nome público; o comprovante usa o papel, nunca e-mail ou ID. */
export const SELLER_PUBLIC_ALIAS = "Leiloeiro Arremate";

export type PublicReceipt = {
  code: string;
  simulated: true;
  valid: boolean;
  lotId: string;
  artwork: { externalId: string; title: string; artist: string; credit: string; license: string; imageUrl: string };
  winnerAlias: string;
  sellerAlias: string;
  amountCents: MoneyText;
  startsAt: string;
  endsAt: string;
  settledAt: string;
  audit: { status: AuditStatus; verifiedAt: string; message: string };
};

export class ReceiptsService {
  constructor(
    private readonly receipts: ReceiptsRepository,
    private readonly audit: AuditService | null,
  ) {}

  /** O token só localiza o documento; não autentica ninguém. Validade vem da auditoria do lote. */
  async getReceipt(token: string): Promise<PublicReceipt> {
    if (typeof token !== "string" || !TOKEN.test(token)) throw new ApiException(404, "NAO_ENCONTRADO");
    const row = await this.receipts.findByToken(token);
    if (!row) throw new ApiException(404, "NAO_ENCONTRADO");
    const verified = this.audit
      ? await this.audit.verifyLot(row.lot_id)
      : { status: "INDETERMINATE" as const, verifiedAt: new Date().toISOString(), message: "Verificação indisponível." };
    const artist = typeof row.attributes?.artist === "string" ? row.attributes.artist : "";
    return {
      code: `ARR-${createHash("sha256").update(token).digest("hex").slice(0, 10).toUpperCase()}`,
      simulated: true,
      valid: verified.status === "INTACT",
      lotId: row.lot_id,
      artwork: { externalId: row.external_id, title: row.title, artist, credit: row.credit, license: row.license, imageUrl: `/api/media/${row.media_key}` },
      winnerAlias: row.winner_alias,
      sellerAlias: SELLER_PUBLIC_ALIAS,
      amountCents: row.amount_cents,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      settledAt: row.settled_at.toISOString(),
      audit: { status: verified.status, verifiedAt: verified.verifiedAt, message: verified.message },
    };
  }
}
