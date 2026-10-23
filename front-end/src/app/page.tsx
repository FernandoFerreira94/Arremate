import { Suspense } from "react";
import { ShowcasePage } from "@/features/lots/showcase-page";
import { pageMetadata } from "@/lib/page-metadata";

const base = pageMetadata({
  title: "Arremate — demonstração",
  description: "Leilões simulados de obras de acervo público do The Met: lotes ao vivo, agendados e encerrados.",
  path: "/",
});
// Na raiz o template do layout não se aplica; título absoluto para não duplicar a marca.
export const metadata = { ...base, title: { absolute: "Arremate — demonstração" } };

export default function HomePage() {
  return (
    <Suspense>
      <ShowcasePage />
    </Suspense>
  );
}
