"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreditCardIcon, GavelIcon, LockIcon, UserIcon, WalletIcon } from "lucide-react";
import { ErrorState, LoadingRows } from "@/components/app/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/features/auth/use-session";
import { useAuthSheet } from "@/features/auth/auth-sheet";
import { getWallet } from "@/features/wallet/wallet-api";
import { formatBrl } from "@/lib/money";

const ROLE_LABEL = { AUCTIONEER: "Leiloeiro", BIDDER: "Licitante" } as const;

/**
 * R8: Perfil SÓ LEITURA a partir do que a sessão expõe hoje (papel).
 * TODO(integração Codex): nome (editável), e-mail, conta Google vinculada e cartões salvos, quando o User ganhar
 * esses campos e a API os expuser. Até lá não há edição nem botão sem capacidade.
 */
export function ProfilePage() {
  const session = useSession();
  const auth = useAuthSheet();
  const isBidder = session.data?.role === "BIDDER";
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet, enabled: isBidder });

  if (session.isPending) return <LoadingRows label="Conferindo sua sessão" />;
  if (session.isError) return <ErrorState message="Não foi possível conferir sua sessão." onRetry={() => void session.refetch()} />;
  if (!session.data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3">
        <h1 className="text-3xl">Perfil</h1>
        <p className="text-muted-foreground">Entre para ver os dados da sua conta.</p>
        <Button onClick={() => auth.open("entrar")}>Entrar</Button>
      </div>
    );
  }
  const role = session.data.role;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Perfil</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="size-5 text-primary" aria-hidden /> Dados da conta</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Papel</dt><dd>{ROLE_LABEL[role]}</dd>
              <dt className="text-muted-foreground">Tipo de conta</dt><dd>Conta de demonstração</dd>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Nome e e-mail aparecem aqui quando o cadastro público estiver ativo.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LockIcon className="size-5 text-primary" aria-hidden /> Segurança</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>Senha protegida com argon2 e sessão em cookie httpOnly.</p>
            <Button variant="outline" size="sm" className="self-start" onClick={() => auth.open("redefinir")}>Redefinir senha (simulado)</Button>
          </CardContent>
        </Card>
      </div>
      {isBidder ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={WalletIcon} label="Disponível na carteira" value={wallet.data ? formatBrl(wallet.data.availableCents) : wallet.isError ? "Indisponível" : "…"} href="/carteira" cta="Abrir carteira" />
          <SummaryCard icon={GavelIcon} label="Lances e arremates" value="Ver histórico" href="/meus-arremates" cta="Meus arremates" />
          <SummaryCard icon={CreditCardIcon} label="Cartões" value="Cartão de teste" href="/carteira#cartoes" cta="Ir para a carteira" />
        </div>
      ) : (
        <SummaryCard icon={GavelIcon} label="Lotes" value="Publicados por você" href="/painel/lotes" cta="Meus lotes" />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, href, cta }: { icon: typeof UserIcon; label: string; value: string; href: string; cta: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" aria-hidden /> {label}</span>
        <span className="font-serif text-2xl tabular-nums">{value}</span>
        <Button asChild variant="link" className="self-start px-0"><Link href={href}>{cta}</Link></Button>
      </CardContent>
    </Card>
  );
}
