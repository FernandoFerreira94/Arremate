# Proposta — Auth, pagamentos simulados e histórico (Arremate)

**Autor:** Fred (UX/UI) · 24/10/2026 · **PROPOSTA, aguarda aprovação do Fernando.** Sem código/git. Base: repo `/workspace/arremate-w/repo` (HEAD `e6705c4`), `docs/decisoes.md` (D01–D16, Freeze D12), `docs/design/DECISOES-VISUAIS.md`, pranchas 00–13.
Stack: Next.js (site) · NestJS (API) · Supabase só como PostgreSQL (sem Supabase Auth).

**Regras para o Codex (valem para tudo abaixo):** só tokens existentes de `front-end/src/app/globals.css` (D02/D03/D08, sem dark mode); só primitivas em `front-end/src/components/ui/*` + `components/app/*`; ícones lucide; nenhuma cor fixa; textos pt-BR; horário BRT.

---

## 1) Telas e estados

Componentes base reaproveitados em todas: `components/app/page-shell.tsx` (PageShell), `components/app/page-states.tsx` (LoadingRows, ErrorState, EmptyState, AccessDenied), `components/ui/card.tsx`, `ui/button.tsx`, `ui/input.tsx`, `ui/label.tsx`, `ui/alert.tsx`, `ui/skeleton.tsx`.

### 1.1 Entrar (`/entrar`) — e-mail + Google
- Arquivo: `features/auth/login-form.tsx` (evoluir, não duplicar).
- Layout: Card atual; acima do formulário, `Button variant="outline" size="lg"` largura total “Continuar com Google” (logo G oficial em SVG monocromático conforme guideline do Google; não é lucide); divisor “ou” (`border-border` + `text-muted-foreground`); depois e-mail/senha como hoje.
- Senha: Input + botão-ícone `Button variant="ghost" size="icon"` dentro do campo com `Eye`/`EyeOff` (lucide), `aria-label` “Mostrar senha”/“Ocultar senha”, `aria-pressed`.
- Link “Criar conta” → `/cadastrar`. Sem “Esqueci a senha” (não há capacidade; ver C4).
- Estados: padrão · carregando (botão com spinner `Loader2`, campos desabilitados; Google com spinner próprio) · erro credencial (`Alert variant="destructive"` genérico: “E-mail ou senha inválidos.”) · erro Google cancelado/falhou (“Não foi possível entrar com o Google. Tente de novo.”) · bloqueio por excesso (“Muitas tentativas. Aguarde alguns minutos.”) · sucesso (redirect para `returnTo` seguro, já existe `safeReturnTo`).

### 1.2 Cadastrar (`/cadastrar`) — novo, mesmo layout de Entrar
- Reaproveita o Card e campos de `login-form.tsx`; extrair um `PasswordInput` (Input + olho) usado por login e cadastro — é a única peça nova e é composição de primitivas.
- Campos: nome, e-mail, senha (com olho + indicador de força), confirmar senha (com olho), checkbox de aceite (“Li e aceito os Termos e a Política de privacidade da demonstração”) — usar Checkbox shadcn (ver C5, primitiva ainda não instalada) ou `<input type=checkbox>` estilizado com tokens.
- Papel: cadastro público cria só **BIDDER**; leiloeiro continua semeado.
- “Continuar com Google” também aqui.
- Estados: padrão · validação por campo (texto `text-destructive` sob o campo, `aria-describedby`) · carregando · erro genérico (“Não foi possível criar a conta. Verifique os dados ou tente entrar.” — não revelar se o e-mail existe) · sucesso (entra logado e vai para Carteira com `Alert` de sucesso “Conta criada. Adicione saldo simulado para dar lances.”).

### 1.3 Carteira — Depósito (`/carteira`)
- Arquivo: `features/wallet/wallet-page.tsx` (`DepositForm`, `MoneyInput` em `components/app/money-input.tsx`, atalhos 1k/5k/10k D11, limite R$1–R$100k D05 — manter).
- Novo: escolha de método com `ui/tabs.tsx` dentro do DepositForm: **Pix** | **Cartão** (ambos simulados). Valor e atalhos ficam acima das abas, comuns aos dois.
- Estados: carregando (LoadingRows) · erro carga (ErrorState com retry, já existe) · vazio (saldo 0 → EmptyState “Sem saldo ainda” + CTA depositar) · erro valor (já existe `validateDeposit`) · pending · sucesso (saldo atualiza + toast/Alert).
- Idempotência atual (`lib/idempotent-action.ts`) continua obrigatória: repetir não duplica.

