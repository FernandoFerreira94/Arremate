# Decisões — índice de autoridade e pendências

Atualizado em 23/10/2026. Documento de consulta rápida; o detalhamento permanece nos arquivos vinculados. Decisão expressa de Fernando vence proposta técnica; mudança de regra do PDF precisa ser explicitada, nunca presumida.

## Definido por Fernando

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| U01 | React + Node.js + PostgreSQL | [Requisitos](requisitos.md) |
| U02 | Obras de arte de acervo público | [Requisitos](requisitos.md) |
| U03 | Lance na janela final renova fim para 120s após aceitação | [Regra e fronteiras](requisitos.md) |
| U04 | Grok cria pranchas e design system; Fernando aprova | [Briefing](design/briefing-grok.md) |
| U05 | Decisões/pontos importantes documentados; testes documentados e review obrigatório | [Qualidade](qualidade.md) |
| U06 | Seguir Project Lifecycle desde o início e registrar Boot no README | [Lifecycle](lifecycle.md) |
| U07 | Qualidade próxima de produção, clean code, manutenção simples e escopo fiel ao PDF | [Arquitetura](superpowers/specs/2026-10-23-casa-leiloes-design.md) |
| U08 | Foco também nos metadados do site | [Metadados](metadados.md) |
| U09 | Site na Vercel + API Node persistente separada | [Hospedagem](hospedagem.md); limite confirmado por Fernando |
| U10 | Manter README no Notion; copiar ao repositório no final | [README — em elaboração](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82) |
| U11 | Organizar pasta completa de decisões/detalhes e entregar instrução para Grok iniciar pranchas | [Índice](INICIO.md) e [prompt](design/PROMPT-GROK.md) |
| U12 | Criar casadeleilao e instalar base local, aguardando design | [Ambiente](ambiente.md); exceção de bootstrap antecipado, sem autorizar produto |
| U13 | Plano de toda a lógica; shadcn obrigatório; nome/logo/paletas com Grok | [Plano](superpowers/plans/2026-10-23-casa-leiloes.md) e [decisões visuais](design/DECISOES-VISUAIS.md) |

## Propostas técnicas, ainda não congeladas

Os IDs A01-A13 estão no [registro de arquitetura](superpowers/specs/2026-10-23-casa-leiloes-design.md), com recomendação, alternativa e trade-off. Bootstrap escolheu Next App Router, NestJS e Prisma, com versões fixadas no lockfile; motivos/alternativas permanecem na spec. Sessão, SSE, Met, HMAC/testemunha e operação ainda são propostas de implementação a provar. A09 agora incorpora a fronteira aprovada Vercel/web + API persistente separada. Provedores, custo e proxy de produção ainda precisam ser fechados; metadados usam a API nativa Next no servidor; a proposta anterior de um único servidor para todo o site foi substituída.

Nove páginas é a organização mínima proposta para cumprir o PDF. Cores, fontes, marca, raio, tema e layout foram produzidos pelo Grok e aprovados por Fernando (D01–D12, abaixo); não importar visual Axion/Colinas nem presumir dark mode. U13 tornou shadcn obrigatório. CLI e dependências base estão instalados; components.json/tema/componentes finais derivam do HANDOFF na Tarefa 8. Nome **Arremate**, logo e paleta aprovados; “Casa de Leilões” fica só como nome interno.

## Pendências que afetam implementação

- Architecture Freeze restante: sessão/CSRF, topologia real e prova de integridade. Frameworks do bootstrap: Next/Nest/Prisma; não reabrir por hábito.
- Onde executar API contínua, banco, mídia e testemunha; custo/backup e fronteira com Vercel.
- Política de indexação da demo e domínio real de produção.
- Design Freeze declarado; S6 aceito com HTML/PNG como fonte visual, sem Penpot (D13); itens abertos do S5 ficam como risco, decididos por tarefa; implementação autorizada a partir da Tarefa 1 (migration só local, commits locais, sem push).

Essas pendências não impedem explorar os fluxos e pranchas já especificados, mas impedem declarar o handoff de implementação aprovado. O Grok não deve resolver infraestrutura ou mudar regras de negócio por conta própria.

## Segurança e qualidade não negociáveis

Saldo e prazo pertencem ao backend; transação/locks/retry/idempotência; leiloeiro sem lance; propriedade de lote validada; liquidação única; aliases sem PII; detectar adulteração direta de DB com âncora adequada; não depender de API externa para ler lote já publicado. Cada capacidade exige teste e review com evidência. Detalhes e testes em arquitetura/qualidade, sem duplicar aqui.

## Design aprovado por Fernando em 23/10/2026 (adição)

