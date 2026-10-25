# Pranchas · Rodada 3 (adendo ao Design Freeze D12)

**Fred (UX/UI) · 24/10/2026 · PROPOSTA para aprovação do Fernando.** Mesmo gerador/CSS das pranchas 00–13 e da rodada auth-pagamentos (`src/gen_r3.py` importa `auth-pagamentos/src/gen_ap.py` → `src/_gen/gen.py`). **Nenhum token alterado.** Render Chrome headless 1520 px (frame desktop 1440 + frames mobile 390). Imagens novas do Met (CC0, verificadas): 45585 (Inrō, quadrada), 459080 (Holbein, vertical), 438817 (Degas, quase quadrada) em `../assets/obras/`. Ícones lucide novos em `../assets/icons/`.

Base de componentes do repo (`/workspace/arremate-w/repo/front-end/src`): `components/ui/{sheet,tabs,card,button,input,label,alert,alert-dialog,badge,skeleton,table}.tsx`, `components/app/{site-header,site-footer,page-states,page-shell,lot-state-badge,money-input}.tsx`, `features/lots/{lot-card,lot-room-page,showcase-page,audit-page}.tsx`, `features/auth/login-form.tsx`, PasswordInput e medidor de força da rodada A1/A2.

| Prancha | Conteúdo | Reaproveita | Componente shadcn novo (radix-ui, D16) | Estados |
|---|---|---|---|---|
| `R1-sheet-auth.png` | Sheet à direita com abas Entrar/Cadastrar/Redefinir + Google; redefinição simulada (“Se o e-mail existir, enviamos um link”) | `ui/sheet.tsx` (já existe), `ui/tabs.tsx`, `login-form.tsx`, PasswordInput, medidor (A2) | — | desktop · entrar · carregando · erro genérico · cadastrar · redefinir · enviado (sempre igual). Mobile: **Sheet em tela cheia** (side right, 100%), não bottom sheet |
| `R2-vitrine-cards.png` | Card de altura fixa (452 px), imagem 220 px `object-contain` sobre `--muted`; vertical, horizontal larga, quadrada, quase quadrada | `features/lots/lot-card.tsx`, `showcase-page.tsx`, `lot-state-badge.tsx`, `page-states.tsx` | — | desktop 4 col · mobile sucesso · carregando · vazio · erro · imagem falhou (sem aviso do Met, D07) |
| `R3-detalhes-dialog.png` | Card enxuto + “Detalhes” abre Dialog com todos os dados (crédito real do Met) | `AboutCard` de `lot-room-page.tsx` (mesmas linhas) | **dialog** | desktop · mobile (Sheet bottom tela cheia) · carregando · erro |
| `R4-hover-lances.png` | Hover card “Últimos lances”: valor, licitante mascarado, horário BRT, intervalo entre lances; no card e na sala | dados de `audit-page.tsx`; lista no estilo `menu` | **hover-card** | desktop card · desktop sala · mobile **toque no contador → Sheet de baixo** · carregando · vazio · erro |
| `R5-header-nav.png` | Navegação central (Leilões ▸ Ao vivo/Agendados/Encerrados; Como funciona; Suporte/FAQ) + menu de perfil (Perfil, Carteira, Creditar saldo, Cartões, Meus lances e arremates, Sair) + navegações extras propostas | `site-header.tsx` (`navFor`), `ui/sheet.tsx` no mobile | **navigation-menu**, **dropdown-menu** | Leilões aberto · perfil aberto · visitante · mobile fechado · hambúrguer aberto |
| `R6-icones.png` | Mapa lucide por conceito (menu, botões, rótulos) + regras de tamanho | lucide (já no projeto) | — | n/a |
| `R7-confirmar-lance.png` | Confirmar lance: miniatura contain 64 px, título Inrō truncado em 2 linhas, valor Fraunces bordô, aviso simulado em linha própria | `ui/alert-dialog.tsx` (já existe) | — | desktop · confirmação · enviando · erro (mínimo mudou) · sucesso |
| `R8-perfil.png` | Perfil: dados, segurança, resumo (carteira, lances, arremates, cartões) | Card, Input, Button | — | desktop · carregando · sucesso ao salvar · erro |
| `R9-faq.png` | Suporte/FAQ com busca, filtros e Accordion | Input, Tabs, Card, `EmptyState` | **accordion** (pedido não listou; também vem do radix-ui) | desktop · mobile · busca vazia |
| `R10-como-funciona.png` | 5 passos + regras essenciais + CTA | Card, Button | — | estático |
| `R11-favoritos.png` | Botão Heart no card (36 px, canto da imagem) e na sala (outline “Favoritar/Favoritado”); página Meus favoritos no menu do perfil; lote encerrado favoritado | `lcard`/grid da vitrine (R2), Tabs, `page-states`, DropdownMenu (R5), Sheet Entrar (R1) | — (gerador `src/gen_r11.py` importa `gen_r3.py`) | botão: normal · ativo (`--primary`, aria-pressed) · carregando (otimista) · não logado → Sheet R1; página: com itens · vazio (CTA vitrine) · carregando · erro · encerrado (imagem 75%, no fim). aria-label por estado; 44 px no mobile |
| `R12-tour.png` | Tour do 1º login (inclui login de teste): overlay black/70 + recorte circular + balão; 7 passos (nav, saldo, card/Detalhes, favoritar, últimos lances, sala/lance, perfil); Pular/Voltar/Próximo, 1/7, “Concluir”; “Ver tour de novo” no menu do perfil | header R5, lcard/fav R11, sala R11, Button, DropdownMenu | — sem lib (Portal + getBoundingClientRect, gerador `src/gen_r12.py`) | 7 passos desktop · mobile (balão ancorado embaixo, passos 1/2/7 no ☰) · foco preso, Esc/←/→ · reduced-motion sem animação |

