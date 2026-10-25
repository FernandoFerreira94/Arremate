"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConicalIcon, LogOutIcon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, useSession } from "@/features/auth/use-session";
import type { Role } from "@/features/auth/auth-api";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavItem = { href: string; label: string };

export function navFor(role: Role | null): NavItem[] {
  if (role === "AUCTIONEER") return [{ href: "/", label: "Vitrine" }, { href: "/painel/lotes", label: "Meus lotes" }];
  if (role === "BIDDER") return [{ href: "/", label: "Vitrine" }, { href: "/meus-arremates", label: "Meus arremates" }, { href: "/carteira", label: "Carteira" }];
  return [{ href: "/", label: "Vitrine" }];
}

const ROLE_LABEL: Record<Role, string> = { AUCTIONEER: "Leiloeiro", BIDDER: "Licitante" };

export function SiteHeader() {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();
  const role = session.data?.role ?? null;
  const items = navFor(role);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const account = role ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{ROLE_LABEL[role]}</span>
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        <LogOutIcon /> Sair
      </Button>
    </div>
  ) : session.isPending || pathname === "/entrar" ? null : (
    <Button asChild size="sm">
      <Link href={`/entrar?returnTo=${encodeURIComponent(pathname)}`}>Entrar</Link>
    </Button>
  );

  return (
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-4 lg:px-10">
        <Logo />
        <nav aria-label="Principal" className="ml-4 hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn("rounded-md px-3 py-2 text-sm hover:bg-muted", isActive(item.href) && "bg-muted font-medium")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden md:block">{account}</div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Abrir menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Demonstração com valores simulados.</SheetDescription>
            <nav aria-label="Menu móvel" className="flex flex-col gap-1">
              {items.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("rounded-md px-3 py-3 hover:bg-muted", isActive(item.href) && "bg-muted font-medium")}>
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto">{account}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div data-testid="demo-banner" className="flex items-center justify-center gap-2 border-t border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning">
        <FlaskConicalIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="sm:hidden">Demonstração · pagamentos simulados</span>
        <span className="hidden sm:inline">Ambiente de demonstração · pagamentos simulados · nenhuma obra está à venda</span>
      </div>
    </header>
  );
}