Design Freeze declarado depois em 23/10 (D12, abaixo); S6/S7 continuam pendentes. Detalhe no [HANDOFF-GROK](design/HANDOFF-GROK.md) e no [plano, seção PD (complementa as Tarefas 8 e 9)](superpowers/plans/2026-10-23-casa-leiloes.md).

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D01 | Nome do site: **Arremate** | [HANDOFF §1](design/HANDOFF-GROK.md) |
| D02 | Paleta Bordô #6E1E2B, Latão #A9823A, papel #F6F3EC | [HANDOFF §2](design/HANDOFF-GROK.md) |
| D03 | Fontes Fraunces (títulos/valores) + Inter (UI) | [HANDOFF §2](design/HANDOFF-GROK.md) |
| D04 | Atalhos de lance: mínimo, +1 e +2 incrementos | [Pranchas 04/05](design/pranchas/INDICE.md) |
| D05 | Depósito simulado de R$ 1 a R$ 100 mil | [Pranchas 06/07](design/pranchas/INDICE.md) |
| D06 | Vitrine ordenada pelo término mais próximo | [Pranchas 02/03](design/pranchas/INDICE.md) |
| D07 | Sem aviso ao visitante quando o The Met cair (só registro interno) | [HANDOFF §8 R16](design/HANDOFF-GROK.md) |
| D08 | Sem dark mode | [HANDOFF §1](design/HANDOFF-GROK.md) |

**Pendências de design não aprovadas:** paginação da vitrine com 8 itens; atalhos de depósito 1k/5k/10k; textos e códigos de erro a alinhar com o back-end. **Design Freeze não declarado.** _(Superado em 23/10/2026 por D09–D12 abaixo.)_

Supera os itens ABERTO de nome, paleta, tipografia e tema em [decisões visuais](design/DECISOES-VISUAIS.md); logo e raio/grid/sombra/motion foram aprovados no Design Freeze (D09/D12).

## Design Freeze — aprovação de Fernando em 23/10/2026 (adição)

Fernando: “aprovo tudo”. S6/S7 e a autorização de código **não** foram declarados.

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D09 | Logo: “A” em Fraunces em moldura de latão sobre quadrado bordô, como proposto no HANDOFF | [HANDOFF §1/§8](design/HANDOFF-GROK.md) |
| D10 | Paginação da vitrine com 8 itens | [Pranchas 02/03](design/pranchas/INDICE.md) |
| D11 | Atalhos de depósito R$ 1 mil, 5 mil e 10 mil | [Pranchas 06/07](design/pranchas/INDICE.md) |
| D12 | **Design Freeze** declarado por Fernando em 23/10/2026 | [Decisões visuais](design/DECISOES-VISUAIS.md) |

Pendentes para a implementação: validar a11y (teclado, leitor de tela, 320px, zoom 200%) e alinhar textos/códigos de erro com o back-end.

## Liberação da implementação — Fernando, 23/10/2026 10:26 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D13 | Fernando: “Libero: aceito HTML/PNG sem Penpot, arquitetura em aberto como risco, e Tarefa 1 com migration local e commits locais”. S6 aceito com as pranchas HTML/PNG como fonte visual; itens abertos do S5 (sessão/CSRF, topologia, testemunha, fornecedor/custo de API/DB, proxy/SSE Vercel, indexação) viram risco, decididos na tarefa que os usa; implementação autorizada a partir da Tarefa 1, migration só no banco local, commits locais, **sem push**/deploy | [Pranchas](design/pranchas/INDICE.md), [plano](superpowers/plans/2026-10-23-casa-leiloes.md) |

## README e Notion sempre atualizados — Fernando, 23/10/2026 10:27 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D14 | Fernando: “e não esquece de ir atualizando o arquivo do Notion, o README do projeto, isso é importante”. `README.md` e a página Notion “README — em elaboração” têm o mesmo conteúdo e são atualizados a cada tarefa concluída, refletindo o estado atual. **Supera a regra U10** (“README completo só no Notion, copiar no encerramento”) | [README](../README.md), [AGENTS.md](../AGENTS.md) — “Documentação viva” |

## Handoff registrado na Tarefa 1 (23/10/2026)

Artefatos congelados, sem Penpot (D13). Fonte visual: [HANDOFF-GROK](design/HANDOFF-GROK.md) (Design Freeze, etapas 1–3, 23/10) e [pranchas 00–13](design/pranchas/INDICE.md) (HTML em `src/`, PNG exportado). Identidade D01–D12. S6 aceito com esse HTML/PNG. S5 não está PASSED: sessão/CSRF, topologia, testemunha, fornecedor/custo de API/DB, proxy/SSE na Vercel e indexação permanecem risco, decididos na tarefa que os usa. S7 não foi declarado. A Tarefa 1 foi autorizada mesmo assim (D13): migration só local, commits locais, sem push/deploy.

