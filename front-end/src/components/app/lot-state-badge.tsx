import { Badge } from "@/components/ui/badge";

export type LotState = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export function LotStateBadge({ state }: { state: LotState }) {
  if (state === "LIVE") return <Badge variant="live"><span aria-hidden className="size-1.5 rounded-full bg-live" />Ao vivo</Badge>;
  if (state === "SCHEDULED") return <Badge variant="scheduled">Agendado</Badge>;
  if (state === "CANCELLED") return <Badge variant="neutral">Cancelado</Badge>;
  return <Badge variant="ended">Encerrado</Badge>;
}
