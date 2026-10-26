"use client";

import { createContext, Suspense, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2Icon, FlaskConicalIcon, KeyRoundIcon, LogInIcon, MailIcon, UserPlusIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { isPlausibleEmail, RESET_SENT_DETAIL, RESET_SENT_MESSAGE } from "./reset-logic";

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
            <TabsContent value="cadastrar"><RegisterForm onGoToLogin={() => setTab("entrar")} onDone={() => setOpenState(false)} /></TabsContent>
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
        <Input id="reset-email" placeholder="voce@email.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={!isPlausibleEmail(email)}><MailIcon /> Enviar link</Button>
    </form>
  );
}
