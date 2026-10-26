"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, FlaskConicalIcon, GavelIcon, InfoIcon, LogInIcon, UserIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/password-input";
import { Label } from "@/components/ui/label";
import { currentSession, login, type Session } from "./auth-api";
import { afterLoginFailure, demoLoginEnabled, safeReturnTo, type LoginValues } from "./login-state";
import { GoogleButton } from "./google-button";
import { SESSION_KEY } from "./use-session";
import { messageOf, notifySuccess } from "@/lib/notify";

/** Login rápido de teste: contas fictícias do seed com a senha pública de demo (docs/ambiente.md). Usa o login normal (mesmo limite de tentativas). D27: ligado por padrão; NEXT_PUBLIC_DEMO_LOGIN=false desliga na build. */
export const DEMO_LOGIN_ENABLED = demoLoginEnabled(process.env.NEXT_PUBLIC_DEMO_LOGIN);
const DEMO_PASSWORD = "arremate-demo-2026";
const DEMO_ACCOUNTS = [
  { email: "licitante1@arremate.demo", label: "Entrar como licitante de teste", Icon: UserIcon },
  { email: "leiloeiro@arremate.demo", label: "Entrar como leiloeiro de teste", Icon: GavelIcon },
] as const;

type LoginFormProps = {
  /** "sheet" (R1): só o formulário, dentro da Sheet de autenticação. "page": a página /entrar (alternativa). */
  variant?: "page" | "sheet";
  /** Na Sheet, fica na página atual em vez de navegar (o back só aceita returnTo da lista dele, então a Sheet não envia). */
  onSuccess?: () => void;
  returnTo?: string;
};

export function LoginForm({ variant = "page", onSuccess, returnTo }: LoginFormProps = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const expired = params.get("motivo") === "sessao-expirada";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doLogin(values, false);
  }

  async function doLogin(creds: LoginValues, demo: boolean) {
    if (sending) return;
    setSending(true);
    setError(null);
    let session: Awaited<ReturnType<typeof login>>;
    let current: Session | null;
    try {
      session = await login({ email: creds.email.trim(), password: creds.password, returnTo: variant === "sheet" ? undefined : safeReturnTo(returnTo ?? params.get("returnTo")) });
      current = await currentSession();
      if (!current) throw new Error("Sessão não encontrada");
    } catch (failure) {
      const next = afterLoginFailure(creds, failure);
      if (!demo) setValues(next.values);
      setError(next.message);
      setSending(false);
      return;
    }
    // Na Sheet a página não navega: a query da sessão fica no cache (é atualizada abaixo) para o header ser notificado.
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "public" && (variant === "page" || query.queryKey[0] !== SESSION_KEY[0]) });
    client.setQueryData(SESSION_KEY, current);
    notifySuccess(messageOf(session, "Login realizado."));
    if (onSuccess) {
      setSending(false);
      return onSuccess();
    }
    router.replace(session.returnTo);
  }

  const form = (
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <p id="login-error">{error}</p>
              </Alert>
            ) : null}
            <GoogleButton returnTo={safeReturnTo(returnTo ?? params.get("returnTo"))} disabled={sending} />
            {params.get("google") === "erro" ? <Alert variant="destructive">Não foi possível entrar com o Google. Tente de novo.</Alert> : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${variant}-email`}>Email</Label>
              <Input
                id={`${variant}-email`}
                type="email"
                autoComplete="username"
                placeholder="voce@email.com"
                required
                disabled={sending}
                value={values.email}
                onChange={(event) => setValues({ ...values, email: event.target.value })}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${variant}-password`}>Senha</Label>
              <PasswordInput
                id={`${variant}-password`}
                autoComplete="current-password"
                placeholder="Sua senha"
                required
                disabled={sending}
                value={values.password}
                onChange={(event) => setValues({ ...values, password: event.target.value })}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <Button type="submit" size="lg" disabled={sending || !values.email || !values.password}>
              <LogInIcon /> {sending ? "Entrando…" : "Entrar"}
            </Button>
            {DEMO_LOGIN_ENABLED ? (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3" role="group" aria-labelledby={`${variant}-demo-login`}>
                <p id={`${variant}-demo-login`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FlaskConicalIcon className="size-3.5" /> Ambiente de demonstração
                </p>
                {DEMO_ACCOUNTS.map(({ email, label, Icon }) => (
                  <Button key={email} type="button" variant="outline" disabled={sending} onClick={() => void doLogin({ email, password: DEMO_PASSWORD }, true)}>
                    <Icon /> {label}
                  </Button>
                ))}
              </div>
            ) : null}
          </form>
  );

  if (variant === "sheet") return form;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-3xl">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use uma das contas da demonstração. Você também pode entrar pelo botão Entrar do topo de qualquer página.</p>
      </div>
      {expired ? (
        <Alert variant="warning">
          <InfoIcon />
          <p>Sua sessão expirou. Entre de novo para continuar.</p>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          {form}
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Só quer olhar? <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">Veja a vitrine sem entrar</Link>.
      </p>
    </div>
  );
}
