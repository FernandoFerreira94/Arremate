import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between lg:px-10">
        <p>Arremate — demonstração técnica. Obras de acervo público (The Met Open Access, CC0); nenhuma obra está à venda.</p>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/como-funciona" className="hover:text-foreground hover:underline">Como funciona</Link>
          <Link href="/como-funciona#regras" className="hover:text-foreground hover:underline">Regras</Link>
          <Link href="/suporte" className="hover:text-foreground hover:underline">Suporte</Link>
          <span>Valores simulados · horário de Brasília (UTC−3)</span>
        </nav>
      </div>
    </footer>
  );
}