Pendências que seguem abertas: validação de a11y; textos/códigos de erro alinhados ao back; escolha concreta de topologia antes do release. Nada é contratado automaticamente.

Contrato de dinheiro e tabelas desta tarefa: [api.md](api.md) e `back-end/prisma/schema.prisma` (migration `20261023104706_auction_core`).

## Integridade provada na Tarefa 2 (23/10/2026)

A08, no recorte local: HMAC-SHA-256 encadeado e testemunha em disco fora do PostgreSQL. A ordem é assinar, gravar `pending`, commit no banco, promover o checkpoint e só então responder. Gap de confirmação fica INDETERMINATE e bloqueia mutação; o banco suspeito não é reassinado. Detalhe: [operacao-integridade.md](operacao-integridade.md).

Continua risco do S5, sem contratação: diretório de produção da testemunha, fsync de diretório no Linux (neste Windows o ensaio devolve EPERM) e a topologia da API. A rota HTTP de auditoria não existe ainda.

## Sessão decidida na Tarefa 3 (23/10/2026)

D13 deixou sessão/CSRF e o proxy para a tarefa que os usa. Ficou assim, só local:

- Senha Argon2id com o mínimo OWASP atual: m=19456, t=2, p=1 (`@node-rs/argon2` 2.2.2). A13 pedia Argon2id; o Node não traz o algoritmo. Dependência aprovada por Fernando (D15).
- Sessão de 256 bits, só o SHA-256 no banco, validade absoluta de 8 horas, revogação no logout. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. Em produção: `Secure` e nomes `__Host-session` / `__Host-csrf`.
- CSRF é HMAC do segredo da pré-sessão ou do token de sessão. O JSON devolve o HMAC, não o cookie. Mutação exige `Origin` exato (`http://127.0.0.1:3300` e, se existir, `WEB_ORIGIN` sem caminho) e o cabeçalho `X-CSRF-Token`. Origem ausente não autoriza.
- O IP do limite é o da conexão. `X-Forwarded-For` e `Host` não escolhem cliente nem origem. `trust proxy` fica desligado. Limites na memória de uma instância: login 10/min/IP, mutação 60/min/ator, catálogo 30/min/ator, auditoria 30/min/IP, SSE 3 conexões. Catálogo, auditoria e SSE ainda não têm rota; as tarefas 4 e 9 precisam chamar o limitador.
- `returnTo` só aceita rota local das nove páginas. A tabela `users` não tem alias; `GET /api/auth/me` devolve só `role`, sem e-mail.
- O rewrite `/api` do Next não repassou o cookie. O same-origin ficou em `front-end/src/app/api/[...path]/route.ts`, com lista fechada de cabeçalhos. SSE por esse proxy não foi ensaiado.

Contrato: [api.md](api.md). Evidência: [2026-10-23-tarefa-3.md](evidence/2026-10-23-tarefa-3.md).

## Dependência de hash de senha — Fernando, 23/10/2026 14:21 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D15 | Fernando: “Aprovo o @node-rs/argon2”. A dependência `@node-rs/argon2` 2.2.2 (Argon2id m=19456, t=2, p=1), adicionada na Tarefa 3 fora da lista do plano, fica aprovada; A13 resolvida com Argon2id em vez da alternativa scrypt | Commit `92df234`, [api.md](api.md) |

## Dependência de componentes — Fernando, 23/10/2026 20:09 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D16 | Fernando: “Aprovo o radix-ui”. O pacote `radix-ui` 1.8.1 (versão exata no lockfile), base das primitivas oficiais do shadcn (Dialog, AlertDialog, Tabs, Slot do Button), fica aprovado para a Tarefa 8 em diante | `front-end/package.json`, `package-lock.json` |

## D17 — Entrada animada — 24/10/2026

Fernando aprovou explicitamente a proposta com “Aprovar e implementar”: splash de cerca800ms com A/Fraunces e moldura latão sobre papel, sem som, uma vez por sessão da aba. Em seguida, fade e deslocamento até8px na montagem das páginas; sem reiniciar por alteração de lance/saldo/cronômetro. Movimento reduzido, storage bloqueado e interação por teclado/ponteiro/foco liberam acesso imediatamente.

Implementação nativa CSS, sem dependência/configuração nova. Preserva D01–D12 e shadcn; movimentos individuais200ms, sequência total do splash800ms incluindo pausa/saída. [Plano](superpowers/plans/2026-10-24-entrada-animada.md) e [evidência](evidence/2026-10-24-entrada-animada.md). Não implica aprovação de release/deploy.

