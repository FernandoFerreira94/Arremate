import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between lg:px-10">
        <nav aria-label="Sobre a demonstração" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/termos" className="inline-flex min-h-11 items-center underline underline-offset-4">Termos de uso</Link>
          <Link href="/privacidade" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacidade</Link>
          <Link href="/como-funciona" className="inline-flex min-h-11 items-center underline underline-offset-4">Como funciona a demonstração</Link>
        </nav>
        <p>Obras: The Met Open Access (CC0) · valores simulados · horário de Brasília (UTC−3)</p>
      </div>
    </footer>
  );
}
