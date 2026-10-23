import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptPage } from "@/features/lots/receipt-page";

type Props = { params: Promise<{ token: string }> };

/** Token não vai para canonical/OG: o preview não pode espalhar o link nem dados do arremate. */
export const metadata: Metadata = {
  title: "Comprovante de arremate",
  description: "Comprovante simulado de arremate com verificação de auditoria.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  return <ReceiptPage token={token} />;
}
