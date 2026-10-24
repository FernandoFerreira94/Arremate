"use client";

import Link from "next/link";
import { createContext, Suspense, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2Icon, FlaskConicalIcon, InfoIcon, KeyRoundIcon, LogInIcon, MailIcon, UserPlusIcon } from "lucide-react";
import { PasswordInput } from "@/components/app/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";
import { isPlausibleEmail, passwordStrength, RESET_SENT_DETAIL, RESET_SENT_MESSAGE, STRENGTH_LABEL } from "./reset-logic";

export type AuthTab = "entrar" | "cadastrar" | "redefinir";
type AuthSheetApi = { open: (tab?: AuthTab) => void };
const AuthSheetContext = createContext<AuthSheetApi>({ open: () => undefined });

export function useAuthSheet(): AuthSheetApi {
  return useContext(AuthSheetContext);
}

const TITLE: Record<AuthTab, string> = { entrar: "Entrar", cadastrar: "Criar conta", redefinir: "Redefinir senha" };

/** R1: Sheet à direita (tela cheia no mobile) com Entrar, Cadastrar e Redefinir. /entrar continua como alternativa. */
export function AuthSheetProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState(false);
  const [tab, setTab] = useState<AuthTab>("entrar");
  const open = useCallback((next: AuthTab = "entrar") => {
    setTab(next);
    setOpenState(true);
  }, []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <AuthSheetContext.Provider value={api}>
      {children}
      <Sheet open={openState} onOpenChange={setOpenState}>
        <SheetContent side="right" className="w-full max-w-none overflow-y-auto sm:max-w-md">
          <SheetTitle className="text-2xl">{TITLE[tab]}</SheetTitle>
          <SheetDescription className="sr-only">Entre, crie uma conta ou redefina a senha. Ambiente de demonstração.</SheetDescription>
          <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)} className="flex flex-col gap-4">
            <TabsList aria-label="Acesso" className="grid w-full grid-cols-3">
              <TabsTrigger value="entrar" className="justify-center"><LogInIcon className="size-4" /> Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar" className="justify-center"><UserPlusIcon className="size-4" /> Cadastrar</TabsTrigger>
              <TabsTrigger value="redefinir" className="justify-center"><KeyRoundIcon className="size-4" /> Redefinir</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar" className="flex flex-col gap-3">
              <Suspense>
                <SheetLogin onDone={() => setOpenState(false)} />
              </Suspense>
              <button type="button" className="self-end text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => setTab("redefinir")}>
                Esqueci a senha
              </button>
            </TabsContent>
            <TabsContent value="cadastrar"><RegisterShell onGoToLogin={() => setTab("entrar")} /></TabsContent>
            <TabsContent value="redefinir"><ResetSimulated onGoToLogin={() => setTab("entrar")} /></TabsContent>
          </Tabs>
          <p className="mt-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlaskConicalIcon className="size-3.5" /> Ambiente de demonstração · nenhum dado de pagamento real.
          </p>
        </SheetContent>
      </Sheet>
    </AuthSheetContext.Provider>
  );
}

function SheetLogin({ onDone }: { onDone: () => void }) {
  return <LoginForm variant="sheet" onSuccess={onDone} />;
}

/**
 * TODO(integração Codex): ligar ao endpoint de cadastro de licitante (nome, e-mail, senha, aceite) do plano
 * auth-pagamentos e trocar o medidor local pelo da prancha A2. Até lá o formulário é só a casca da R1.
 */
function RegisterShell({ onGoToLogin }: { onGoToLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const strength = passwordStrength(password);
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      {submitted ? (
        <Alert>
          <InfoIcon />
          <p>O cadastro público chega na próxima integração. Por enquanto, entre com uma conta de demonstração.</p>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-name">Nome</Label>
        <Input id="register-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">E-mail</Label>
        <Input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Senha</Label>
        <PasswordInput id="register-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="grid grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 rounded-full bg-muted", strength >= i && "bg-primary")} />)}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">{strength ? `Força: ${STRENGTH_LABEL[strength]}` : "Mínimo de 8 caracteres"}</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Aceito os <Link href="/como-funciona#regras" className="text-primary underline">Termos</Link> e a <Link href="/suporte#privacidade" className="text-primary underline">Privacidade</Link> da demonstração.</span>
      </label>
      <Button type="submit" size="lg" disabled={!name || !isPlausibleEmail(email) || password.length < 8 || !terms}>
        <UserPlusIcon /> Criar conta
      </Button>
      <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onGoToLogin}>Já tenho conta</button>
    </form>
  );
}

function ResetSimulated({ onGoToLogin }: { onGoToLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert className="border-success/30 bg-success-soft">
          <CheckCircle2Icon />
          <div>
            <p role="status" className="font-medium">{RESET_SENT_MESSAGE}</p>
            <p className="text-sm">{RESET_SENT_DETAIL}</p>
          </div>
        </Alert>
        <Button variant="outline" onClick={() => { setSent(false); setEmail(""); onGoToLogin(); }}><LogInIcon /> Voltar para Entrar</Button>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={(event) => { event.preventDefault(); if (isPlausibleEmail(email)) setSent(true); }}>
      <p className="text-sm text-muted-foreground">Informe o e-mail da conta. Por segurança, a resposta é sempre a mesma.</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={!isPlausibleEmail(email)}><MailIcon /> Enviar link</Button>
    </form>
  );
}
