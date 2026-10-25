"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenIcon,
  CompassIcon,
  HeartIcon,
  CalendarClockIcon,
  CreditCardIcon,
  GavelIcon,
  HourglassIcon,
  LayoutListIcon,
  LifeBuoyIcon,
  LogInIcon,
  FlaskConicalIcon,
  LogOutIcon,
  MenuIcon,
  PlusCircleIcon,
  RadioIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SquareCheckBigIcon,
  UserIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navItemClass,
} from "@/components/ui/navigation-menu";
import { useTour } from "@/features/tour/tour";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthSheet } from "@/features/auth/auth-sheet";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { useLogout, useSession } from "@/features/auth/use-session";
import type { Role } from "@/features/auth/auth-api";
import { getWallet } from "@/features/wallet/wallet-api";
import { formatBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavItem = { href: string; label: string; icon: LucideIcon; hint?: string };

/** R5: seção "Leilões" do menu central (abas da vitrine endereçáveis por ?aba=). */
export const AUCTION_ITEMS: NavItem[] = [
  { href: "/?aba=ao-vivo", label: "Ao vivo", icon: RadioIcon, hint: "Lotes recebendo lances" },
  { href: "/?aba=agendados", label: "Agendados", icon: CalendarClockIcon, hint: "Abrem em breve" },
  { href: "/?aba=encerrados", label: "Encerrados", icon: SquareCheckBigIcon, hint: "Resultados e comprovantes" },
  { href: "/?aba=encerrando-hoje", label: "Encerrando hoje", icon: HourglassIcon, hint: "Terminam hoje (Brasília)" },
];
const AUCTION_EXTRAS: NavItem[] = [
  { href: "/como-funciona#auditoria", label: "Auditoria pública de cada lote", icon: ShieldCheckIcon },
  { href: "/como-funciona#regras", label: "Regras do leilão", icon: ScaleIcon },
];
const SITE_ITEMS: NavItem[] = [
  { href: "/como-funciona", label: "Como funciona", icon: BookOpenIcon },
  { href: "/suporte", label: "Suporte/FAQ", icon: LifeBuoyIcon },
];

/** Menu da conta por papel. Creditar saldo e Cartões levam à Carteira até a integração das abas Pix/Cartão. */
export function navFor(role: Role | null): NavItem[] {
  if (role === "AUCTIONEER") {
    return [
      { href: "/perfil", label: "Perfil", icon: UserIcon },
      { href: "/painel/lotes", label: "Meus lotes", icon: LayoutListIcon },
      { href: "/painel/lotes/novo", label: "Novo lote", icon: PlusCircleIcon },
      { href: "/favoritos", label: "Meus favoritos", icon: HeartIcon },
    ];
  }
  if (role === "BIDDER") {
    return [
      { href: "/perfil", label: "Perfil", icon: UserIcon },
      { href: "/carteira", label: "Carteira", icon: WalletIcon },
      // TODO(integração Codex): apontar para /carteira?aba=pix e /carteira?aba=cartao quando as abas existirem.
      { href: "/carteira#depositar", label: "Creditar saldo", icon: PlusCircleIcon },
      { href: "/carteira#cartoes", label: "Cartões", icon: CreditCardIcon },
      { href: "/meus-arremates", label: "Meus lances e arremates", icon: GavelIcon },
      { href: "/favoritos", label: "Meus favoritos", icon: HeartIcon },
    ];
  }
  return [];
}

const ROLE_LABEL: Record<Role, string> = { AUCTIONEER: "Leiloeiro", BIDDER: "Licitante" };

function BalanceChip() {
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet, staleTime: 15_000 });
  if (!wallet.data) return null;
  return (
    <Link href="/carteira" data-tour="balance" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm tabular-nums hover:bg-muted" aria-label={`Saldo disponível ${formatBrl(wallet.data.availableCents)}`}>
      <WalletIcon className="size-4 text-muted-foreground" /> {formatBrl(wallet.data.availableCents)}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();
  const authSheet = useAuthSheet();
  const tour = useTour();
  const role = session.data?.role ?? null;
  const accountItems = navFor(role);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split(/[?#]/)[0]));

  const enter =
    session.isPending || pathname === "/entrar" ? null : (
      <Button size="sm" onClick={() => authSheet.open("entrar")}>
        <LogInIcon /> Entrar
      </Button>
    );

  // TODO(integração Codex): mostrar o nome curto ("Ana R.") quando o campo de nome existir no User.
  const profile = role ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Menu da conta" data-tour="profile">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted font-serif text-sm" aria-hidden>{ROLE_LABEL[role][0]}</span>
          {ROLE_LABEL[role]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{ROLE_LABEL[role]}</DropdownMenuLabel>
        {accountItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}><item.icon /> {item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => tour.start()}>
          <CompassIcon /> Ver tour de novo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOutIcon /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    enter
  );

  const mobileLink = (item: NavItem) => (
    <SheetClose asChild key={item.href}>
      <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground", isActive(item.href) && "bg-muted font-medium")}>
        <item.icon /> {item.label}
      </Link>
    </SheetClose>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-[1360px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 lg:px-10">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <NavigationMenu aria-label="Principal" className="hidden md:flex" data-tour="nav">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger><GavelIcon /> Leilões</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid grid-cols-2 gap-1">
                  {AUCTION_ITEMS.map((item) => (
                    <li key={item.href}>
                      <NavigationMenuLink asChild>
                        <Link href={item.href} className="flex gap-3 rounded-md p-2 hover:bg-muted">
                          <item.icon className="mt-0.5 size-4 text-muted-foreground" />
                          <span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.hint}</span></span>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-x-4 border-t pt-2">
                  {AUCTION_EXTRAS.map((item) => (
                    <NavigationMenuLink asChild key={item.href}>
                      <Link href={item.href} className="inline-flex items-center gap-1.5 rounded-md p-1 text-xs text-muted-foreground hover:text-foreground"><item.icon className="size-3.5" /> {item.label}</Link>
                    </NavigationMenuLink>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            {SITE_ITEMS.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild active={isActive(item.href)}>
                  <Link href={item.href} className={cn(navItemClass, isActive(item.href) && "bg-muted font-medium")} aria-current={isActive(item.href) ? "page" : undefined}>
                    <item.icon /> {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        <div className="col-start-3 flex items-center justify-end gap-2">
          {role ? <NotificationBell /> : null}
          <div className="hidden items-center gap-2 md:flex">
            {role === "BIDDER" ? <BalanceChip /> : null}
            {profile}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu" data-tour="menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-none overflow-y-auto sm:max-w-sm">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Demonstração com valores simulados.</SheetDescription>
              <nav aria-label="Menu móvel" className="flex flex-col gap-1">
                <p className="px-3 pt-2 text-xs uppercase tracking-wide text-muted-foreground">Leilões</p>
                {AUCTION_ITEMS.map(mobileLink)}
                <div className="my-1 border-t" />
                {SITE_ITEMS.map(mobileLink)}
                {accountItems.length ? (
                  <>
                    <p className="px-3 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Minha conta · {role ? ROLE_LABEL[role] : ""}</p>
                    {accountItems.map(mobileLink)}
                    <SheetClose asChild>
                      <button type="button" onClick={() => tour.start()} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground">
                        <CompassIcon /> Ver tour de novo
                      </button>
                    </SheetClose>
                  </>
                ) : null}
              </nav>
              <div className="mt-auto">
                {role ? (
                  <Button variant="ghost" className="text-danger" onClick={() => void logout()}>
                    <LogOutIcon /> Sair
                  </Button>
                ) : enter ? (
                  <SheetClose asChild>{enter}</SheetClose>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div data-testid="demo-banner" className="flex items-center justify-center gap-2 border-t border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning">
        <FlaskConicalIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="sm:hidden">Demonstração · pagamentos simulados</span>
        <span className="hidden sm:inline">Ambiente de demonstração · pagamentos simulados · nenhuma obra está à venda</span>
      </div>
    </header>
  );
}