### 1.4 Pix com QR simulado (aba Pix)
- Card com: valor em Fraunces, QR **gerado como imagem estática ilustrativa** com marca d’água “SIMULADO” sobre o QR (não é payload EMV válido — ver §3), código “copia e cola” fictício iniciado por `DEMO-` com botão Copiar (`Button variant="outline" size="sm"`, ícone `Copy`), contador de expiração 10 min.
- Botão primário “Simular pagamento” → sempre aprova após ~1,5 s.
- Estados: gerando (Skeleton no lugar do QR) · aguardando (QR + contador) · aprovando (spinner) · sucesso (`CheckCircle2`, `bg-success-soft`, “Pagamento simulado aprovado. R$ X adicionados.”) · expirado (Alert + “Gerar novo”) · erro rede (ErrorState com retry, sem duplicar crédito).
- Sem dependência de QR: usar SVG fixo do repo (ver C6).

### 1.5 Cartão (aba Cartão + gestão em Carteira)
- Card “Cartão de demonstração”: campos número, nome, validade, CVV (`ui/input.tsx` + `ui/label.tsx`), com `inputMode="numeric"` e `autoComplete="off"` (**não** usar `cc-number`/`cc-csc`, para o navegador não oferecer cartões reais — ver C1).
- Botão “Preencher cartão de teste” (`Button variant="secondary"`) que insere 4242 4242 4242 4242 / 12/34 / 123; Alert fixo no topo do card: “Use só o cartão de teste. Não digite um cartão real.”
- Validação só de formato (Luhn + validade futura) no cliente; **API recebe e guarda apenas bandeira, últimos 4 e validade**; número e CVV nunca saem do navegador (o “salvar” é simulado).
- Lista de cartões salvos: `ui/table.tsx` ou Card com “Visa •••• 4242 · 12/34” + remover (`ui/alert-dialog.tsx`, botão `variant="destructive"`).
- Estados: vazio (EmptyState “Nenhum cartão de teste”) · validando · erro campo (“Número inválido”) · salvando · sucesso (“Cartão de teste salvo”) · cobrança simulada aprovada (igual ao Pix) · erro genérico.

### 1.6 Histórico de leilões (`/meus-arremates`, aba nova)
- Arquivo: `features/awards/my-awards-page.tsx` (já tem Arremates + Participações via `ui/tabs.tsx` e `ui/table.tsx`); `components/app/lot-state-badge.tsx` para estado.
- Acrescentar aba **Histórico** (ou ampliar Participações): todos os lotes em que o usuário deu lance, colunas Obra (miniatura), Lote, Encerramento (BRT), Seu maior lance, Resultado (Arrematado/Superado/Não arrematado/Cancelado), link Comprovante quando houver. Ordenação por encerramento desc; paginação de 8 (padrão D10).
- Carteira ganha “Extrato” na mesma tabela existente, com tipo (Depósito Pix simulado / Depósito cartão simulado / Bloqueio / Liberação / Arremate).
- Estados: carregando (LoadingRows) · vazio (EmptyState “Você ainda não participou de leilões” + CTA Vitrine) · erro (ErrorState retry) · sucesso (tabela).

### 1.7 Header/menu
- `components/app/site-header.tsx` (`navFor`): visitante vê “Entrar” e “Criar conta” (`Button size="sm"`); logado mantém navegação atual. Mobile usa `ui/sheet.tsx` já existente.

---

## 2) Recursos do Next

- **next/image:** trocar os `<img>` em `features/lots/lot-card.tsx`, `lot-room-page.tsx`, `receipt-page.tsx`, `features/awards/my-awards-page.tsx`, `features/wallet/wallet-page.tsx`, `features/seller/my-lots-page.tsx`, `new-lot-page.tsx`. Em `front-end/next.config.ts` (hoje só `poweredByHeader:false`) adicionar `images.remotePatterns` para `https://images.metmuseum.org/CRDImages/**` e para a origem da mídia local da API. Sempre `sizes`, `alt` atual, `priority` só na imagem principal da Sala; `placeholder` com `bg-muted`. Manter o fallback quando o Met cair (D07, sem aviso ao visitante).
- **metadata/OG por rota:** já existe `metadata`/`generateMetadata` em quase todas as rotas e `app/opengraph-image.tsx`. Acrescentar: `/cadastrar` (noindex), `opengraph-image` por lote em `app/lotes/[id]/` (imagem da obra + título em Fraunces sobre papel, 1200×630), comprovante já tem. Rotas privadas continuam `robots: noindex`.
- **next/font:** já usado em `app/layout.tsx` (Fraunces + Inter). Só conferir `display: "swap"`, subsets `latin` e variáveis CSS ligadas aos tokens; nada a mudar se já estiver assim.
- **loading.tsx / error.tsx / not-found.tsx:** `not-found.tsx` já existe na raiz. Criar `loading.tsx` (usa `LoadingRows`/Skeleton) e `error.tsx` (usa `ErrorState` com `reset`) na raiz e em `app/lotes/[id]/`, `app/carteira/`, `app/meus-arremates/`; `not-found.tsx` específico em `app/lotes/[id]/` (“Lote não encontrado” + voltar à vitrine) e `app/comprovantes/[token]/`.

---

## 3) Confiança e segurança na UI

