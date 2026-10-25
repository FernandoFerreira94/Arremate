import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LotRoomPage } from "@/features/lots/lot-room-page";
import { pageMetadata } from "@/lib/page-metadata";
import { fetchPublicLotMeta } from "@/lib/public-lot";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lot = await fetchPublicLotMeta(id);
  if (!lot) notFound();
  return pageMetadata({ title: lot.title, description: `Sala do lote ${lot.title}${lot.artist ? `, de ${lot.artist}` : ""}. Leilão simulado de obra de acervo público.`, path: `/lotes/${id}` });
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!(await fetchPublicLotMeta(id))) notFound();
  return <LotRoomPage lotId={id.toLowerCase()} />;
}
