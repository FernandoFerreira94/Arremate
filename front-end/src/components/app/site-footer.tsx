import Link from "next/link";

/**
 * F3-cor (D21): fundo --primary, textos em primary-foreground, títulos e crédito a 80 %, frase em Fraunces com a 2ª linha em
 * latão (--accent) e filete em accent. LEGAL usa Regras e Auditoria porque ainda não há páginas de Termos e Privacidade.
 */
const GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Leilão", links: [{ label: "Como funciona", href: "/como-funciona" }, { label: "FAQ", href: "/suporte" }] },
  { title: "Minha conta", links: [{ label: "Perfil", href: "/perfil" }, { label: "Carteira", href: "/carteira" }, { label: "Favoritos", href: "/favoritos" }] },
  { title: "Ajuda", links: [{ label: "Suporte", href: "/suporte" }] },
  { title: "Legal", links: [{ label: "Regras do leilão", href: "/como-funciona#regras" }, { label: "Auditoria", href: "/como-funciona#auditoria" }] },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 py-10 lg:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="flex flex-col items-start gap-4">
            <p className="font-serif text-2xl font-semibold leading-snug lg:text-[28px]">
              Cada lance, registrado.
              <br />
              <span className="text-accent">Cada obra, de domínio público.</span>
            </p>
            <span className="inline-flex rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Demonstração · valores simulados</span>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{group.title}</p>
                <ul className="mt-2 flex flex-col">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-primary-foreground underline-offset-4 hover:underline md:min-h-8">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-accent pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2.5" aria-label="Arremate, voltar à vitrine">
            <span aria-hidden className="grid size-8 place-items-center rounded-md border border-accent font-serif text-lg font-bold leading-none">A</span>
            <span className="font-serif text-xl font-semibold">Arremate</span>
          </Link>
          <p className="text-xs opacity-80">Obras: domínio público (CC0) · The Metropolitan Museum of Art Open Access · valores simulados · horário de Brasília (UTC−3)</p>
        </div>
      </div>
    </footer>
  );
}