## Pacotes
- **Nenhum pacote novo exigido.** Sheet, Dialog, HoverCard, NavigationMenu, DropdownMenu e Accordion estão todos no `radix-ui` 1.8.1 (D16); entram como arquivos shadcn em `components/ui/`.
- **Drawer (vaul) não usado**: mobile usa `Sheet side="bottom"`/tela cheia. Se o Fernando quiser arrastar para fechar, aí precisa do `vaul` (pacote novo → aprovação).

## Decisões a aprovar (Fernando)
1. Sheet de auth vira o fluxo principal; `/entrar` fica como fallback (deep link/returnTo). Mobile em tela cheia.
2. Redefinição de senha simulada (contradiz C4 da proposta anterior e `requisitos.md` “sem recuperação”).
3. Card de altura fixa 452 px com imagem contain 220 px (muda o `lot-card` aprovado, que hoje usa `object-cover 4:3`).
4. Toque no mobile → Sheet de baixo para últimos lances.
5. Navegações extras: Encerrando hoje, Auditoria pública e Regras (baixo custo, recomendo); Notificações, Favoritos e Busca (deixar para depois de 29/10).
6. Accordion e página FAQ/Como funciona/Perfil (páginas novas fora das 9 do briefing).
7. Header: chip “Disponível” encurtado para só o valor; nome curto “Ana R.”.

## Conflitos (só sinalizados)
- **Freeze D12 / pranchas 02–05 e 08:** muda o card da vitrine (cover → contain), o header (nav à esquerda → central com menus) e substitui a página Entrar (prancha 08) por Sheet. Adendo, sem tokens novos.
- **Escopo/briefing:** “9 páginas”, “sem cadastro/recuperação” e “nenhum botão sem capacidade” — Perfil, FAQ, Como funciona, redefinir e Cartões ampliam escopo; precisa D17+ registrado.
- **Perfil:** `User` não tem nome (C7 da proposta de auth); edição de nome exige migration. E-mail editável não proposto.
- **Hover/últimos lances:** precisa de endpoint leve (5 últimos lances) ou reuso da auditoria; intervalos calculados no front.
- **Mobile Leilões:** abas da vitrine rolam na horizontal em 390.
- **Prazo 29/10:** rodada grande. Ordem sugerida: R2+R7 (correções visuais) → R5 header → R3 → R1 → R4 → R8–R10.
- **Pendências anteriores:** `PROPOSTA-CONTEUDO.md` e pranchas `auth-pagamentos/` ainda sem aprovação; divergência entre `/workspace/casa-de-leilao/docs` (sem Freeze) e o repo (D12).

## R11 Favoritos — conflitos
- **Tabela nova no banco:** `Favorite(userId, lotId, createdAt)` com PK composta, migration Prisma + endpoints `POST/DELETE /lots/:id/favorite` e `GET /me/favorites`; e o card precisa de `isFavorite` por usuário (quebra cache público da vitrine).
- Contradiz a recomendação da R5 (“Favoritos: médio custo, pós-entrega”) e amplia escopo do briefing → precisa D17+.
- Não logado: favoritar após login exige “intenção pendente” além do returnTo.
- Sem notificações: favoritar não avisa quando encerra (seria a feature de Notificações).

## R12 Tour — conflitos
- **Onde guardar “já viu”:** recomendo `localStorage` (`arremate.tour.v1=done`), sem migration, mas o tour reaparece em outro navegador e após limpar dados, e os logins de teste compartilhados (E2E) vão ver o tour sempre → testes E2E precisam setar a chave. Alternativa `User.tourSeenAt DateTime?`: persistente entre aparelhos, mas migration + endpoint `PATCH /me` (mesmo bloqueio de C7). Decisão do Fernando.
- Overlay bloqueia a vitrine no primeiro acesso do avaliador: Esc/Pular precisam ser evidentes (ok na prancha).
- Passo 6 navega para a sala de um lote ao vivo: se não houver lote ao vivo, pular o passo (6 vira “sala” estática da R11).
- Passos 4 e 5 dependem de R11 (Favoritos) e R4 (hover) aprovados; se reprovados, o tour cai para 5 passos.
- `black/70` é utilitário do Tailwind, não token novo; recorte em `box-shadow` não depende de pacote.
