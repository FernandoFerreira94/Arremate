"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, InfoIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./auth-api";
import { afterLoginFailure, safeReturnTo, type LoginValues } from "./login-state";
import { SESSION_KEY } from "./use-session";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const expired = params.get("motivo") === "sessao-expirada";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    let session: Awaited<ReturnType<typeof login>>;
    try {
      session = await login({ email: values.email.trim(), password: values.password, returnTo: safeReturnTo(params.get("returnTo")) });
    } catch (failure) {
      const next = afterLoginFailure(values, failure);
      setValues(next.values);
      setError(next.message);
      setSending(false);
      return;
    }
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "public" });
    client.setQueryData(SESSION_KEY, { role: session.role });
    router.replace(session.returnTo);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-3xl">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use uma das contas da demonstração. Não há cadastro nem recuperação de senha.</p>
      </div>
      {expired ? (
        <Alert variant="warning">
          <InfoIcon />
          <p>Sua sessão expirou. Entre de novo para continuar.</p>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <p id="login-error">{error}</p>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={values.email}
                onChange={(event) => setValues({ ...values, email: event.target.value })}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={values.password}
                onChange={(event) => setValues({ ...values, password: event.target.value })}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <Button type="submit" size="lg" disabled={sending || !values.email || !values.password}>
              {sending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Só quer olhar? <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">Veja a vitrine sem entrar</Link>.
      </p>
    </div>
  );
}
