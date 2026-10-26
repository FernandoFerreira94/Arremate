"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { PasswordInput } from "@/components/app/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-error";
import { currentSession, register } from "./auth-api";
import { GoogleButton } from "./google-button";
import { isPlausibleEmail, passwordStrength, STRENGTH_LABEL } from "./reset-logic";
import { SESSION_KEY } from "./use-session";

export function RegisterForm({ onGoToLogin, onDone }: { onGoToLogin: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [terms, setTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const strength = passwordStrength(password);
  const client = useQueryClient();
  const router = useRouter();
  const mismatch = confirmation.length > 0 && password !== confirmation;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !name.trim() || !isPlausibleEmail(email) || password.length < 8 || password !== confirmation || !terms) return;
    setSending(true);
    setError("");
    try {
      const result = await register({ name: name.trim(), email: email.trim(), password, termsAccepted: true });
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "public" });
      client.setQueryData(SESSION_KEY, await currentSession());
      setPassword("");
      setConfirmation("");
      onDone();
      router.push(result.returnTo);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.statusCode === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "NÃ£o foi possÃ­vel criar a conta. Verifique os dados ou tente entrar.");
    } finally {
      setSending(false);
    }
  }
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
      {error ? <Alert variant="destructive"><p role="alert">{error}</p></Alert> : null}
      <GoogleButton returnTo="/carteira" disabled={sending} />
      <fieldset disabled={sending} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-name">Nome</Label><Input id="register-name" placeholder="Seu nome completo" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-email">E-mail</Label><Input id="register-email" placeholder="voce@email.com" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-password">Senha</Label><PasswordInput id="register-password" placeholder="MÃ­nimo de 8 caracteres" autoComplete="new-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="grid grid-cols-4 gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 rounded-full bg-muted", strength >= i && (strength < 2 ? "bg-destructive" : strength < 4 ? "bg-warning" : "bg-success"))} />)}</div>
          <p className="text-xs text-muted-foreground" aria-live="polite">{strength ? `ForÃ§a: ${STRENGTH_LABEL[strength]}` : "MÃ­nimo de 8 caracteres"}</p>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-confirm">Confirmar senha</Label><PasswordInput id="register-confirm" placeholder="Repita a senha" autoComplete="new-password" maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-invalid={mismatch} aria-describedby={mismatch ? "register-confirm-error" : undefined} />{mismatch ? <p id="register-confirm-error" className="text-xs text-destructive">As senhas nÃ£o conferem.</p> : null}</div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>Aceito os <Link href="/termos" className="text-primary underline">Termos</Link> e a <Link href="/privacidade" className="text-primary underline">Privacidade</Link> da demonstraÃ§Ã£o. Guardamos nome, e-mail e saldo simulado.</span></label>
        <Button type="submit" size="lg" disabled={sending || !name.trim() || !isPlausibleEmail(email) || password.length < 8 || password !== confirmation || !terms}>{sending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}{sending ? "Criando contaâ€¦" : "Criar conta"}</Button>
      </fieldset>
      <button type="button" className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline" disabled={sending} onClick={onGoToLogin}>JÃ¡ tenho conta</button>
    </form>
  );
}
