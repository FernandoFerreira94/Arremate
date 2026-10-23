# HANDOFF-GROK — Design Freeze (etapas 1, 2 e 3)

**Status:** Design Freeze (aprovado por Fernando 23/10). Etapas 1, 2 e 3 desenhadas; D01–D12 em `docs/decisoes.md`.

## 1. Identidade e decisões

**Decisões aprovadas pelo Fernando em 23/10** (Design Freeze D12; logo D09, paginação 8 itens D10, atalhos de depósito 1k/5k/10k D11):

- Nome **Arremate**; logo “A” em Fraunces dentro de moldura de latão sobre quadrado bordô.
- Paleta **Bordô #6E1E2B** e **Latão #A9823A** sobre **papel #F6F3EC**.
- Fontes **Fraunces** (títulos e valores) e **Inter** (UI).
- Atalhos de lance: mínimo, +1 e +2 incrementos.
- Depósito simulado de R$ 1,00 a R$ 100.000,00.
- Vitrine ordenada pelo término mais próximo primeiro.
- Sem aviso ao visitante quando o The Met cair.
- Sem dark mode.

As propostas Galeria Lance, Martelo & Moldura e a paleta Verde-museu & Cobre foram **descartadas** e removidas da prancha 00.

## 2. Tokens (mapeados para as variáveis do shadcn)

**Paleta “Bordô & Latão” (aprovada):** `--background` #F6F3EC · `--card` #FFFDF8 · `--muted` #EEE9DE · `--border` #DDD5C4 · `--foreground` #1F1B16 · `--muted-foreground` #5C5448 · `--primary` #6E1E2B (hover #5A1722) · `--primary-foreground` #FFF8F0 · `--accent`/`--ring` #A9823A.
**Semânticas:** ao vivo #B42318 · agendado #2F5D8A · encerrado #5C5448 · sucesso/íntegro #1E6B45 · aviso/simulado #8A5300 · erro/adulterado #B42318. Cada uma tem fundo suave próprio (ver `src/_gen/gen.py`, `:root`).
**Contraste medido:** tinta/papel 15,4:1 · bordô/papel 10,1:1 · tinta-2/papel 6,7:1 · semânticas sobre o fundo suave ≥ 5,6:1. O latão (3,2:1) só vale para foco e ornamento, nunca para texto.

- **Tipografia:** Fraunces 600 para títulos e valores; Inter para a UI (ambas OFL). Números com `tabular-nums`. Escala: 40 / 28 / 18 / 14 / 12; valor monetário de 32 a 36.
- **Espaço:** base 4 (4, 8, 12, 16, 24, 32, 48, 64). **Grid:** desktop com 12 colunas, margem 40 e gutter 24; mobile com 4 colunas, margem 16 e gutter 12. **Breakpoints:** 640 / 768 / 1024 / 1280.
- **Radius:** `--radius` 6px (sm 4, lg 10, xl 14, full). **Sombras:** sm para cards e botões, md para hover e popover, lg para dialog e toast.
- **Foco:** outline de 2px em `--ring` com offset de 2px. **Toque:** mínimo de 44px; CTA primário com 48px.
- **Camadas:** sticky 10, dropdown 20, overlay 40, dialog 50, toast 60.
- **Motion:** 120 a 200ms com ease-out. Com `prefers-reduced-motion`, não há pulso nem contagem animada.
- **Ícones:** lucide, traço 2. Tamanhos: 16 no texto, 18 a 20 nos botões, 24 a 32 nos destaques.

## 3. Componentes (primitivas shadcn, sem biblioteca extra)

Button (default, outline, ghost, destructive; sm e lg), Card (LoteCard, SaldoCard, PainelDeLance), Badge (StatusLote, Posição, Integridade, Simulado, Origem), Tabs, Input + Label + Form (campo monetário com prefixo R$), Alert, AlertDialog (confirmar lance e depósito), Sheet (menu e depósito no mobile), Table (histórico, compromissos, movimentações), Skeleton, Sonner, Pagination, DropdownMenu + Avatar (alias), Tooltip, ScrollArea.

## 4. Responsivo

