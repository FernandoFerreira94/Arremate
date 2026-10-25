import type { Page } from "@playwright/test";

/**
 * R12: o tour abre no primeiro login e cobriria a página nos outros testes.
 * Marca como visto qualquer chave arremate.tour.v1.<userId> antes de o app carregar (o id só existe no servidor).
 * O teste dedicado do tour não chama isto.
 */
export async function markTourSeen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(this: Storage, key: string) {
      const value = original.call(this, key);
      if (value === null && key.startsWith("arremate.tour.v1.")) return "e2e";
      return value;
    };
  });
}