1. Faixa fixa no topo (abaixo do header) em todas as páginas: “Ambiente de demonstração · pagamentos simulados · nenhuma obra está à venda” — `ui/alert.tsx` compacto ou barra `bg-muted text-muted-foreground`, ícone `FlaskConical`/`Info`. Repetir dentro dos cards de Pix e Cartão.
2. Cartão: exibir só bandeira + últimos 4; **nunca** guardar nem enviar número completo ou CVV; CVV e número limpos do estado após “salvar”; sem `autocomplete` de cartão; botão “cartão de teste”.
3. Pix: QR com marca d’água “SIMULADO”, código `DEMO-…` sem formato EMV/BR Code real, nenhuma chave Pix ou nome de banco.
4. Senha: olho mostrar/ocultar (login + cadastro); indicador de força com 3 níveis (Fraca/Média/Forte) em barra com tokens `destructive`/`warning`/`success` **e** texto (não só cor, WCAG); requisitos mínimos listados (8+ caracteres); Argon2id no back-end já existe (D15).
5. Aceite obrigatório de Termos/Privacidade no cadastro (texto curto da demonstração, LGPD: o que se guarda — nome, e-mail, últimos 4 do cartão de teste).
6. Mensagens genéricas: login e cadastro não revelam se o e-mail existe; erros de pagamento sem detalhe técnico.
7. Rate limit visível (“Muitas tentativas…”), sessão por cookie HttpOnly como hoje, sem token em storage.
8. Rodapé (`components/app/site-footer.tsx`): links Termos · Privacidade · Como funciona a demonstração · crédito Met CC0. Cadeado/“Conexão segura” só como texto discreto; **não** usar selos falsos (“PCI”, “Site seguro”, bandeiras de antifraude).
9. Google: botão segue guideline de marca do Google; tela de consentimento mostra “Arremate (demonstração)”.

---

## 4) Conflitos e riscos (só sinalizados)

- **C1 — Cartão simulado pode parecer phishing/coleta real.** Um formulário com número/CVV num site de leilão “com cara de real” é exatamente o padrão de phishing; navegador e avaliador podem estranhar, e um usuário pode digitar cartão real. Mitigação proposta: §1.5 + §3.2 (cartão de teste, sem autocomplete, número/CVV nunca enviados, aviso fixo). Alternativa mais segura: cartão só com botão “Usar cartão de teste” e campos mascarados somente leitura. **Decisão do Fernando.**
- **C2 — Escopo contraria docs aprovados:** `docs/requisitos.md` (“Cadastro público não é exigido”; “Nenhum Pix, cartão…”), `briefing-grok.md`/`PROMPT-GROK.md` (sem cadastro, sem Pix/cartão) e a frase atual da Carteira “Sem Pix, cartão ou dados bancários”. Precisa de nova decisão registrada (D17+) superando esses itens.
- **C3 — Design Freeze (D12):** telas Cadastro, Pix, Cartão e Histórico não existem nas pranchas 00–13; é reabertura parcial do Freeze. Proposta: tratar como adendo usando só componentes/tokens congelados, sem mudar paleta, tipografia, raio ou tema. Pranchas novas só se o Fernando pedir (custo de prazo).
- **C4 — Sem recuperação de senha:** com cadastro público, ausência de “Esqueci a senha” fica estranha; incluir exigiria e-mail transacional (dependência/serviço novo). Recomendo deixar fora e sinalizar.
- **C5 — Dependências novas:** Google OAuth no NestJS (ex.: `passport-google-oauth20` ou fluxo manual com `fetch`), primitiva Checkbox/Progress do shadcn (radix-ui já aprovado em D16, mas o componente não está em `components/ui`), credenciais Google Cloud (client ID/secret, URLs de redirect na Vercel). Cada dependência precisa de OK do Fernando (padrão D15/D16).
- **C6 — QR:** gerar QR real pediria lib nova; proposta usa SVG ilustrativo estático (sem dependência). Se quiser QR “escaneável”, é dependência nova.
- **C7 — Schema/back-end:** `User` não tem nome nem provedor OAuth (precisa `name`, `googleSubject`, `passwordHash` opcional); `WalletEntryKind` não distingue Pix/cartão (precisa campo `method`); tabela nova de cartões (só bandeira/last4/validade). Migrations novas.
- **C8 — Prazo 29/10:** OAuth Google + cadastro + Pix + cartão + histórico + next/image + loading/error é muito para ~4 dias junto com o resto (integridade, release, testes R01–R33). Ordem sugerida se faltar tempo: (1) olho na senha + mensagens genéricas + faixa demo + next/image/loading/error; (2) cadastro e-mail; (3) Pix simulado; (4) histórico; (5) cartão; (6) Google por último (mais risco de config).
- **C9 — Pendência anterior:** `PROPOSTA-CONTEUDO.md` (24 lotes, nota do artista, proveniência, estimativa/condition report) ainda não aprovada; seus conflitos C1–C7 seguem abertos, incluindo a divergência entre `/workspace/casa-de-leilao/docs` (diz Freeze não declarado) e o repo (D12 declarado).