- **Vitrine:** grade de 4 colunas no desktop; no mobile, lista de cards horizontais com imagem de 112px e abas em largura total.
- **Sala:** no desktop, 7/5 colunas (obra e atributos à esquerda, painel de disputa à direita). No mobile, imagem, preço e posição ficam acima da dobra, o histórico vem abaixo e o lance fica numa **barra fixa inferior**.
- **Carteira:** no desktop, 8/4 colunas (saldos e listas à esquerda, depósito à direita). No mobile, o Disponível vem primeiro, o depósito abre em Sheet inferior e o CTA é fixo.
- Nenhuma ação obrigatória some no mobile. Ainda é preciso validar 320px e zoom de 200% na etapa 3.

## 5. Leis de UX

| Lei | Onde |
| --- | --- |
| Jakob | Card de catálogo (imagem, título, preço, CTA); cabeçalho com logo à esquerda e conta à direita |
| Fitts | CTA de 48px junto do valor; barra fixa inferior no mobile |
| Hick | Uma ação primária por contexto; 3 abas; 3 atalhos de valor |
| Miller | Carteira com 3 números; blocos de até 4 itens na sala |
| Postel | Campo monetário aceita “1.500”, “1500,00” e “R$ 1500” e mostra o valor entendido |
| Pico-fim | “Você está ganhando” e prorrogação como pico; arremate com comprovante como fim |
| Estética-usabilidade | Estilo editorial sóbrio, sem sacrificar o contraste AA |

## 6. Estados cobertos (etapas 1 e 2; etapa 3 em 8b)

- **Vitrine:** ao vivo, agendado, encerrado, carregando, vazio por aba, erro com nova tentativa, imagem indisponível (prancha 01), catálogo externo fora, visitante, menu mobile.
- **Sala:** ao vivo, ganhando, superado, recusas (abaixo do mínimo, saldo, já lidera, não iniciado, encerrado; as 5 aparecem na prancha 01), prorrogado, reconectando, confirmação indeterminada, pending, agendado, processando resultado, arrematou, sem lances, cancelado, visitante, leiloeiro.
- **Carteira:** com saldo, zero, inválido, confirmação, pendente, sucesso, erro, indeterminado, superado em tempo real, após arremate, carregando.

## 7. Assets e créditos

Todas as imagens vêm do The Met Collection API. Em 23/10/2026 conferi `isPublicDomain=true` em cada uma (licença Open Access CC0). Os arquivos estão em `pranchas/assets/obras/` e foram baixados do campo `primaryImageSmall`.

| Arquivo | Obra | Artista, data | Linha de crédito do Met | URL |
| --- | --- | --- | --- | --- |
| 436105.jpg | The Death of Socrates | Jacques Louis David, 1787 | Catharine Lorillard Wolfe Collection, Wolfe Fund, 1931 | https://www.metmuseum.org/art/collection/search/436105 |
| 45434.jpg | Under the Wave off Kanagawa | Katsushika Hokusai, c. 1830–32 | H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929 | https://www.metmuseum.org/art/collection/search/45434 |
| 436535.jpg | Wheat Field with Cypresses | Vincent van Gogh, 1889 | Purchase, The Annenberg Foundation Gift, 1993 | https://www.metmuseum.org/art/collection/search/436535 |
| 437329.jpg | The Abduction of the Sabine Women | Nicolas Poussin, provavelmente 1633–34 | The Met, obj. 437329 | https://www.metmuseum.org/art/collection/search/437329 · CC0 (isPublicDomain=true, verificado na API em 23/10/2026) |
| 438815.jpg | Madame Georges Charpentier and Her Children | Auguste Renoir, 1878 | Catharine Lorillard Wolfe Collection, Wolfe Fund, 1907 | https://www.metmuseum.org/art/collection/search/438815 |
| 437984.jpg | La Berceuse | Vincent van Gogh, 1889 | The Walter H. and Leonore Annenberg Collection, 1993 | https://www.metmuseum.org/art/collection/search/437984 |
| 10481.jpg | Heart of the Andes | Frederic Edwin Church, 1859 | Bequest of Margaret E. Dows, 1909 | https://www.metmuseum.org/art/collection/search/10481 |

