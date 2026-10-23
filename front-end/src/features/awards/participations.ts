export type Outcome = "LEADING" | "OUTBID" | "PENDING" | "WON" | "LOST" | "CANCELLED";

const LABELS: Record<Outcome, string> = {
  LEADING: "Liderando",
  OUTBID: "Superado",
  PENDING: "Apurando resultado",
  WON: "Arrematado",
  LOST: "Não arrematado",
  CANCELLED: "Cancelado",
};

export function outcomeLabel(outcome: Outcome): string {
  return LABELS[outcome];
}

/** Vitórias vêm só de /me/awards (liquidadas). Aqui separa disputas abertas das encerradas. */
export function splitParticipations<T extends { outcome: Outcome }>(rows: T[]): { open: T[]; finished: T[] } {
  return {
    open: rows.filter((row) => row.outcome === "LEADING" || row.outcome === "OUTBID"),
    finished: rows.filter((row) => row.outcome !== "LEADING" && row.outcome !== "OUTBID"),
  };
}
