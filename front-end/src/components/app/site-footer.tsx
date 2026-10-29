import Image from "next/image";
import Link from "next/link";
import { DEMO_VIDEO_URL } from "@/lib/demo-video";
import { InstallAppButton } from "./pwa";

/**
 * F3-cor (D22): fundo --brand, textos em brand-foreground (iguais nos dois temas), títulos e crédito a 80 %, frase em Fraunces com a 2ª linha em
 * latão (--accent) e filete em accent. LEGAL traz Termos e Privacidade (páginas do Codex) e as âncoras de Regras e Auditoria.
 */
const GROUPS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Leilão",
    links: [
      { label: "Como funciona a demonstração", href: "/como-funciona" },
      { label: "FAQ", href: "/suporte" },
      // Link discreto para o vídeo comercial hospedado no GitHub (abre em nova aba).
      { label: "Vídeo de demonstração", href: DEMO_VIDEO_URL, external: true },
    ],
  },
  { title: "Minha conta", links: [{ label: "Perfil", href: "/perfil" }, { label: "Carteira", href: "/carteira" }, { label: "Favoritos", href: "/favoritos" }] },
  { title: "Ajuda", links: [{ label: "Suporte", href: "/suporte" }] },
  { title: "Legal", links: [{ label: "Termos de uso", href: "/termos" }, { label: "Privacidade", href: "/privacidade" }, { label: "Regras do leilão", href: "/como-funciona#regras" }, { label: "Auditoria", href: "/como-funciona#auditoria" }] },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand text-brand-foreground">
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
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-brand-foreground underline-offset-4 hover:underline">
                          {link.label}
                          <span className="sr-only"> (abre em nova aba)</span>
                        </a>
                      ) : (
                        <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-brand-foreground underline-offset-4 hover:underline">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-accent pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Arremate, voltar à vitrine">
            {/* Logo L3 (martelo) na variante para fundo bordô: quadrado e nome em papel. */}
            <Image src="/brand/l3-horizontal-bordo.svg" alt="" width={135} height={32} className="h-8 w-auto" />
          </Link>
          <InstallAppButton className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-accent px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:self-auto" />
          <p className="text-xs opacity-80">Obras: domínio público (CC0) · The Metropolitan Museum of Art Open Access · valores simulados · horário de Brasília (UTC−3)</p>
        </div>
      </div>
    </footer>
  );
}