- **Ícones:** lucide-static 1.61.0 (ISC). **Fontes:** Fraunces e Inter (SIL OFL).
- **Metadados (U08):** o favicon, o apple-touch-icon e o OG 1200×630 estão na prancha 00. O OG é genérico e não leva preço, prazo, saldo nem alias. Alt proposto: “Arremate — demonstração de leilões de arte de acervo público com valores simulados”.
- Nenhum espaço precisou do placeholder “referência pendente”, porque todas as imagens têm licença verificada. O padrão do fallback (“Imagem indisponível”) está na prancha 01.

## 8. Rastreabilidade R01–R33 e U01–U11

| Item | Situação | Onde (prancha · estado) ou motivo |
| --- | --- | --- |
| R01 | coberto | Origem The Met + crédito em cards, sala, Criar lote (10 E1) e Auditoria (12) |
| R02 | coberto | Sala E13 (leiloeiro sem lance); Meus lotes 09 só lotes próprios |
| R03 | coberto | Carteira 06/07 (depósito); Sala 04 E1/E10 (lance e arremate) |
| R04 | coberto | Criar lote 10 E1, E6 e M2 (inicial, incremento, início, fim; dados da API não editáveis) |
| R05 | fora do design | deploy é entrega técnica |
| R06 | coberto | Vitrine 02 abas e E7; cancelados fora (09 E1 nota “fora da vitrine”) |
| R07 | coberto | Criar lote 10: E1 (buscar → selecionar → configurar → revisar), E2–E9, M1–M3 |
| R08 | coberto | Meus lotes 09: E1 (Cancelar só sem lances), E2–E5, corrida E4/M3 |
| R09 | coberto | Meus lotes 09: E1 total recebido e resultados; E6 processando fora do total |
| R10 | coberto | Sala 04 E1, E2; 05 M1–M3 |
| R11 | coberto | Sala E6 reconexão, toasts; Carteira E8 |
| R12 | coberto | Carteira 06 E1, 07 M1 |
| R13 | coberto | Meus arremates 11: E1 (arrematados + participações), E2–E7, M1–M3; comprovante e copiar link |
| R14 | coberto | Auditoria 12: E1 sem login, histórico completo paginado (E7), veredito; M1–M3 |
| R15 | coberto | Prancha 01; Sala E3, E4, M2 |
| R16 | coberto | Vitrine E5 (só registro interno, sem aviso ao visitante); Criar lote 10 E4; dados persistidos em sala/auditoria/comprovante. Também depende da arquitetura |
| R17 | coberto | Sala E8 e recusas “não começou”/“encerrado” |
| R18 | coberto | Campo de lance (mínimo/incremento); recusa abaixo do mínimo |
| R19 | coberto | Sala E2: liderando, botão bloqueado |
| R20 | coberto | Carteira: total − comprometido = disponível |
| R21 | coberto | Carteira E8; toast de superado |
| R22 | coberto | Recusa por saldo (Sala E4, M2) |
| R23 | coberto | Cronômetro e prorrogação (01; Sala E5, M3); nota em Criar lote 10 |
| R24 | coberto | Sala E9/E10; Carteira E9; Comprovante 13 E1–E7 e M1–M3; Meus lotes 09 total recebido |
| R25 | coberto | Sala E11; Meus lotes 09 “Sem lances”; Auditoria 12 E5 |
| R26 | coberto | Auditoria 12: E3 adulterado (linha destacada), E6 evidência de remoção, M2; texto “Como a verificação funciona” (HMAC encadeado + âncora independente) |
| R27 | coberto | Só aliases em Sala, Auditoria 12 e Comprovante 13; nota “não contém dados pessoais” |
| R28 | fora do design | escolha de stack (React + Node + PostgreSQL) |
| R29 | fora do design | prazo de entrega |
| R30 | fora do design | seed; as pranchas só citam as contas demo em Entrar 08 |
| R31 | fora do design | README |
| R32 | fora do design | repositório e link de deploy |
| R33 | fora do design | declaração de uso de IA (registrar no README) |
| U01 | fora do design | stack |
| U02 | coberto | acervo público do The Met em todas as pranchas |
| U03 | coberto | prorrogação endsAt = aceite + 120s (01, Sala E5/M3) |
| U04 | coberto | pranchas e design system entregues e aprovados por Fernando; Design Freeze declarado em 23/10 (D12) |
| U05 | fora do design | processo (documentar, testar, revisar código) |
| U06 | fora do design | Project Lifecycle/Boot no README |
| U07 | coberto | só primitivas shadcn, escopo do PDF, sem extras (sem cadastro/recuperação em Entrar 08) |
| U08 | coberto | prancha 00 seção 8 + arquivos reais em pranchas/assets/meta/ |
| U09 | fora do design | hospedagem (Vercel + API separada) |
| U10 | fora do design | README no Notion |
| U11 | fora do design | organização da pasta de decisões e prompt |

