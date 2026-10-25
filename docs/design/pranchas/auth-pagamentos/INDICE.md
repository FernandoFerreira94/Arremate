# Pranchas · Auth e pagamentos simulados (adendo ao Design Freeze D12)

**Fred (UX/UI) · 24/10/2026 · PROPOSTA para aprovação do Fernando.** Base: `../../PROPOSTA-AUTH-PAGAMENTOS.md`. Tokens idênticos aos das pranchas 00–13 (CSS do `src/_gen/gen.py`); nenhum token novo. Ícones lucide (novos SVGs em `../assets/icons/`: eye-off, qr-code, credit-card, flask-conical, user-plus, file-text, arrow-down-left, shield, mail). Sem selo de segurança. Render: Chrome headless, largura 1520 (frame desktop 1440 + frames mobile 390). Fonte HTML em `src/`, gerador `src/gen_ap.py`.

Componentes do repo (`/workspace/arremate-w/repo/front-end/src`) reaproveitados em todas: `components/app/page-shell.tsx`, `components/app/page-states.tsx` (LoadingRows, ErrorState, EmptyState), `components/app/site-header.tsx`, `components/app/site-footer.tsx`, `components/ui/{card,button,input,label,alert,skeleton,tabs,table,badge,alert-dialog,sheet}.tsx`.

| Prancha | Tela | Reaproveita | Estados |
|---|---|---|---|
| `A1-entrar.png` | Entrar: Google + e-mail, PasswordInput com olho | `features/auth/login-form.tsx` (evoluir), Card, Button outline (Google), Input, Alert destructive/warning | A1.1 desktop (senha visível) · vazio · carregando · erro credencial (genérico) · Google em andamento · erro Google · limite de tentativas. Sucesso = redirect `returnTo` |
| `A2-cadastro.png` | Cadastro de licitante (só BIDDER) | Mesmo Card/campos do login; PasswordInput (Input + Button ghost icon) extraído e compartilhado; checkbox de aceite (Checkbox shadcn, pendente C5); medidor de força com tokens destructive/warning/success + texto | desktop preenchido · vazio · senha fraca + confirmação divergente · termos não aceitos · carregando · erro genérico · sucesso → Carteira com EmptyState |
| `A3-carteira-pix.png` | Carteira · depósito, aba Pix | `features/wallet/wallet-page.tsx` (DepositForm, cards de saldo, Table), `components/app/money-input.tsx`, atalhos 1k/5k/10k (D11), limite R$1–100k (D05), Tabs | desktop aguardando · aguardando · gerando QR (Skeleton) · aprovando · sucesso · QR expirado · erro de valor/rede |
| `A4-carteira-cartao.png` | Carteira · aba Cartão de teste (sem campos de cartão) | Mesmo DepositForm/Tabs; Card; Alert info; AlertDialog (remover, Button destructive) | desktop inicial · vazio · cartão de teste salvo · aprovando · sucesso · erro · remover (AlertDialog) |
| `A5-extrato.png` | Extrato | Table de `wallet-page.tsx`, Badge, Tabs (filtro), paginação 8 (padrão D10) | desktop sucesso · sucesso mobile (lista) · vazio · carregando · erro |
| `A6-historico.png` | Meus arremates · aba Histórico | `features/awards/my-awards-page.tsx` (Tabs, Table), `components/app/lot-state-badge.tsx`, Badge | desktop sucesso · sucesso mobile (cards) · vazio · carregando · erro |
| `A7-faixa-rodape.png` | Faixa de demonstração + rodapé com Termos/Privacidade | `site-header.tsx` (visitante ganha “Criar conta”), `site-footer.tsx`, tokens warning/warning-soft | estático (estados não se aplicam) · visitante · logado · mobile |

**Notas para o Codex**
- Faixa: “Ambiente de demonstração · pagamentos simulados · nenhuma obra está à venda” (mobile: versão curta). Substitui o chip “Demonstração · valores simulados” do header.
- Pix: QR é SVG ilustrativo com marca SIMULADO, não BR Code; copia-e-cola `DEMO-…`; sempre aprova; idempotente.
- Cartão: só cartão de teste •••• 4242 e botão “Usar cartão de teste”; nenhum campo de número/CVV; API guarda só bandeira, final e validade.
- Mensagens genéricas: login/cadastro não revelam se o e-mail existe.
- Mobile A6: a lista de abas rola na horizontal (3ª aba parcialmente visível de propósito).

**Conflitos** (detalhe em `PROPOSTA-AUTH-PAGAMENTOS.md` §4): reabertura parcial do Freeze (adendo); docs `requisitos.md`/briefing excluem cadastro/Pix/cartão (precisa D17+); Checkbox shadcn e Google OAuth são dependências a aprovar; texto atual da Carteira “Sem Pix, cartão…” muda; prazo 29/10; `PROPOSTA-CONTEUDO.md` ainda pendente.
