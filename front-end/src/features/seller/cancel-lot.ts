import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api-error";

const MESSAGES: Record<string, string> = {
  LOTE_COM_LANCES: "Não deu para cancelar: o lote recebeu um lance. A lista foi atualizada.",
  LOTE_NAO_CANCELAVEL: "Este lote já não pode ser cancelado. A lista foi atualizada.",
};

/** Cancela e sempre refaz a lista do painel, inclusive quando o back recusa (corrida com lance). */
export async function cancelWithRefresh(
  client: QueryClient,
  cancel: (lotId: string) => Promise<unknown>,
  lotId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await cancel(lotId);
    return { ok: true };
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "";
    return { ok: false, message: MESSAGES[code] ?? "Não foi possível cancelar agora. Tente de novo." };
  } finally {
    await client.invalidateQueries({ queryKey: ["seller"] });
  }
}