Páginas sem requisito próprio: **Entrar 08** (E1–E7, M1–M3: inválido, credenciais inválidas genéricas, enviando, limite, sessão expirada, erro de rede; retorno ao lote de origem).

## 8b. Etapa 3 — estados por página

| Página | Rota | Desktop 1440 | Mobile 390 |
| --- | --- | --- | --- |
| Entrar | `/entrar` | E1–E7 | M1–M3 |
| Meus lotes | `/painel/lotes` | E1 lista/total, E2 confirmar cancelamento, E3 cancelando, E4 corrida perdida, E5 cancelado, E6 processando, E7 vazio, E8 carregando, E9 erro | M1 lista, M2 confirmar (sheet), M3 corrida |
| Criar lote | `/painel/lotes/novo` | E1 fluxo completo, E2 buscando, E3 sem resultados, E4 The Met fora, E5 obra não apta, E6 erros de campo, E7 publicando, E8 sucesso, E9 erro ao publicar | M1 buscar/selecionar, M2 configurar com erro, M3 revisar/publicar |
| Meus arremates | `/meus-arremates` | E1 arrematados + participações, E2 sem participações, E3 sem arremates, E4 apurando, E5 link copiado/erro, E6 carregando, E7 erro | M1 arrematados, M2 participações, M3 vazio |
| Auditoria | `/lotes/:id/auditoria` | E1 íntegro, E2 verificando, E3 adulterado, E4 indeterminado, E5 sem lances, E6 lote removido, E7 paginação | M1 íntegro, M2 adulterado, M3 indeterminado |
| Comprovante | `/comprovantes/:token` | E1 válido, E2 carregando, E3 404, E4 indisponível, E5 adulterado, E6 não verificável, E7 impressão | M1 válido, M2 adulterado, M3 não encontrado |

## 8c. Assets de metadados (U08)

`pranchas/assets/meta/`: `favicon.svg` (32, “A” em Fraunces vetorizado, sem dependência de fonte), `favicon.ico` (32×32), `apple-touch-icon.png` (180×180), `og-image.png` (1200×630). Alt do OG: “Arremate — demonstração de leilões de arte de acervo público com valores simulados”. Imagem do OG: Van Gogh, *Wheat Field with Cypresses*, 1889, The Met obj. 436535, CC0, recortada sem a borda escura (`assets/meta/og-art-436535.jpg`). `favicon.svg` agora traz o “A” em Fraunces (wght 700) vetorizado da fonte, igual ao .ico e ao apple-touch-icon. Fontes HTML: `pranchas/src/meta-og.html` e `meta-icon.html`.

## 9. Pendências

1. Validar foco por teclado, leitor de tela, 320px e zoom 200% (as pranchas são HTML estático).
2. Aprovado (Fernando, 23/10): paginação da vitrine com 8 itens (D10) e atalhos de depósito 1k/5k/10k (D11).
3. Texto exato das recusas e códigos de erro precisam bater com o backend.
4. Resolvido (decisão do diretor de design, 23/10): lote 0016 passou a usar *O rapto das sabinas* (Poussin), obra única por lote.
5. Resolvido (23/10): favicon unificado com o “A” em Fraunces e borda escura do OG recortada.
6. Aprovado: Design Freeze declarado por Fernando em 23/10 (D12). Seguem pendentes só os itens 1 (a11y, na implementação) e 3 (textos/códigos de erro com o back).
