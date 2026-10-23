import { apiFetch } from "../../lib/api";
import type { Outcome } from "./participations";

export type ListPage<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Participation = {
  lotId: string;
  title: string;
  imageUrl: string;
  endsAt: string;
  myTopCents: string;
  currentCents: string | null;
  outcome: Outcome;
  receiptToken: string | null;
};
export type Award = { lotId: string; title: string; imageUrl: string; amountCents: string; settledAt: string; receiptToken: string };

export async function listParticipations(page = 1): Promise<ListPage<Participation>> {
  return (await apiFetch(`/api/me/participations?page=${page}`)) as ListPage<Participation>;
}

export async function listAwards(page = 1): Promise<ListPage<Award>> {
  return (await apiFetch(`/api/me/awards?page=${page}`)) as ListPage<Award>;
}