## D18 - Conteúdo de demonstração (proposta do Fred) - 24/10/2026

Fernando, 24/10 08:28: "Aprovo a proposta do Fred com estimativa e laudo marcados como simulados". Seed com 24 obras CC0 do The Met (idempotente, pelos serviços normais; "Encerrando" é derivado do tempo restante, não é estado novo). Campos novos no lote: estimativa (`estimate_low_cents`/`estimate_high_cents`) e laudo de conservação (`condition_report`), sempre exibidos como "Simulado para demonstração". UI: nota do artista, proveniência com link "Ver no The Met", técnica e nº de lances no cartão. Migration `20261024090000_lot_simulated_estimate`. Sem dependência nova; não implica release/deploy. [Proposta](design/PROPOSTA-CONTEUDO.md), [evidência](evidence/2026-10-24-conteudo-demo.md). (Numerada D18 porque D17 já foi usada pela entrada animada.)

## D19 — Ritmo mais lento — 24/10/2026

Fernando: “ainda assim está muito rápido, deixa mais devagar, vamos usar3s e mais devagar as entradas dos componentes na página”. Substitui os tempos iniciais de D17: splash3000ms; saída800ms a partir de2200ms; moldura1200ms; nome900ms; componentes850ms; intervalos100–600ms nos cards e160/300/440ms nos blocos. Mantém até8px, sessão única, identidade, reduced-motion e interrupção por interação. Foco no conteúdo cancela a sequência dessa rota persistentemente, para não esconder campos nem reanimar ao desfocar.

## D20 — Supabase somente PostgreSQL — 24/10/2026

