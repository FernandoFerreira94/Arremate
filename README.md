# Arremate — Casa de Leilões online (Desafio Verzel)

> **Aplicação publicada (sistema completo):** https://arremate-app-production.up.railway.app
> **Demo simulada no navegador (alternativa, só front-end):** https://arremate-three.vercel.app/
> **Repositório:** https://github.com/FernandoFerreira94/Arremate
> **Vídeo de demonstração (27 s, com narração):** https://github.com/FernandoFerreira94/Arremate/blob/main/docs/media/arremate-demo.mp4 — o GitHub reproduz o vídeo na própria página; o arquivo fica em [`docs/media/`](docs/media/) e o rodapé do site aponta para ele.

Leilões de obras de arte de acervo público (The Met). O leiloeiro busca obras na API do museu e cria lotes; o licitante deposita saldo simulado, dá lances ao vivo e recebe um comprovante quando arremata. Toda a regra de dinheiro fica no back-end, e uma página pública de auditoria detecta qualquer adulteração do histórico, inclusive feita direto no banco.

Para avaliar: entre no link principal com uma [conta de demonstração](#contas-de-demonstração) e siga o [roteiro rápido](#roteiro-rápido-de-avaliação). Para rodar local, [Como rodar](#como-rodar-local). Como o projeto foi feito com IA e o que é decisão minha: [Uso de IA](#uso-de-ia).

## Deploy publicado (Railway)

O deploy segue o [Caminho B de `docs/deploy.md`](docs/deploy.md): um serviço construído a partir do `Dockerfile` da raiz (site Next.js + API NestJS no mesmo container), um PostgreSQL do Railway e um volume em `/data` para a testemunha da auditoria e as imagens. As migrations, o papel `auction_app` (sem DDL) e o seed rodam na primeira subida; os segredos (`AUDIT_HMAC_KEY` e a senha do papel da API) são gerados pelo próprio Railway e não estão no repositório. O seed carrega as contas de demonstração abaixo, e o cadastro de novos usuários também está disponível no link publicado.

## Contas de demonstração

| Papel | E-mail | Observação |
| --- | --- | --- |
| Leiloeiro | `leiloeiro@arremate.demo` | Dono dos lotes do catálogo |
| Licitante | `licitante1@arremate.demo` | Começa com saldo e sem lances |
| Licitante | `licitante2@arremate.demo` | Tem lances abertos em lotes ao vivo |

Na tela **Entrar**, os botões “Entrar como licitante de teste” e “Entrar como leiloeiro de teste” dispensam a senha. A senha das contas é pública e está na constante `DEMO_PASSWORD_DEFAULT` de [`back-end/prisma/seed.ts`](back-end/prisma/seed.ts). Também existem `licitante3` a `licitante5`, usados no histórico do catálogo.

O seed cria 1 leiloeiro, 5 licitantes, 1 lote aberto sem lances e um catálogo de 36 obras com lotes **ao vivo com lances abertos**, lotes na reta final, agendados e encerrados com comprovante.

## Roteiro rápido de avaliação

1. Entre como licitante, abra **Carteira** e faça um depósito simulado. Veja total, comprometido e disponível.
2. Abra um lote ao vivo e dê um lance. Em outra janela anônima, entre com `licitante2` e cubra o lance: a primeira janela atualiza sozinha, avisa “Você foi superado” e o valor volta ao disponível.
3. Tente as recusas: lance abaixo do mínimo, sem saldo, cobrindo a si mesmo, lote agendado e lote encerrado. Cada uma tem mensagem própria.
4. Dê um lance nos últimos 2 minutos de um lote da reta final e veja o fim ser prorrogado.
5. Abra um lote encerrado: comprovante público, apelidos no lugar de nomes e a auditoria com o resultado “íntegro”.
6. Como leiloeiro: busque uma obra no The Met, crie um lote com lance inicial, incremento, início e fim, e cancele um lote sem lances. O painel mostra resultados e o total recebido.
7. Prove a detecção de adulteração (abaixo).

## Como rodar (local)

Pré-requisitos: Node 24.22.1 (`.nvmrc`), Docker com Compose e internet no primeiro seed.

1. `npm ci`
2. Copie `.env.example` para `.env`. Preencha as três senhas de banco com valores aleatórios (as mesmas dentro de `DATABASE_URL` e `TEST_DATABASE_URL`) e acrescente `AUDIT_HMAC_KEY`, gerada com
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. `npm run db:up` — PostgreSQL 18 de desenvolvimento em `127.0.0.1:5462` e de teste em `5463`.
4. Migrations, com o papel dono do banco (a API usa outro papel, sem DDL): em `back-end/`, com `DIRECT_URL=postgresql://auction_owner:<DB_OWNER_PASSWORD>@127.0.0.1:5462/casadeleilao` no `.env`, rode `npx prisma migrate deploy`. Para os testes de integração e E2E, repita com a URL do banco de teste (`5463/casadeleilao_test`).
5. `npm run db:seed --workspace back-end` — dados de demonstração. Reexecutar não duplica nada; `npm run db:reset-demo --workspace back-end` seguido do seed volta a demo ao começo. O seed espera cerca de 2,5 min no fim para liquidar os lotes encerrados pelo fluxo normal. Rode o seed com a API parada: a fila da testemunha da auditoria é por processo, e seed e API escrevendo no mesmo lote ao mesmo tempo podem abortar o seed (o dinheiro não corre risco; basta rodar de novo).
6. `npm run dev:api` (API em 4300) e, em outro terminal, `npm run dev:web` (site em http://127.0.0.1:3300). Se a API parou no meio de uma confirmação da auditoria, ela tenta de novo ao subir; `npm run audit:retry` faz o mesmo manualmente.

Opcional: `DEMO_BOTS=1` no `.env` liga licitantes automáticos que cobrem o seu lance, para ver o tempo real sem abrir duas contas.

## Regras de negócio e onde são garantidas

| Regra | Como funciona |
| --- | --- |
| Janela do lance | Só entre início e fim, pelo relógio do PostgreSQL lido depois dos locks. |
| Valor mínimo | Primeiro lance ≥ inicial; os seguintes ≥ atual + incremento. Quem lidera não cobre o próprio lance. |
| Saldo reservado | Disponível = total − comprometido. O valor de quem lidera fica comprometido; quando é superado, volta ao disponível na mesma transação. Só aceita lance que caiba no disponível, mesmo com lances em vários lotes. |
| Anti-sniping | Lance aceito nos últimos 2 min faz o lote terminar **2 min depois desse lance** (`fim = aceite + 120 s`). Lance recusado não estende. |
| Liquidação | Um runner na API (a cada 1 s e no startup) debita o vencedor, credita o leiloeiro e emite o comprovante numa transação. Lote sem lance fecha sem vencedor. |
| Concorrência | Lote travado com `FOR UPDATE`, carteiras travadas sempre em ordem de ID (evita deadlock entre lotes), retry em deadlock e serialização. Testado com 20 licitantes simultâneos no PostgreSQL real. |
| Idempotência | `Idempotency-Key` em lance, depósito e publicação: repetir a requisição não duplica; outro corpo com a mesma chave dá conflito. |
| Dinheiro | Centavos em `BigInt`, ledger `wallet_entries` (depósito, reserva, liberação, débito, crédito). |
| Privacidade | Auditoria e comprovante mostram apelidos por lote (“Licitante 3”), nunca nome ou e-mail. |
| API externa fora | A obra vira snapshot com imagem local (sha256 conferido) ao publicar; vitrine, sala, auditoria e comprovante não dependem do The Met. |

## Auditoria à prova de adulteração

Cada evento do lote (abertura, lance, prorrogação, liquidação) é assinado com **HMAC-SHA-256**, e a assinatura inclui a do evento anterior, formando uma cadeia. A cadeia fica no PostgreSQL. A chave fica só no ambiente da API, e o último checkpoint (quantos eventos e qual a última assinatura) fica numa **testemunha em disco, fora do banco**. A página pública `/lotes/:id/auditoria` recalcula a cadeia inteira:

- alterar um lance muda o conteúdo assinado e quebra o HMAC (`CHAIN_MISMATCH`);
- inserir um lance sem a chave não gera assinatura válida;
- apagar lances, inclusive os últimos, deixa o histórico menor que a testemunha (`HISTORY_TRUNCATED`);
- apagar o lote com a testemunha restante dá `LOT_REMOVED`;
- mudar `lots.status` direto no banco (por exemplo `CANCELLED`) dá `STATUS_MISMATCH`: o cancelamento é selado no envelope da testemunha;
- sem chave ou sem testemunha, o resultado é “indeterminado”, nunca “íntegro”.

**Prove você mesmo (banco local):** abra a auditoria de um lote com lances e confira “íntegro”. Depois rode no banco de desenvolvimento

```sql
UPDATE bids SET amount_cents = amount_cents + 100
WHERE id = (SELECT id FROM bids ORDER BY created_at DESC LIMIT 1);
```

e recarregue a auditoria desse lote: o resultado passa a “adulterado”, e a API bloqueia novas mutações nele. Limite assumido: quem tiver a chave e a testemunha ao mesmo tempo consegue forjar. Detalhes em [operação da integridade](docs/operacao-integridade.md).

## Arquitetura

```
navegador ──> Next.js (App Router, 3300) ──/api──> NestJS (4300) ──> PostgreSQL
                 páginas SSR e áreas por papel        regras, sessão,       │
                 proxy same-origin com cookie         lances, liquidação    └─ testemunha da
                                                      SSE por lote              auditoria em disco
```

- **Front:** Next.js 16 + React 19 + TypeScript strict + Tailwind 4 + shadcn. O front nunca decide dinheiro nem estado; nada é atualizado de forma otimista.
- **API:** NestJS, monólito modular. Sessão opaca em cookie HttpOnly (só o hash no banco), CSRF com Origin exato, Argon2id, CSP com nonce.
- **Banco:** PostgreSQL 18 com Prisma 7 nas migrations e SQL parametrizado no caminho do lance. A API usa um papel sem DDL.
- **Tempo real:** SSE por lote, com polling de 10 s se o canal cair.
- **Por que assim:** um monólito com as regras num só lugar é mais simples de provar correto em 7 dias do que serviços separados ou regras no banco. O custo assumido é rodar uma instância só.

Decisões e alternativas descartadas: [docs/decisoes.md](docs/decisoes.md).

## Testes

| Suíte | Comando | Última rodada (26/10) |
| --- | --- | --- |
| Unit da API (Jest) | `npm test` | 93/93 |
| Unit do front (Vitest) | `npm run test:unit --workspace front-end` | 132/132 |
| Integração com PostgreSQL real | `npm run test:integration` | 134/134 |
| E2E (Playwright, build de produção, banco e portas próprios) | `npx playwright test --workers=1` | 87/87 |
| Lint, tipos e build | `npm run lint`, `npm run typecheck`, `npm run build` | ok |

O CI (`.github/workflows/ci.yml`) migra um banco vazio, roda o seed duas vezes, audita dependências e roda todas as suítes.

## Opcionais do PDF

| Opcional | Situação |
| --- | --- |
| Busca e filtro | Feito: abas ao vivo, agendados, encerrados e "encerrando hoje", mais busca por nome da obra ou do artista no header (`GET /api/lots?q=`). |
| Estorno no cancelamento | Não se aplica por regra: o leiloeiro só cancela lote **sem lances**, então não há saldo reservado para devolver. Permitir cancelar com lances mexeria nas regras de lance a dias da entrega; ficou de fora de propósito. |
| Docker Compose | Feito: `compose.yaml` sobe os bancos para desenvolvimento; `compose.deploy.yaml` sobe PostgreSQL + site + API + Caddy com HTTPS ([docs/deploy.md](docs/deploy.md)). |
| Testes | Feito: unit, integração em PostgreSQL real, E2E com Playwright e CI (seção acima). |
| Dark mode | Feito: segue o sistema e tem alternador no header; a escolha fica salva no navegador. |

## Comportamentos que podem surpreender

- **Anti-sniping relativo ao lance:** o lote passa a terminar 2 min depois do lance aceito, não 2 min depois do fim anterior.
- **Liquidação em até ~1 s:** ao zerar o cronômetro, o lote aparece como “apurando” por um instante antes do resultado.
- **Até 3 conexões ao vivo por IP:** a partir da 4ª aba aberta na mesma rede, a sala usa polling de 10 s em vez de SSE.
- **Limites de login e de mutação em memória** de uma instância; não são distribuídos.
- **Splash de entrada** só no primeiro acesso da sessão (3 s, pula com qualquer tecla ou clique; aba anônima para rever).
- **Licitantes automáticos** (`DEMO_BOTS=1`) cobrem lances de pessoas até um teto, pelas mesmas regras e com a mesma auditoria.
- **Seed sem internet:** obras do catálogo que falham geram só um aviso; o lote base continua sendo criado.
- **Login com Google** aparece desabilitado sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`.
- **Tema:** sem escolha salva, o site segue o tema claro/escuro do sistema operacional.
- **Busca:** procura no título e no artista, sem diferenciar maiúsculas; `%` e `_` digitados contam como texto, não como curinga.
- **Extras além do pedido:** cadastro, cartão de teste e Pix simulados na carteira, favoritos, “Avise-me”, notificações, zoom da obra e tour guiado.
- **Não verificado:** Safari/Firefox e aparelho físico.

## Demonstração publicada (modo demo, sem servidor)

O link da Vercel é só o front-end, com `NEXT_PUBLIC_DEMO_MODE=1`: sem API nem banco, o código em [`front-end/src/demo/`](front-end/src/demo/) responde às mesmas rotas que o front chama, direto no navegador, e guarda o estado no `localStorage` (cada visitante tem a sua demo; o aviso no topo tem **Reiniciar demo**). Ele existe como alternativa de custo zero ao Railway e para mostrar as regras sem servidor.

- **Mesmas regras do back:** lance mínimo, quem lidera não cobre o próprio lance, reserva e liberação de saldo, anti-sniping e liquidação com comprovante. A ordem das recusas copia `back-end/src/lots/bid-rules.ts`; testes em `front-end/src/demo/engine.test.ts`.
- **Mesmos dados do seed:** as 36 obras de `back-end/prisma/seed-catalog.ts`. `node scripts/demo-snapshot.mjs` gera `artworks.json` e as imagens a partir da API do Met.
- **Ao vivo:** licitantes automáticos a cada 30 s com a aba aberta; outras abas do mesmo navegador recebem o aviso pelo `BroadcastChannel`.
- **Auditoria:** cadeia SHA-256 com testemunha à parte e o botão **Simular adulteração no banco**. A garantia é mais fraca que a do servidor (não há chave HMAC fora do alcance de quem altera, porque tudo está no navegador).

Local: `NEXT_PUBLIC_DEMO_MODE=1 npm run build --workspace front-end` e `npm run start --workspace front-end`. Na Vercel: Root Directory `front-end`, `NEXT_PUBLIC_DEMO_MODE=1` e `SITE_URL=https://arremate-three.vercel.app` (só alimenta canonical e imagem de prévia).

## Uso de IA

Declaro aqui o que foi feito com IA, como controlei o processo e o que é decisão minha. A IA escreveu a maior parte do código; o processo, as decisões de produto e de arquitetura e a validação de cada entrega são meus. Nada abaixo é narrativa: cada item tem fonte no repositório.

### Ferramentas e onde entraram

| Etapa | Ferramenta | Saída |
| --- | --- | --- |
| Planejamento e quebra em tarefas | Codex e Claude Code | [`docs/superpowers/plans/`](docs/superpowers/plans/) e specs em [`docs/superpowers/specs/`](docs/superpowers/specs/) |
| Pranchas de UI e design system | Grok | [`docs/design/pranchas/`](docs/design/pranchas/INDICE.md) e [`docs/design/HANDOFF-GROK.md`](docs/design/HANDOFF-GROK.md) |
| Código do front e da API, testes | Codex e Claude Code (no Cursor e no terminal) | commits pequenos, um contexto por commit |
| Revisão de segurança independente | Claude Code em contexto limpo (só código e contrato, sem a conclusão do autor) | achados em [`docs/decisoes.md`](docs/decisoes.md) (D26) |
| QA navegando como usuário e E2E | Claude Code + Playwright | rodadas D29 a D31 em `docs/decisoes.md` e [`e2e/`](e2e/) |
| Deploy no Railway | Claude Code, seguindo [`docs/deploy.md`](docs/deploy.md) | serviço publicado; conferido por mim no navegador |

### O processo que a IA seguiu

O projeto roda dentro de um ciclo de vida que eu defino para todos os meus projetos e que os agentes leem antes de agir ([`docs/lifecycle.md`](docs/lifecycle.md)). São treze estágios, S0 a S12, tratados como máquina de estados: ideia, validação, definição de produto, pesquisa de lacunas, prontidão, Architecture Freeze, Design Freeze, handoff, boot do repositório, desenvolvimento, saúde, release e produção. Cada estágio tem uma fonte obrigatória e um gate de saída; o agente só avança quando o gate passa, e nunca escolhe a próxima etapa pela memória da conversa. Os achados de cada gate são classificados como `BLOCKER / WARNING / RECOMMENDATION / INFO`: só `BLOCKER` segura o avanço. O histórico das transições está no `Stage History` do mesmo arquivo.

Dentro do desenvolvimento (S9), cada tarefa percorre o mesmo loop, registrado em [`docs/qualidade.md`](docs/qualidade.md) e cobrado no [`AGENTS.md`](AGENTS.md):

1. **Requisito e critério de aceite** identificados; diff restrito ao escopo. Mais de 3 arquivos ou regra nova exige plano antes do código.
2. **Teste que falha pelo motivo certo** (red). Financeiro, auth e integridade exigem casos positivos, negativos e de falha/retry/concorrência; concorrência é provada em PostgreSQL real, nunca em mock.
3. **Código mínimo** para o teste passar (green), depois refatoração sem quebrar.
4. **Lint, TypeScript strict e testes** do pacote tocado; `build` e E2E nas tarefas de fechamento.
5. **Revisão de código e de segurança** de todo diff (guard/ownership, DTO, IDOR, PII, segredo em log). Antes de migration, auth/sessão ou decisão irreversível, a revisão é adversária e em contexto limpo. Máximo de 3 ciclos de correção; se o achado persistir, a decisão volta para mim. Nenhum `High/Critical` aberto permite fechar a tarefa.
6. **Evidência** em [`docs/evidence/`](docs/evidence/): comando, saída, exit code, o que foi provado em banco real e o que ficou `NOT RUN` ou **não verificado**.
7. **Fontes atualizadas no mesmo trabalho:** decisão em `docs/decisoes.md`, plano, README e a página do projeto no Notion.

O agente para e me chama quando a escolha é minha: troca de decisão já congelada, direção visual com mais de uma opção válida, dependência nova, migration, credencial, push, deploy, gasto real ou ação destrutiva. Nesses pontos ele traz recomendação, alternativa e trade-off, e eu decido. Desculpas como "mudança pequena, não precisa teste" ou "estou confiante" são proibidas por escrito no `AGENTS.md`.

### O que é meu

- **Produto e regras:** obras de acervo público do The Met (U02); anti-sniping relativo ao lance, com o fim renovado para 120 s após o aceite (U03), escolhido porque garante sempre 2 minutos de reação a quem foi superado; depósito simulado de R$ 1 a R$ 100 mil (D05); vitrine ordenada pelo término mais próximo (D06); cancelamento só de lote sem lances, em vez de estorno (seção [Opcionais do PDF](#opcionais-do-pdf)).
- **Arquitetura:** monólito modular com todas as regras de dinheiro no back-end e nada decidido no cliente (U07); Next.js na Vercel com API Node persistente separada (U09), depois reunidos num container no Railway para o deploy completo; qualidade próxima de produção e escopo fiel ao PDF (U07). A auditoria à prova de adulteração com testemunha fora do banco foi a minha exigência de integridade; a técnica foi proposta pela IA, provada na Tarefa 2 e revisada por um segundo contexto, que achou e corrigiu uma falha de contrato antes do código (a assinatura não protegia o usuário interno do lance).
- **Dependências e design:** cada dependência fora do plano passou por mim, com motivo registrado: `@node-rs/argon2` (D15) e `radix-ui` (D16). Nome, logo, paleta, tipografia e pranchas foram aprovados por mim antes de qualquer componente (D01 a D12, Design Freeze), e a interface saiu das pranchas, não o contrário.
- **Processo:** o ciclo de vida, o loop acima, o `AGENTS.md` e as regras de parada são meus, escritos antes deste projeto e aplicados aqui.
- **Validação:** cada diff passou por mim antes do commit e cada entrega antes de virar produto; o deploy publicado foi conferido por mim no navegador (cadastro, login e sessões em duas abas).

### O que a IA errou e eu corrigi

- A revisão de segurança achou o login travado por um IP único atrás do proxy e cabeçalhos ausentes no front; corrigidos com teste (D26).
- O QA achou a sala mostrando "superado" e "ganhando" ao mesmo tempo, recusas de regra exibidas como erro do sistema e um E2E que só passava sozinho; corrigidos e cobertos por E2E (D29 a D31).
- O cadastro, o Google e os pagamentos simulados foram começados pelo Codex e terminados com o Claude Code.
- O próprio README afirmava coisas que o código não sustentava (a chave de auditoria e a migration que faltavam no passo a passo); corrigi.
- O que não verifiquei fica marcado como **não verificado** (Safari/Firefox e aparelho físico).

Versão narrativa do processo, na voz dos agentes: [docs/narrativa-agentes.md](docs/narrativa-agentes.md). Tarefa a tarefa: [diário de construção](docs/diario-construcao.md).
