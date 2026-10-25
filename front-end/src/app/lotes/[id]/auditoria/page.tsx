import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditPage } from "@/features/lots/audit-page";
import { pageMetadata } from "@/lib/page-metadata";
import { fetchPublicLotMeta } from "@/lib/public-lot";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lot = await fetchPublicLotMeta(id);
  if (!lot) notFound();
  return pageMetadata({ title: `Auditoria · ${lot.title}`, description: `Verificação pública do histórico de lances de ${lot.title}.`, path: `/lotes/${id}/auditoria` });
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!(await fetchPublicLotMeta(id))) notFound();
  return <AuditPage lotId={id.toLowerCase()} />;
}