Fernando definiu Supabase como banco, com Prisma e duas conexões (`DATABASE_URL` runtime, `DIRECT_URL` para CLI/migrations). Sem Supabase Auth, PostgREST, Storage nem RLS como regra de negócio; autorização no Nest. API persistente com Session pooler 5432 e papel `auction_app` sem DDL; migrations por papel separado/conexão direta ou Session. Data API desativada antes das tabelas. TLS com validação de certificado; guia e limitações em [hospedagem](hospedagem.md#supabase-somente-postgresql--d20-preparação-local-24102026).

Retomada de Fernando autoriza adiantar esta etapa independente das pranchas do Fred. D19 já pertence à calibragem da entrada e foi preservada. Esta é a preparação da etapa 7; etapas 1–6 de auth/pagamentos não são declaradas concluídas. Nenhuma conexão, migration, seed ou deploy hospedado autorizado/executado. [Plano](superpowers/plans/2026-10-24-preparacao-supabase.md) e [evidência](evidence/2026-10-24-auth-pagamentos.md).

## D22 — Rodada 3 de pranchas (adendo ao Freeze D12) — 24/10/2026

_Registrada como D21 na branch `feat/rodada-3`; renumerada para D22 no merge de 25/10/2026 porque a `chore/bootstrap` já usava D21 (adendo A7). Conteúdo preservado sem cortes._

Fernando aprovou em 24/10 as pranchas R1–R10 do Fred como adendo ao Freeze D12: entrar/cadastrar/redefinir em Sheet lateral, redefinição de senha simulada (mensagem neutra, sem chamada de rede), imagens dos lotes em `object-contain` com card de altura fixa, e as páginas novas Perfil, Suporte/FAQ e Como funciona. D19 e D20 já estavam ocupadas. Sem pacote novo (vaul fora; Sheet/HoverCard/DropdownMenu/NavigationMenu/Accordion vêm do `radix-ui` aprovado em D16). Cadastro, Google, cartões e nome no perfil ficam como casca com TODO para a integração de auth/pagamentos. Pranchas em [rodada-3](design/pranchas/rodada-3/INDICE.md); [evidência](evidence/2026-10-24-rodada-3.md).

**Adendo D22 — Favoritos (R11).** Fernando pediu em 24/10 às 17:00 implementar favoritos agora, contrariando a recomendação da R5 de adiar. Tabela `favorites` (userId, lotId, createdAt; PK composta; FK só para `users`, sem FK para `lots` para não quebrar o TRUNCATE do E2E) com migration aplicada só nos bancos locais 5462/5463. Rotas `GET /api/me/favorites`, `PUT`/`DELETE /api/lots/:id/favorite` atrás de sessão + CSRF. A vitrine pública mantém o cache; o estado do coração vem de busca separada no cliente. Sem notificações.

**Adendo D22 — Tour (R12).** Fernando pediu em 24/10 às 17:05 (ajuste às 17:09: recorte acompanha a forma do componente, sem círculo, com transição de ~250 ms e tooltip com entrada/saída scale 0.95 + fade). Sem biblioteca. Persistência em `localStorage` (`arremate.tour.v1.<userId>`), sem migration; `GET /api/me/id` existe só para essa chave e deve ser dobrado em `/auth/me` na integração de auth (TODO).

**Adendo D22 — Próximo leilão, Avise-me, notificações e rodapé (H2, N1–N4, F3-cor).** Fernando pediu em 25/10 às 08:21. Hero H2 acima da vitrine mostra o lote agendado mais próximo (`GET /api/lots/next`, público), com contagem e "Avise-me quando abrir"; some quando não há agendado. No card agendado, "Abrir sala" vira "Avise-me"/"Avisaremos". Tabelas `lot_watches` (PK userId+lotId) e `notifications` (única por userId+lotId+kind, guarda as 20 mais recentes por usuário), FK só para `users`, com migration aplicada só nos bancos locais 5462/5463 (autorizada). Rotas `GET /api/me/watches`, `PUT`/`DELETE /api/lots/:id/watch` (409 se o lote já abriu; cancelar apaga a inscrição), `GET /api/me/notifications`, `POST /api/me/notifications/:id/read` e `/read-all`, atrás de sessão + CSRF como favoritos. Como o estado do lote é derivado do horário, um `NotificationRunner` na API varre a cada 5 s as inscrições cujo lote abriu, gera a notificação (idempotente) e consome a inscrição; desligado em `NODE_ENV=test`. O cliente faz polling de 30 s (sem SSE novo). Sino no header atual à esquerda do saldo (36 px desktop, 44 px mobile, só logado), painel em Popover no desktop e Sheet no mobile. Toast de 8 s só com o site aberto e nunca na sala do próprio lote; o Sonner não está instalado, então o toast é um componente local (`components/app/toast.tsx`), sem dependência nova. Rodapé F3-cor em `--primary` sem token novo; como não existem páginas de Termos e Privacidade, o grupo LEGAL aponta para Regras (`/como-funciona#regras`) e Auditoria (`/como-funciona#auditoria`), e FAQ aponta para `/suporte`. Seed: o lote 0010 passa a ser o agendado mais próximo (+3 h) e 0025 vai para +1 dia; 0010 e 0014 seguem como agendados conforme a PROPOSTA-CONTEUDO, e o "0018 agendado" das pranchas do Fred é só ilustração. Pranchas em [hero](design/pranchas/hero/INDICE.md), [notificações](design/pranchas/notificacoes/INDICE.md) e [rodapé](design/pranchas/footer/INDICE.md).

**Adendo D22 — Carrossel do hero (H2b).** Fernando pediu em 25/10 às 09:29: setas para ver os próximos agendados, no máximo 5, passando sozinho a cada 4 s. Nova rota pública `GET /api/lots/upcoming?limit=5` (limite entre 1 e 5; valor inválido vira 5), pela ordem de abertura. `GET /api/lots/next` continua, agora como o primeiro item da mesma consulta. Carrossel em CSS puro, sem biblioteca: fade com deslocamento de 16 px em 300 ms; setas de 44 px nas laterais no desktop e na linha dos pontos no mobile, com swipe (40 px); pontos clicáveis com "Leilão N de T"; autoplay em loop que pausa no hover, no foco e com a aba oculta; Pausar/Retomar manual que não retoma sozinho; com reduced-motion, sem autoplay, sem animação e sem Pausar; ←/→ com o foco no carrossel; slides fora de vista com `inert`; aria-live "off" no autoplay e "polite" no resto; contagem e Avise-me por slide; com 1 lote, sem controles. O seed já cria 8 agendados com datas relativas ao momento do seed (0010 +3 h, 0014 +2 dias, 0025–0030 entre +1 e +5 dias). Diferente da nota da prancha ("não completar até 5"), mostramos até 5 a pedido do Fernando.


## D24 — Cadastro, Google OAuth e pagamentos simulados — 26/10/2026

Fernando pediu em 25/10 às 10:46 cadastro e login reais, Google OAuth e pagamentos simulados no checkout principal, seguindo a [proposta](design/PROPOSTA-AUTH-PAGAMENTOS.md), as pranchas A1–A7 e a D20 (Supabase só como PostgreSQL, autorização no Nest). O Codex começou e parou no limite; o trabalho dele foi revisado, teve os acentos corrigidos e foi concluído. D23 fica reservada para o vínculo do Google com e-mail diferente, ainda não aprovado.

- **Cadastro e login:** `POST /api/auth/register` cria só BIDDER (nome, e-mail, senha de 8 a 128, aceite obrigatório), com Argon2id, a sessão em cookie e o CSRF existentes. E-mail duplicado recebe resposta genérica, sem revelar a conta. `GET /api/auth/me` devolve papel, `userId` e nome; `GET /api/me/id` saiu e a chave do tour usa o `userId` da sessão. O nome aparece no header e no Perfil.
- **Google OAuth:** feito com fetch, sem dependência nova. Usa PKCE S256, `state` ligado ao navegador e com uso único, `nonce` e verificação RS256 pelas chaves públicas do Google. Configuração só por `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI`. Sem essas variáveis, o botão fica desabilitado com "indisponível na demo". Um e-mail local só é vinculado na mesma sessão autenticada do dono.
- **Cartão de teste (A4):** um por usuário, só Visa 4242 com validade 12/2034. O banco guarda bandeira, final e validade; nunca PAN nem CVV, e a API recusa esses campos.
- **Depósitos Pix e cartão:** simulados e sempre aprovados. O crédito é feito no backend, em transação e com `Idempotency-Key`; o mesmo pedido nunca credita duas vezes. Limite de 100 a 10.000.000 centavos por depósito. O QR do Pix é ilustrativo.
- **Histórico e Carteira:** extrato paginado com filtro (`/api/wallet/entries`); Meus arremates com abas Arremates, Participações e Histórico, com os lances do usuário. A Carteira tem links próprios por aba (`/carteira?aba=pix` e `?aba=cartao`).
- Migration `20261025103000_auth_payments` aplicada só nos bancos locais 5462 e 5463, com autorização de Fernando. Sem push, sem deploy e sem credencial Google criada.


## D25 — Mensagens de erro, toasts e tela de erro — 26/10/2026

Fernando aprovou em 26/10 às 09:26 o plano [erros e toasts](superpowers/plans/2026-10-25-erros-e-toasts.md) e as pranchas [T1, T2 e E1](design/pranchas/toast/INDICE.md), com G1 (dependência `sonner`, versão exata) e G2.

- **API:** mutações só acrescentam `message` em pt-BR; textos e códigos em `common/messages.ts`; novos códigos `LIMITE_CONEXOES` (429) e `LOTE_JA_ABERTO` (409). Tabela da auditoria B0 em [api-mensagens.md](api-mensagens.md): 15 endpoints corrigidos de 43.
- **Observabilidade:** `ErrorReporter` só registra em log (sanitiza e-mail, token e números; dedupe de 60 s; 30/min). 5xx (exceto 503) e erros não tratados do processo são capturados. `POST /api/client-errors` recebe os erros do navegador (origem, 8 KB, 20/min por IP).
- **Toasts (Sonner):** só tema claro; canto inferior direito no desktop e topo central no celular; até 3 visíveis; sucesso 4 s, aviso 6 s, erro 8 s; com ação fica até fechar. Erro de API mostra o código de suporte inteiro com botão Copiar. 401 leva ao `/entrar`. Favorito removido oferece "Desfazer" (o PUT é idempotente). O toast próprio e o N4 migraram para o Sonner.
- **Tela de erro (E1):** "Algo deu errado", Tentar de novo, Voltar à vitrine e o código; `global-error` próprio recarrega com `location.reload()`. Rota `/teste-erro` só existe com `NEXT_PUBLIC_E2E_ERRORS=1`.
- **#418:** o novo relato de erros do cliente mostrou o aviso de hidratação em `/painel/lotes/novo` e `/carteira`; a causa não foi isolada nesta rodada e fica aberta.
- Sem migration, sem push e sem deploy.

## D26 — Achados da Sentinela: IP real, cabeçalhos do front e cotas — 26/10/2026

Fernando aprovou em 26/10 a correção de M1, M2, B1 e B3, sem dependência nova e sem store compartilhado.

- **M1 (login travado por IP único):** o proxy `/api` do Next repassa um único `X-Forwarded-For` (o IP do cliente, validado) e o Nest usa `trust proxy` = loopback, ou seja, só confia no salto local. O limite de login (10/min por IP) passou a contar depois da checagem de Origin e CSRF, e há um limite novo de 10/min por e-mail. Limite conhecido: o `next start` exposto direto aceita o `X-Forwarded-For` enviado pelo cliente (o Next só preenche quando falta); o limite por e-mail segura esse caso, e na hospedagem a borda reescreve o cabeçalho.
- **M2 (cabeçalhos do front):** CSP com nonce por requisição no `proxy.ts` (o script inline de entrada do `layout.tsx` usa o nonce; o layout passa a ser dinâmico), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` em todas as rotas pelo `next.config.ts`, e HSTS só em produção. `form-action` inclui `accounts.google.com` para o início do Google.
- **B1:** erros do navegador têm cota própria no `ErrorReporter` (20/min, separada dos 30/min do servidor), e o limite de `/api/client-errors` usa o IP real.
- **B3:** `/api/events` aceita no máximo 3 streams por IP real (`tryAcquireSse`), liberados ao fechar.
- Sem migration, sem push e sem deploy.

## D21 — Adendo A7 e recursos Next — 24/10/2026

Pedido de Fernando autoriza etapa1 do adendo auth/pagamentos após entrega das pranchas A1–A7: faixa fixa de pagamentos simulados, links funcionais para Termos/Privacidade/Como funciona, next/image nos sete arquivos (oito imagens), loading/error por rota e OG por lote. Reutilizar tokens/componentes existentes; manter next/font, metadata,404 raiz e motion paralelo. Prioridade só na imagem principal da Sala; Next16 usa preload no lugar da prop priority obsoleta. Sem pacote novo nem mudança de schema/auth.

Pranchas em docs/design/pranchas/auth-pagamentos; A7 aplicada neste recorte. Cadastro/Google/Pix/cartão/histórico continuam para etapas próprias; visitante não recebe link Criar conta antes de a rota existir. Conflitos de proposta e Freeze registrados na evidência, sem alterar DECISOES-VISUAIS.md. Plano: superpowers/plans/2026-10-24-auth-pagamentos-etapa-1.md.

## D27 — Botões de conta demo ligados por padrão — 26/10/2026

Os botões "Entrar como licitante/leiloeiro de teste" só apareciam com `NEXT_PUBLIC_DEMO_LOGIN=true`, que nenhum ambiente define. Agora ficam ligados por padrão; `NEXT_PUBLIC_DEMO_LOGIN=false` os desliga na build. Usam o login normal, com os mesmos limites. Commit `54a7e12`.

## D28 — Zoom da obra (prancha Z3) — 26/10/2026

- Clique na imagem do lote abre um Dialog com zoom 1x→2x→3x, arrastar, barra −/+/reset e minimapa. No celular: tela cheia, pinça até 4x e toque duplo alterna 1x/2,5x. Teclado: Esc, +, −, 0 e setas; foco preso e devolvido ao gatilho.
- Estados: placeholder borrado ao carregar, "Tentar de novo" no erro, sem animação com reduced-motion. Lógica no hook reutilizável `useZoom` (`lib/zoom.ts`).
- Imagens ~2500px só no zoom (`/api/media/zoom/:key`, cache de 1h; sem a hi-res, volta à imagem normal). Geradas por `scripts/zoom-hires.py` em `.data/media/zoom`: 32 de 36; 4 obras (459080, 45585, 437853, 11417) ficam no maior tamanho que o The Met oferece.
- Prancha em `docs/design/pranchas/zoom/`.

## D29 — Correções do QA de 26/10 — 26/10/2026

- **Mídia 404:** o banco local 5462 é compartilhado entre checkouts; os snapshots foram importados pela worktree `casadeleilao-r3`, cujo `.data/media` tem os arquivos, e o checkout principal só tinha 26. A API agora restaura sob demanda: busca a imagem da obra no The Met pelo `external_id`, confere sha256 e extensão com a chave e salva; se não bater ou o provedor cair, 404.
- **Carteira a 390px:** grade em 1 coluna com `min-w-0`, barra fixa `z-40` com safe-area e QR do Pix isolado; sem rolagem lateral.
- **CSRF no localhost:3300:** origens padrão `127.0.0.1:3300` e, fora de produção, `localhost:3300`. Produção continua só com a origem configurada.
- **Logout:** a sessão no cache vira `null` na hora; o header mostra Entrar sem recarregar.
- **Mensagens:** aviso "Você foi superado" (notificação `OUTBID` + toast com "Dar novo lance"); lance acima do saldo mostra alerta com link para a carteira; depósito de R$ 0 avisa na hora.
- **Baixa:** contas sem nome mostram o papel (Licitante/Leiloeiro); lote agendado tem Avise-me na sala; abas do /suporte quebram linha em 390px.
- **Tela de erro:** a rota `/teste-erro` saiu. O E2E prova o `error.tsx` no build de produção com uma resposta inesperada da API do lote.
- **Meus arremates:** verificado com `licitante1` (4 arremates, 15 participações): a aba funciona; vazia era a conta nova do QA, que nunca venceu. O texto do vazio agora explica isso.
- Sem migration, sem dependência nova, sem push.

## D30 — Segunda rodada do QA de 26/10 — 26/10/2026

- **N1 (médio):** com o lance coberto, a sala mostrava "Você foi superado" e "Lance confirmado. Você está ganhando." juntos. A confirmação vivia em estado local do formulário e nada a limpava com o SSE. Agora guarda o valor confirmado e só aparece enquanto o lance atual não passar dele (`confirmationHolds` em `room-logic.ts`). Commit `1f894c4`.
- **N4:** o `NotificationRunner` ignora o lote da sala aberta, então quem estava nela não via toast. A sala dispara o toast na virada de LEADING para OUTBID da participação, refeita pelo evento SSE (`becameOutbid`). O sino segue no polling. Mesmo commit do N1, provado pelo E2E de dois contextos.
- **N2:** o selo "Simulado" cobria o X da Sheet de saldo a 390px. O cabeçalho do `DepositForm` reserva o espaço do X só abaixo de `lg`; o selo não mudou de lugar. E2E a 390px. Commit `7041ddc`.
- **N3:** a dica do zoom vem de `zoomHint()` em `lib/zoom.ts`, a partir de `DESKTOP_MAX` (3, clique) e `TOUCH_MAX` (4, pinça); acima de 3× mostra a escala real. Teste de unidade. Commit `fa70cad`.
- E2E completo: 65/66 com `--workers=1`; `provider-outage` não achou o lote novo na vitrine e passou ao rodar sozinho. Os commits não tocam a vitrine. **Não verificado:** N2 e N3 vistos a olho num navegador a 390px.
- Sem migration, sem dependência nova, sem push.

## D31 — Rodada final de 26/10: testes estáveis, logo, recusas como aviso, demo do zero e licitantes automáticos — 26/10/2026

- **E2E estável (`5ccb523`):** `provider-outage` falhava sempre na suíte completa porque a vitrine pagina todos os lotes pelo término e os lotes dos specs anteriores empurravam o lote novo para outra página; o teste agora acha a página em `/api/lots`. `favoritos-tour` clicava "Próximo" 6 vezes seguidas e às vezes pulava a transição; agora espera `n/7` a cada passo. Só testes mudaram.
- **Logo L3 em tudo (`0cf1f0a`, `dbb97e2`):** footer com a variante para fundo bordô; splash de entrada, erro global e imagens OG trocaram o selo "A" pelo martelo. E2E cobre header, footer, tela de entrar e splash.
- **Recusa por regra vira aviso (`1a2c1aa`):** a API já respondia 409 `ALREADY_LEADING`; o front tratava todo erro da API como vermelho com código para suporte e deixava o botão "Dar lance" ativo para quem liderava. Agora 4xx é aviso amarelo sem código (código só em 5xx/erro inesperado) e o botão fica desabilitado com o motivo enquanto a pessoa lidera.
- **Licitantes automáticos:** `DemoBotRunner` (opt-in `DEMO_BOTS=1`, nunca em `NODE_ENV=test`) cobre, a cada intervalo, lotes ao vivo em que uma pessoa lidera e às vezes abre lotes sem lance. Cada lance passa pelo `BiddingService` (reserva, incremento, prorrogação, trilha de auditoria) e o saldo do robô vem do `WalletsService`; o runner só lê o banco. Nunca cobre outro robô e para no teto (inicial × `DEMO_BOT_CEILING`), para a pessoa conseguir arrematar. Contas: `licitante2..4@arremate.demo` (ou `DEMO_BOT_EMAILS`).
- **Aviso ao leiloeiro:** todo lance aceito grava a notificação `NEW_BID` para o dono do lote (mesma tabela e regra de linha única do `OUTBID`, sem migration); sino e toast mostram "Novo lance no seu lote". Quem é coberto continua recebendo `OUTBID` (toast na sala e no site, sino).
- **Demo do zero:** `npm run db:reset-demo --workspace back-end` zera só os dados de domínio do banco dev 5462 (mesmo molde do reset do E2E; mantém usuários, snapshots, cartões e mídia; testemunhas vão para backup) e depois `npm run db:seed --workspace back-end` recria o catálogo pelos serviços. O histórico do catálogo usa `licitante5` no lugar de `licitante1`, a conta do botão de demo, que começa sem nenhum lance.
- Sem migration, sem dependência nova, sem push.

### D20 — provisionamento autorizado no Supabase

Fernando pediu verificar o ativo, pausar e criar o banco do teste; confirmou a organização webcode.ff. Só Custelo foi listado, já INACTIVE. Criado arremate-verzel (ref hrqqppepnmzxrrxxqnsf) em sa-east-1, PostgreSQL17.11, confirmado ACTIVE_HEALTHY, custo cotado US$0/mês. Nenhuma pausa desnecessária, conexão da aplicação, migration ou seed hospedada. Aprovação de criar o projeto não autoriza migration/seed/deploy.
