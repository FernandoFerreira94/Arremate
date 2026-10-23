import { brtInputToUtcIso } from "../../lib/datetime";
import { parseBrlInput } from "../../lib/money";

export type PublishForm = { initial: string; increment: string; startsAt: string; endsAt: string };
export type PublishBody = { externalId: string; initialCents: string; incrementCents: string; startsAt: string; endsAt: string };
export type PublishErrors = Partial<Record<keyof PublishForm | "item", string>>;

/** Monta o corpo com os cinco campos aceitos. Título, autor e imagem vêm do snapshot no back. */
export function buildPublishBody(
  form: PublishForm,
  selected: { externalId: string } | null,
): { ok: true; body: PublishBody } | { ok: false; errors: PublishErrors } {
  const errors: PublishErrors = {};
  if (!selected) errors.item = "Escolha uma obra do catálogo.";
  const initial = parseBrlInput(form.initial);
  if (!initial.ok || initial.cents === "0") errors.initial = initial.ok ? "O lance inicial precisa ser maior que zero." : initial.message;
  const increment = parseBrlInput(form.increment);
  if (!increment.ok || increment.cents === "0") errors.increment = increment.ok ? "O incremento precisa ser maior que zero." : increment.message;
  const startsAt = brtInputToUtcIso(form.startsAt);
  const endsAt = brtInputToUtcIso(form.endsAt);
  if (!startsAt) errors.startsAt = "Informe data e hora de início.";
  if (!endsAt) errors.endsAt = "Informe data e hora de fim.";
  else if (startsAt && endsAt <= startsAt) errors.endsAt = "O fim precisa ser depois do início.";
  if (Object.keys(errors).length > 0 || !selected || !initial.ok || !increment.ok || !startsAt || !endsAt) return { ok: false, errors };
  return { ok: true, body: { externalId: selected.externalId, initialCents: initial.cents, incrementCents: increment.cents, startsAt, endsAt } };
}
