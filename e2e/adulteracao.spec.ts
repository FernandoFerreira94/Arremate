import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { apiAs, deposit, publishLot } from "./support/api-session";
import { e2eDatabaseUrl } from "./support/e2e-env";
import { markTourSeen } from "./support/tour";

/**
 * Auditoria itens 6 e 3: o caminho completo do diferencial. SQL direto no banco, página pública
 * mostrando "Adulterado", lance recusado com LOTE_BLOQUEADO e a sala dizendo que o lote não liquida.
 */
test("adulteração direto no banco: auditoria acusa, lance é recusado e a sala mostra o bloqueio", async ({ page }) => {
  const pool = new Pool({ connectionString: e2eDatabaseUrl(process.env.TEST_DATABASE_URL), max: 1 });
  try {
    const seller = await apiAs("auctioneer");
    const bidder = await apiAs("bidder");
    const rival = await apiAs("bidder2");
    const lotId = await publishLot(seller, { endsInMs: 10 * 60_000 });
    await deposit(bidder, "50000");
    await bidder.post(`/api/lots/${lotId}/bids`, { amountCents: "10000" });

    await markTourSeen(page);
    await page.goto(`/lotes/${lotId}/auditoria`);
    await expect(page.getByText("Íntegro.")).toBeVisible();

    await pool.query(`UPDATE bids SET amount_cents = amount_cents + 1 WHERE lot_id = $1`, [lotId]);
    await page.reload();
    await expect(page.getByText("Adulterado.")).toBeVisible();

    const csrf = ((await (await rival.ctx.get("/api/auth/csrf")).json()) as { csrfToken: string }).csrfToken;
    const refused = await rival.ctx.post(`/api/lots/${lotId}/bids`, {
      data: { amountCents: "20000" },
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe("LOTE_BLOQUEADO");

    // Encerrado e adulterado: a liquidação não roda e a sala explica, em vez de prometer o comprovante.
    await pool.query(`UPDATE lots SET starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 minute' WHERE id = $1`, [lotId]);
    await page.goto(`/lotes/${lotId}`);
    await expect(page.getByText(/Bloqueado pela auditoria/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/o comprovante aparece em instantes/)).toHaveCount(0);
    const status = await pool.query<{ status: string }>(`SELECT status::text AS status FROM lots WHERE id = $1`, [lotId]);
    expect(status.rows[0]?.status).toBe("PUBLISHED");
  } finally {
    await pool.end();
  }
});
