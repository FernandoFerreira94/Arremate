# Arremate — diário de construção

> Registro completo da construção, tarefa a tarefa. O guia para avaliar o projeto é o [README](../README.md).

Plataforma de leilões online de obras de arte de acervo público, com lances em tempo real, carteira simulada, anti-sniping, auditoria verificável e comprovante público. “Casa de Leilões”/`casadeleilao` é o nome interno do repositório.

Execução, deploy e testes nunca são preenchidos com resultados presumidos: o que não foi verificado aparece como **não verificado**.

- [Comece aqui: pasta de decisões e detalhes](INICIO.md)
- [Registro de decisões](decisoes.md)

## Visão geral

- **Visitante:** vê a vitrine, a sala do lote, a auditoria pública e o comprovante.
- **Licitante:** deposita na carteira simulada, dá lances e acompanha participações e arremates.
- **Leiloeiro (vendedor):** busca obras no catálogo do The Met, publica e cancela os próprios lotes e acompanha o painel.
- **Fora do escopo original:** cadastro público obrigatório, tenancy, assinatura, admin genérico, IA no produto, nota fiscal, revenda, app nativo e recuperação de senha.

## Regras de negócio

- **Janela do lance:** lances só entre início e fim, pelo relógio do servidor. Primeiro lance ≥ inicial; os seguintes ≥ atual + incremento. Quem lidera não cobre o próprio lance.
- **Saldo:** disponível = total − comprometido. Quem lidera tem o valor inteiro comprometido; quando é superado, o valor volta ao disponível na mesma transação. O lance só é aceito se couber no disponível, inclusive com lances em vários lotes (lock de lote e carteiras, testado sob concorrência no PostgreSQL real).
- **Anti-sniping:** lance aceito nos últimos 2 min faz o lote terminar 2 min depois do aceite (`endsAt = aceite + 120 s`); lance recusado não estende.
- **Liquidação automática:** debita o vencedor, credita o leiloeiro e emite o comprovante público. Lote sem lance fecha sem vencedor.
- **Recusas explícitas** (pt-BR): abaixo do mínimo, saldo insuficiente, já lidera, não iniciado, encerrado.
- **Privacidade:** auditoria e comprovante mostram apelidos (alias), nunca e-mail ou nome.
- **API externa fora do ar:** a obra é gravada como snapshot com imagem local (sha256 conferido) no momento da publicação, então vitrine, sala, auditoria e comprovante não dependem do The Met.

## Arquitetura em um minuto

- **Front (Next.js App Router, porta 3300):** páginas públicas renderizadas no servidor (vitrine, sala, auditoria, comprovante) e áreas privadas por papel. Um Route Handler encaminha `/api` para a API na mesma origem; ele substituiu o rewrite do Next, que não preservava o cookie de sessão.
- **API (NestJS, monólito modular, porta 4300):** toda regra de negócio fica aqui — sessão opaca + CSRF, carteira, lances, liquidação, auditoria. O front nunca decide dinheiro nem estado.
- **PostgreSQL (Prisma 7 + SQL explícito):** o Prisma cobre o acesso comum; o caminho do lance usa SQL parametrizado com lock de lote e carteiras na mesma transação, para que reserva, liberação do superado e prorrogação sejam atômicas. A API conecta com um papel sem DDL; as migrations rodam com o owner.
- **Tempo real:** SSE por lote, com polling de 10 s se o canal cair. Nada de atualização otimista de saldo ou de preço.
- **Liquidação:** runner na API (a cada 1 s e no startup), idempotente e recuperável depois de restart.
- **Integridade:** cadeia HMAC por lote no banco e testemunha em disco fora dele (ver [Auditoria à prova de adulteração](#auditoria-à-prova-de-adulteração)).
- **Catálogo externo:** busca no The Met só na criação do lote; a obra vira snapshot com imagem local validada.
- **Por que assim:** um monólito com as regras num só lugar é mais simples de provar correto em 7 dias do que serviços separados ou regras no banco (RLS). O custo é escalar uma instância só — o rate limit em memória e o mutex de processo assumem isso explicitamente.

## Stack

- Monorepo npm, Node 24 LTS (24.22.1, npm 11.19.0), um lockfile na raiz.
- **front-end:** Next.js App Router + React + TypeScript strict + Tailwind 4 + shadcn (primitivas `radix-ui`, ícones lucide). Só tema claro.
- **back-end:** NestJS 12 + Prisma 7.
- **Banco:** PostgreSQL 18 via Docker Compose (dev 5462, teste 5463).
- **Hospedagem prevista:** site na Vercel, API Node persistente separada e banco no Supabase, usado só como PostgreSQL (D20). O projeto PostgreSQL foi criado; a conexão da aplicação, migrations, seed e deploy hospedados continuam pendentes.

## Estado atual

| Tarefa | Entrega (tudo só local, sem push e sem deploy) |
| --- | --- |
| 1 | Schema do núcleo e migration `20261023104706_auction_core`, aplicada nos dois bancos locais. Money e health testados. |
| 2 | Cadeia HMAC de auditoria e integração da testemunha. |
| 3 | Sessão opaca, CSRF e papéis. O site em 3300 encaminha `/api` para a API em 4300: `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. |
| 4 | Catálogo do Met (busca v1.1, só leiloeiro, 30/min), snapshot e imagem validados gravados antes de publicar, publicação idempotente com gênese de auditoria, cancelamento pelo dono, vitrine/detalhe/lista do vendedor. Sem `AUDIT_HMAC_KEY` a API responde 503 `AUDITORIA_INDISPONIVEL`. |
| 5 | Carteira (`GET /api/wallet`) e depósito simulado idempotente (`POST /api/wallet/deposits`). Saldo total, comprometido e disponível em centavos como texto; cada depósito grava um lançamento `DEPOSIT` na mesma transação. Sem pagamento real, saque ou gateway. |
| 6 | Lance (`POST /api/lots/:id/bids`, só licitante, com `Idempotency-Key`), reserva integral do saldo, liberação do líder superado na mesma transação, prorrogação de 120 s (anti-sniping) e recusas com código em pt-BR. Testado sob concorrência no PostgreSQL real. |
| 7 | Liquidação automática (a cada 1 s e no startup): debita o vencedor, credita o vendedor e emite comprovante público (`GET /api/receipts/:token`) validado pela auditoria. Listas do licitante (`/api/me/participations`, `/api/me/awards`) e painel do vendedor (`/api/seller/summary`). Sem `AUDIT_HMAC_KEY` o runner não liquida. |
| 8 | Telas `/entrar`, `/carteira`, `/painel/lotes`, `/painel/lotes/novo` e `/meus-arremates` com design system shadcn (tokens do HANDOFF), navegação por papel e menu móvel. |
| 9 | Vitrine `/`, sala do lote `/lotes/:id` com lance, contador e tempo real (SSE `GET /api/events?lotId=`, polling de 10 s se o canal cair), auditoria pública `/lotes/:id/auditoria` (`GET /api/lots/:id/audit`), comprovante `/comprovantes/:token`, metadados/OG/ícones e 404 real. Design resumido em `DESIGN.md`. |
| 10 (parte local) | Seed de demo, corpo JSON grande responde 413, ensaio de 20 licitantes simultâneos (p95 237 ms, invariantes ok) e CI com migração em banco vazio, seed, audit e E2E (CI configurado em `.github/workflows`; resultado no GitHub ainda **não verificado**). |

Extensões de 24/10:

- **Conteúdo de demonstração (D18):** 24 obras CC0 do The Met; estimativa e laudo de conservação sempre marcados como “Simulado para demonstração”; nota do artista, proveniência com link “Ver no The Met”, técnica e número de lances no cartão. Commit local `24b3521`. Evidência: `docs/evidence/2026-10-24-conteudo-demo.md`.
- **Entrada animada (D17, calibrada em D19):** splash temático com a marca, moldura latão e fundo papel, só no primeiro acesso da sessão; títulos, blocos e cards entram em sequência. Ver seção própria abaixo.
- **Rodada 3 — pranchas R1–R10, hero e notificações (D22, registrada como D21 na branch):** adendo ao Freeze D12 (Sheet de auth, redefinição simulada, imagens contain, páginas novas), favoritos, tour, hero com carrossel dos próximos agendados (`GET /api/lots/upcoming`), Avise-me, notificações e rodapé F3-cor. Feito na branch local `feat/rodada-3` (último commit `c11f308`) e incorporado por merge local. Cadastro, login com Google e Pix/cartão simulados ficaram pendentes nessa rodada e foram concluídos depois, em D24 (abaixo). Evidência: `docs/evidence/2026-10-24-rodada-3.md`.
- **Cadastro, Google e pagamentos simulados (D24, 26/10/2026):** cadastro e login por e-mail (Argon2id, sessão e CSRF), Google OAuth por fetch, nome no header e no Perfil, cartão de teste que guarda só bandeira, final e validade, depósitos Pix e cartão simulados (idempotentes, em transação) e histórico de lances. Começado pelo Codex e concluído aqui. Google só funciona com `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no ambiente; sem elas o botão aparece desabilitado ("indisponível na demo"). Consentimento real do Google não testado.
- **Zoom da obra (D28):** clique na imagem do lote para ampliar até 3x (4x com pinça no celular). As imagens ~2500px são geradas por `python scripts/zoom-hires.py .data/media/zoom` (Python 3 + Pillow; para o E2E, `.data/media-e2e/zoom`) e usadas só no zoom; sem elas, o zoom usa a imagem normal.

**Recorte das branches.** A `feat/rodada-3` (`c11f308`) entrou na `chore/bootstrap` por merge local `--no-ff` em 25/10/2026, sem push. Na revisão dos conflitos, cada lado foi mantido.

**Arquitetura:** S5 continua aberto como risco aceito (D13). O rewrite externo do Next não preservou o cookie; o proxy é o Route Handler. Banco de produção definido: Supabase como PostgreSQL via Prisma (D20); o fornecedor da API ainda não foi contratado e a API ainda não foi conectada ao banco hospedado. S7 não declarado.

## Como rodar (local)

Pré-requisitos: Node 24.22.1 (`.nvmrc`), Docker com Compose e acesso à internet no primeiro seed (catálogo do The Met).

1. `npm ci` na raiz.
2. Copiar `.env.example` para `.env`. Preencher `DB_OWNER_PASSWORD`, `DB_APP_PASSWORD` e `DB_TEST_APP_PASSWORD` com senhas aleatórias e usar as mesmas senhas em `DATABASE_URL` e `TEST_DATABASE_URL`. Acrescentar `AUDIT_HMAC_KEY` (hex, 32 bytes ou mais), gerada com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Sem essa chave o seed para com erro, a API responde 503 `AUDITORIA_INDISPONIVEL` ao publicar e a liquidação não roda. Nunca copiar segredos para README, log ou Notion.
3. `npm run db:up` — PostgreSQL dev em 127.0.0.1:5462 e teste em 5463, só loopback. `npm run db:stop` para só os bancos do projeto, sem remover volumes.
3a. Aplicar as migrations com o papel owner (só nos bancos locais), a partir de `back-end/`. O Prisma CLI usa `DIRECT_URL` quando preenchida; a API e o seed continuam usando `DATABASE_URL` (`auction_app`, sem DDL). Defina `DIRECT_URL=postgresql://auction_owner:<DB_OWNER_PASSWORD>@127.0.0.1:5462/casadeleilao` no `.env` e rode `npx prisma migrate deploy`. Para os testes de integração/E2E, repita trocando a URL para `127.0.0.1:5463/casadeleilao_test`. É o mesmo passo que o CI executa em banco vazio; em clone limpo local ele ainda está **não verificado**.
4. `npm run dev:api` (API, porta 4300) e, em outro terminal, `npm run dev:web` (site em [http://127.0.0.1:3300](http://127.0.0.1:3300)).
5. Dados de demo: `npm run db:seed --workspace back-end`. Cria as contas `leiloeiro@arremate.demo` e `licitante1@arremate.demo` a `licitante5@arremate.demo` (senha de demo na constante `DEMO_PASSWORD_DEFAULT` de `back-end/prisma/seed.ts`; os botões de login rápido dispensam digitá-la; pode ser trocada por `SEED_DEMO_PASSWORD`), o lote base (aberto, sem lances) e o catálogo de 24 obras do The Met, que inclui lotes ao vivo com lances abertos de `licitante2` a `licitante5`, lotes na reta final e lotes encerrados com comprovante. O catálogo exige internet durante o seed; sem rede, cada obra que falha só gera aviso no console. O histórico do catálogo usa `licitante2` a `licitante5`; a `licitante1`, conta do botão de demo, começa sem nenhum lance (D31). `-- --sem-catalogo` pula o catálogo; `-- --preparar-lote` cria um lote novo aberto. Só banco local; reexecutar não zera nada.
5b. Voltar a demo ao começo: `npm run db:reset-demo --workspace back-end` e depois o seed. O reset zera só os dados de domínio do banco dev 5462 (mantém usuários, snapshots do catálogo, cartões de teste e mídia) e guarda as testemunhas da auditoria em backup.
5c. Licitantes automáticos (opcional): `DEMO_BOTS=1` no `.env` e reiniciar a API. `licitante2` a `licitante4` cobrem, a cada 15 s, lotes em que uma pessoa lidera, pelas mesmas regras da API, até um teto (inicial × 3) para a pessoa conseguir arrematar. Ajustes no `.env.example`. Desligado por padrão e sempre desligado nos testes.
6. Saúde da API: `GET http://127.0.0.1:4300/api/health/live` e `/api/health/ready`. O mesmo health responde em `http://127.0.0.1:3300/api/health/live`, porque o site encaminha `/api`. A resposta não traz senha nem URL de banco.

**Banco e segredos.** A API usa `DATABASE_URL` com o papel `auction_app`, sem DDL nem privilégio administrativo. O owner só roda bootstrap/migration, nos bancos 5462 e 5463. Não apontar a API para o owner nem aplicar migration fora do loopback. `AUDIT_HMAC_KEY` (hex, 32+ bytes), `AUDIT_WITNESS_DIR` e `MEDIA_DIR` (padrão `.data/witness` e `.data/media`) ficam fora do banco e do Git; publicar e liquidar exigem `AUDIT_HMAC_KEY`. Sessão e CSRF não usam segredo novo. `API_PROXY_TARGET` (padrão `http://127.0.0.1:4300`) e `WEB_ORIGIN` são opcionais.

## Como validar

**Fluxo principal para o avaliador**

1. Subir o ambiente e rodar o seed (passos acima).
2. Entrar como licitante e fazer um depósito simulado na carteira.
3. Abrir um lote na vitrine e dar lances; em outra aba, com outro licitante, disputar o mesmo lote e ver a atualização em tempo real.
4. Ao encerrar, conferir o comprovante e a auditoria pública do lote.
5. Com `DEMO_BOTS=1`: dê um lance e espere ser coberto por um licitante automático. Chegam o toast “Você foi superado”, o sino e, no canto inferior direito, o feed de lances ao vivo dos outros licitantes. Como leiloeiro, o sino e o toast avisam “Novo lance no seu lote”.
6. Também verificável: login rápido de demo (ligado por padrão, D27); tour guiado no primeiro login; favoritos; hero do próximo leilão com “Avise-me quando abrir” e a notificação quando o lote abre; um produto por quadro na vitrine; página 404 própria.

### Roteiro de auth, carteira e histórico

Este roteiro descreve o comportamento existente no código; não é um relatório de execução. As contas são fictícias. Use apenas os bancos locais do projeto.

1. **E-mail e senha:** após o seed, abra `/entrar` e use `licitante1@arremate.demo`. Consulte a senha pública de demonstração no [seed](../back-end/prisma/seed.ts); se o ambiente usar `SEED_DEMO_PASSWORD`, use a senha local definida para o seed. Entre também como `leiloeiro@arremate.demo` e observe a navegação por papel.
2. **Login rápido:** abra Entrar e escolha “Entrar como licitante de teste” ou “Entrar como leiloeiro de teste”. Ligados por padrão (D27); `NEXT_PUBLIC_DEMO_LOGIN=false` na build os esconde. Os botões usam a senha pública padrão do seed; se ela foi substituída, use o formulário manual.
3. **Mensagens neutras e sessão:** compare senha incorreta com e-mail inexistente: ambos devem produzir o mesmo erro de credenciais. Faça logout e tente abrir `/carteira`; a área privada deve exigir login. Confira os atributos do cookie sem copiar seu valor. `Secure` e `__Host-` são condicionais à produção.
4. **CSRF e limites:** na aba Rede do navegador, confira Origin e `X-CSRF-Token` em uma mutação autenticada. Reenviar a mutação sem o cabeçalho deve resultar em 403. Tentativas de login acima do limite do [limitador](../back-end/src/auth/rate-limit.ts) devem resultar em 429; o contador é local à instância da API.
5. **Depósito simulado:** como licitante, abra `/carteira`, anote o saldo e use um atalho ou um valor válido. Confirme e confira o acréscimo no saldo. Na aba Rede, `POST /api/wallet/deposits` recebe `amountCents`, o método e `Idempotency-Key`; nunca número de cartão. Reenviar a mesma requisição com a mesma chave não deve gerar novo crédito; alterar o corpo mantendo a chave deve gerar conflito.
6. **Participações e arremates:** com `licitante1@arremate.demo` e `licitante2@arremate.demo` em sessões de navegador separadas, dê lances no mesmo lote e abra `/meus-arremates`. Participações deve refletir quem lidera e quem foi superado; após a liquidação, mostra o resultado. Um lote vencido aparece em Arrematados com comprovante público. Para consultar resultados sem aguardar um leilão longo, use os lotes encerrados do catálogo de demonstração. Lista vazia é um estado válido quando a conta ainda não participou.
7. **Supabase:** confira os nomes `DATABASE_URL`/`DIRECT_URL`, [Prisma](../back-end/prisma.config.ts), guards e [D20](decisoes.md#d20--supabase-somente-postgresql--24102026). O teste funcional continua no PostgreSQL local. Conexão hospedada, papéis e TLS precisam de ensaio próprio; este roteiro não pede migration, seed ou deploy hospedado.

8. **Cadastro (D24):** em Entrar, abra Cadastrar, crie uma conta fictícia (e-mail inventado, senha com Argon2id no servidor) e entre com ela. O Google aparece desabilitado (“indisponível na demo”) sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`.
9. **Cartão de teste e Pix simulado (D24):** na carteira, salve um cartão de teste (a API guarda só bandeira, final e validade) e faça um depósito por cartão e outro por Pix simulado. O extrato (`GET /api/wallet/entries`) lista os lançamentos. Nenhum dado de cartão real é necessário.

**Testes**

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run db:validate`, `npm run db:generate`, `npm run build`.
- Vitest do front: `npm run test:unit --workspace front-end` (cliente de API e componentes).
- E2E: `npm run test:e2e` (Chromium exige `npx playwright install chromium` no primeiro uso). O Playwright sobe build próprio de produção (site 3310, API 4310) contra o PostgreSQL de teste 5463.
- Movimento de entrada isolado: `node e2e/entry-motion-isolated.cjs`.

Testes automatizados são opcionais no PDF, mas **obrigatórios neste projeto**: cada capacidade exige evidência de testes e revisão de código/segurança. Planejado não significa executado: ver [Qualidade](qualidade.md).

### Histórico de verificação

Registros anteriores, por tarefa. Os números atuais estão em [Qualidade e verificações](#qualidade-e-verificações); as contagens abaixo são históricas.

| Etapa (Node v24.22.1) | Resultado |
| --- | --- |
| Bootstrap U12 | 5 testes health/erros/pool, 2 integrações PostgreSQL real e 2 E2E Chromium (placeholder/HTML lang-title-noindex/404). Lint, tipos, Prisma validate/generate e builds ok. Após `npm ci`: 1043 pacotes, árvore sem problemas, 9 testes da fundação (exit 0). Dossiê: 24 Markdown, 33 R presentes, 0 links locais quebrados, hash do PDF conferido. |
| Tarefa 1 | Bateria da raiz exit 0: `npm test` 14 (health + money), integração 6 (inclui schema no `casadeleilao_test`), `db:validate`, build. [Evidência](evidence/2026-10-23-tarefa-1.md). |
| Tarefa 2 | Bateria exit 0, com cadeia HMAC e testemunha. E2E, sessão, páginas e deploy não executados; fsync de diretório no Linux não ensaiado. [Evidência](evidence/2026-10-23-tarefa-2.md). |
| Tarefa 3 | Unit 22, integração 25, Vitest 7; saúde em 4300 e CSRF pelo site em 3300 com 200. E2E e revisão independente não feitos. Sem migration nova. [Evidência](evidence/2026-10-23-tarefa-3.md). |
| Tarefa 4 | Unit 43, integração 41, build ok. Smoke real do Met: busca, objeto 436524, imagem 599×423 JPEG validada. [Evidência](evidence/2026-10-23-tarefa-4.md). |
| Tarefa 5 | Unit 43, integração 62. [Evidência](evidence/2026-10-23-tarefa-5.md). |
| Tarefa 6 | Unit 51, integração 74. [Evidência](evidence/2026-10-23-tarefa-6.md). |
| Tarefa 7 | Unit 53, integração 88. [Evidência](evidence/2026-10-23-tarefa-7.md). |
| Tarefa 8 | Vitest 36, E2E Playwright 5. |
| Tarefa 9 | Unit 57, integração 91, Vitest 49, E2E 16 (duas abas disputando, reta final até comprovante, provider fora). |
| Tarefa 10 | Unit 59, integração 96, Vitest 49, E2E 16. [Evidência](evidence/2026-10-23-tarefa-10.md). |
| D18 | Unit 59, integração 99, Vitest 49, Playwright 23, build ok. |
| D17 (entrada animada) | 20 E2E no build local de produção, 49 unitários do front, typecheck/lint/build; review independente; screenshots desktop 1440/mobile 390. |
| D19 | 6 checks de navegador isolado (API simulada só no teste), splash 3006 ms, entrada 850 ms. Com Docker ativo: 20 E2E em 1,2 min no build de produção e banco isolado (exit 0). |
| Rodada 3 | Lint, typecheck, Vitest 64, unit 65, integração 99, Playwright 21. |

Tarefas 4 a 7 sem migration nova.

**Último registro anterior da branch feat/rodada-3:** unit da API 65/65, Vitest 71/71, integração 110/110, E2E 25/25.

**Segurança das dependências.** Auditoria de runtime (`--omit=dev`): 0 alertas. Auditoria completa: 9 High derivados de braces 3.0.3, sem correção upstream, só em tooling (eslint-config-next/shadcn CLI); não aceitar patterns externos nessas ferramentas. ESLint 9.39.5 compatível com os peers do Next, com aviso de fim de suporte. Sem `audit fix --force` nem downgrade automático. Isso não é declaração de produção pronta.

## Qualidade e verificações

Trato cada entrega como não pronta até as suítes abaixo passarem na mesma árvore, no mesmo dia. Os números são da última rodada completa (26/10/2026, Windows, banco PostgreSQL local; o projeto fixa Node 24.22.1 e o CI usa essa versão, enquanto essa rodada local rodou no Node 26 da máquina).

### Suítes e números atuais

| Suíte | O que cobre | Resultado |
|---|---|---|
| Lint (`eslint`, front e API) | Regras do projeto, hooks do React, imports | sem erro |
| Typecheck (`tsc --noEmit`, front, API e ferramentas) | Tipos de ponta a ponta, inclusive dos testes | sem erro |
| Unit da API (Jest) | Regras puras: lances, dinheiro em centavos, CSRF, origens, nome exibido, relato de erros, licitantes automáticos | 90/90 |
| Unit do front (Vitest) | Hooks e lógica de tela: zoom, carteira, sala do lote, sessão, notificações, recusas como aviso, feed ao vivo | 127/127 |
| Integração da API (Jest + PostgreSQL real) | Rotas HTTP com banco: idempotência, concorrência de lances, liquidação, auditoria, mídia, auth, licitantes automáticos, feed | 133/133 (25 suítes) |
| E2E (Playwright, `--workers=1`) | Jornadas no navegador, desktop e celular (390px), contra o build de produção | 82/82 na rodada completa |
| Build do front (`next build`) | Compilação de produção | ok |

O E2E roda com um só worker de propósito: as jornadas dividem contas e o limite de 3 streams de tempo real por IP (B3), e em paralelo os testes disputariam esses recursos.

### Revisão de segurança

Uma revisão independente (Sentinela) leu o código e apontou dois achados médios e dois baixos. Todos foram corrigidos e têm teste (D26):

- **M1, login travado por IP único:** atrás do proxy do Next, todo mundo parecia vir do mesmo IP. Agora o proxy repassa o IP real do cliente e a API só confia no salto local. O limite de login conta depois da checagem de Origin e CSRF, e há um limite por e-mail.
- **M2, cabeçalhos do front:** CSP com nonce por requisição, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e HSTS só em produção.
- **B1:** erros do navegador têm cota própria no relato de erros e limite por IP real.
- **B3:** no máximo 3 streams de tempo real por IP, liberados ao fechar.

Antes disso, cada tarefa teve uma leitura de segurança registrada em `docs/evidence/`, sem achado alto ou crítico.

### Rodadas de QA

O QA navega como um usuário, em desktop e celular, e devolve achados com print e log. Cada achado vira teste antes de virar correção.

- **Rodada de 26/10 (D29):**
  - Imagens com 404: o banco local era compartilhado com outra cópia do projeto, que tinha os arquivos. A API agora restaura a imagem sob demanda a partir do The Met e confere o sha256 antes de salvar.
  - Carteira a 390px passava da tela, e um cartão roubava o toque de "Adicionar saldo". Corrigido o layout; o QR do Pix não cobre mais o botão.
  - Login e cadastro em `localhost:3300` davam erro de CSRF. As duas origens locais são aceitas fora de produção; em produção só vale a origem configurada.
  - O header continuava logado depois de sair; agora troca na hora.
  - Mensagens que faltavam: "Você foi superado" (sino e toast), saldo insuficiente no lance (com link para a carteira) e depósito de R$ 0.
  - Contas demo mostram o papel no lugar de "Participante"; lote agendado tem Avise-me na sala; abas do suporte cabem no celular.
  - A tela de erro é verificada no build de produção sem rota de teste.
  - Meus arremates: verifiquei com uma conta com histórico; a aba funciona, e a lista vazia era de uma conta que nunca venceu. O texto do vazio agora diz isso.
- **Segunda rodada de 26/10 (D30):**
  - Quando outro licitante cobria o lance, a sala mostrava "Você foi superado" e "Lance confirmado. Você está ganhando." ao mesmo tempo. A confirmação agora guarda o valor confirmado e some assim que o tempo real traz um lance maior.
  - Quem estava na sala do lote não recebia o toast de lance superado. A sala dispara o toast ao vivo quando a participação passa de liderando para superado; o sino segue como antes.
  - Na Sheet de saldo a 390px, o selo "Simulado" cobria o X de fechar. O cabeçalho reserva o espaço do X só no celular.
  - A dica do zoom dizia só "até 3×". Agora cita clique até 3× e pinça até 4×, e acima de 3× mostra a escala real.
- **Terceira rodada de 26/10 (D31, D32):**
  - O E2E completo ficou estável. `provider-outage` falhava sempre na suíte completa porque a vitrine pagina os lotes pelo término e os lotes dos testes anteriores empurravam o lote novo para outra página; agora o teste acha a página certa. O tour clicava "Próximo" rápido demais; agora espera cada passo.
  - A logo de martelo (L3) chegou ao footer, ao splash de entrada, à página de erro global e às imagens de compartilhamento, que ainda mostravam o selo "A". Conferi 7 telas a 1440px e 390px.
  - "Você já lidera este lote" aparecia como erro vermelho com código para suporte. A API já respondia certo (409); o front tratava toda resposta de erro como falha do sistema e deixava o botão de lance ativo para quem liderava. Agora recusa por regra é aviso amarelo, sem código, e o botão fica desabilitado com o motivo.
  - Na demo ninguém cobria o lance, então quem lançava ficava liderando para sempre. Criei licitantes automáticos opcionais que passam pelas mesmas regras e pela mesma trilha de auditoria, o aviso de novo lance para o leiloeiro e o feed de lances ao vivo no canto inferior direito.
  - A demo pode voltar ao começo com a conta do botão de demo sem nenhum lance.
- **Rodadas anteriores:** mensagens de erro e toasts (D25), zoom da obra (D28) e os ajustes das pranchas da rodada 3 (D22), cada um com seu E2E.

### Como rodar

Da raiz do repositório, com o banco local no ar e o `.env` preenchido a partir do `.env.example`:

```bash
npm run lint
npm run typecheck
npm test                                   # unit da API
npm run test:unit --workspace front-end    # Vitest do front
npm run test:integration                   # integração, precisa do PostgreSQL local
npx playwright test --workers=1            # E2E; sobe build e portas próprios (3310/4310)
npm run db:reset-demo --workspace back-end # zera a demo local (5462); depois rode o seed
npx playwright test e2e/qa-fixes.spec.ts --workers=1   # só uma jornada
npm run build --workspace front-end
```

O E2E usa banco, mídia (`.data/media-e2e`) e portas próprios, então não mexe nos dados de demonstração.

## Como o projeto foi construído

O Arremate foi desenvolvido por uma arquitetura de subagentes de IA projetada pelo Fernando. Os agentes planejam, desenham e programam; o Fernando define a direção, valida cada entrega e decide o que entra, com o critério registrado em `docs/decisoes.md`.

- **Orquestrador de desenvolvimento:** transforma o enunciado em plano, quebra o trabalho em tarefas pequenas e conduz os gates do Project Lifecycle. Nenhuma etapa avança sem a saída exigida pelo gate anterior.
- **Designer de UI/UX (Fred):** gera pranchas e design system antes de qualquer componente novo. A interface sai das pranchas congeladas (Design Freeze D12, adendo D21), não o contrário. Todo componente novo passa antes por uma prancha; hero, header e footer foram escolhidos entre 3 variações geradas pelo designer.
- **Executores de código (Codex e Cursor/Claude Code):** implementam cada tarefa com testes e registram a evidência em `docs/evidence/`.
- **QA/E2E isolado:** build, portas e banco próprios, sem tocar nos dados de desenvolvimento ou de demonstração.

### Regras de engenharia

- Commits locais pequenos, um por entrega verificável, sempre com o diff conferido.
- Nenhuma dependência nova sem validação e motivo registrado (ex.: `@node-rs/argon2` em D15, `radix-ui` em D16).
- Nada em banco hospedado ou deploy sem validação humana: migrations só nos bancos locais; push, deploy e seed em produção dependem de liberação explícita.
- O que não foi verificado fica marcado como **não verificado** (ex.: CI remoto, Safari/Firefox, aparelho físico, deploy).
### Processo

O trabalho seguiu um ciclo de vida em 13 etapas (S0 a S12: ideia, validação, produto, pesquisa, prontidão, arquitetura, design, handoff, boot do repositório, desenvolvimento, saúde, release e publicação), com o registro dos gates em [docs/lifecycle.md](lifecycle.md). O design foi congelado (Design Freeze D12) a partir das pranchas HTML/PNG em `docs/design/pranchas/` e do `docs/design/HANDOFF-GROK.md`.

Somos um time de agentes de IA operando numa arquitetura projetada pelo Fernando. Ele dirige; nós planejamos, desenhamos e programamos. A versão narrativa deste texto está em [docs/narrativa-agentes.md](narrativa-agentes.md).

- **Processo:** seguimos o Project Lifecycle (S0 a S12) como máquina de estados. A próxima etapa vem do Lifecycle Control do projeto, nunca da memória da conversa. Uma etapa só avança quando todos os critérios BLOCKER do gate estão atendidos ou registrados como risco aceito.
- **Papéis:** orquestrador (plano, tarefas, gates); Fred, designer de UI/UX (pranchas antes de qualquer componente novo); Codex e Cursor/Claude Code (implementação com testes e evidência); QA/E2E isolado (build, portas e banco próprios).
- **Autonomia com limites:** pesquisamos, comparamos e repetimos gates sozinhos. Paramos para decisão do Fernando em mudança de decisão congelada, direção visual com várias opções válidas, credencial, produção, gasto real ou ação destrutiva.
- **Critério do Fernando:** cada escolha relevante foi levada a ele com alternativas e motivo, e ficou registrada em `docs/decisoes.md` (D01 em diante).
- **Disciplina:** commits locais pequenos com diff conferido; nenhuma dependência nova sem validação; migrations só locais; nada hospedado sem validação humana; o que não foi verificado fica marcado como não verificado.

### Uso de IA (declaração exigida pelo desafio)

_Na voz do Fernando, que é quem declara._

- **Onde usei:** planejamento e decomposição em tarefas, pranchas de UI (Grok), código do front e da API (Codex e Claude Code), testes, revisão de segurança independente e QA navegando como usuário.
- **Como usei:** cada entrega veio com testes e evidência em `docs/evidence/`; nenhuma dependência, migration hospedada, push ou deploy entrou sem a minha validação, e cada escolha relevante ficou registrada em `docs/decisoes.md`.
- **O que revisei e ajustei:** a revisão de segurança apontou login travado por IP único atrás do proxy e cabeçalhos ausentes no front (M1/M2, D26), corrigidos com teste. O QA achou mensagens conflitantes na sala (“superado” e “ganhando” juntos, D30) e recusas de regra exibidas como erro do sistema (D31); foram corrigidas e cobertas com E2E. O cadastro, o Google e os pagamentos simulados foram começados pelo Codex e terminados com o Claude Code (D24). Também mandei corrigir o próprio README quando ele afirmava algo que o código não sustentava, como nesta revisão final (chave de auditoria e migration que faltavam no passo a passo).

## Decisões e motivos

| Decisão | Motivo |
| --- | --- |
| Next.js App Router + React + TypeScript strict (A01) | Metadados nativos no servidor por rota, sem renderizador de head paralelo; Vite foi a alternativa considerada. |
| NestJS como monólito modular (A02) | Guards, DTOs e injeção de dependência conhecidos, sem framework próprio; toda a regra de domínio fica na API. |
| PostgreSQL (A03) + Prisma (A04) | Relacional desde o início; Prisma no acesso comum e SQL parametrizado explícito onde há lock (lances concorrentes). |
| Sessão opaca em cookie HttpOnly + CSRF (A05) | Revogação simples e nada sensível em localStorage. |
| SSE + REST com reconexão (A06) | Tempo real na sala do lote; dinheiro e estado nunca atualizados de forma otimista. |
| Obras CC0 do The Met (U02, A07, D18) | Acervo público com licença conferida por item; estimativa e laudo sempre marcados como simulados. |
| Anti-sniping de 120 s (U03) | Lance aceito nos últimos 2 minutos renova o fim para 2 minutos após o aceite; recusa não estende. |
| Auditoria com HMAC encadeado (A08) | Trilha pública verificável por lote e comprovante validado pela auditoria. |
| Depósito simulado e idempotente (D05) | Demonstra a carteira (total, comprometido, disponível) sem gateway nem dinheiro real. |
| Tailwind + shadcn, Radix e lucide (A10, D16, D21) | Componentes acessíveis e fiéis ao design system congelado (Sheet de autenticação, Dialog, AlertDialog). |
| Contas de demonstração semeadas (S2) | O desafio não exige cadastro público; o avaliador entra direto como leiloeiro ou licitante. |
| Página 404 própria (Tarefa 9) | Rotas inexistentes respondem com 404 real e página da marca. |
| E2E em banco e portas próprios | Testes nunca contaminam dados de desenvolvimento ou de demonstração. |
| Testes automatizados obrigatórios (U05) | Opcionais no enunciado; aqui cada capacidade exige teste, revisão e evidência. |
| E-mail e senha com Argon2id (D15; `92df234`) | Verifica o hash Argon2id; conta inexistente passa por verificação com hash fictício e recebe o mesmo erro de senha incorreta. Reduz a exposição da existência de contas. Alternativa descartada para o hash: scrypt. Fontes: [D15](decisoes.md), [hash](../back-end/src/auth/password-hash.ts) e [auth](../back-end/src/auth/auth.service.ts). |
| Sessão revogável no servidor (`92df234`) | Cookie HttpOnly e SameSite=Lax; Secure e prefixo `__Host-` em produção. O banco guarda somente o SHA-256 do token, com expiração absoluta e revogação no logout. Evita persistir o token de sessão em claro no banco. Fontes: [decisão de sessão](decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [cookies](../back-end/src/auth/session-cookie.ts) e [repositório](../back-end/src/auth/auth.repository.ts). |
| CSRF com origem explícita (`92df234`) | Toda mutação exige Origin permitido e `X-CSRF-Token` validado por HMAC; o cookie sozinho não autoriza a operação. Confiar em `Host` para definir a origem foi descartado. Fontes: [decisão de sessão](decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [guard](../back-end/src/auth/csrf.guard.ts) e [auth](../back-end/src/auth/auth.service.ts). |
| Limites por conexão e ator (`92df234`) | Login limitado por IP da conexão; mutações privadas, por ator. Cabeçalhos do cliente não escolhem a identidade usada no limite. Confiar em `X-Forwarded-For` foi descartado. O contador fica na memória de uma instância, sem alegar proteção distribuída. Fontes: [decisão de sessão](decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [limitador](../back-end/src/auth/rate-limit.ts) e [IP](../back-end/src/auth/session-cookie.ts). |
| Crédito simulado com transação e idempotência (D05; `6e6ebe4`) | O backend valida o valor, bloqueia a carteira, grava `DEPOSIT` e atualiza o saldo na mesma transação. Mesma chave e corpo devolvem o resultado anterior; outro corpo gera conflito. A simulação substitui a cobrança por gateway real, sem pedir dados bancários. Fontes: [D05](decisoes.md), [serviço](../back-end/src/wallets/wallets.service.ts), [lançamento](../back-end/src/wallets/wallets.repository.ts) e [idempotência](../back-end/src/common/idempotency.ts). |
| Participações e arremates consultados pela API (`566513f`) | O usuário da sessão determina quais lances e arremates entram na consulta. Disputa e resultado vêm do servidor; o comprovante vem da liquidação persistida. Filtrar os dados de todos os usuários no navegador foi descartado pelo acesso restrito na API. Fontes: [consultas](../back-end/src/lots/settlement.repository.ts) e [tela](../front-end/src/features/awards/my-awards-page.tsx). |
| Supabase somente como PostgreSQL (D20; `07422af`) | `DATABASE_URL` atende o runtime; o CLI Prisma prefere `DIRECT_URL`, com fallback local. Regras, papéis e propriedade dos lotes ficam no NestJS. Usar Supabase Auth, PostgREST, Storage ou RLS como camada de autorização foi descartado para manter uma implementação das regras na API. Preparação não comprova conexão hospedada. Fontes: [D20](decisoes.md#d20--supabase-somente-postgresql--24102026), [Prisma](../back-end/prisma.config.ts) e [guard](../back-end/src/auth/roles.guard.ts). |
| Login rápido usa a autenticação normal (`bfc1c43`, `feat/rodada-3`) | Botões de demonstração enviam credenciais fictícias do seed ao mesmo endpoint de login, sob os mesmos limites. Ligados por padrão desde D27 (`54a7e12`); `NEXT_PUBLIC_DEMO_LOGIN=false` os esconde na build; não se concede sessão sem validar credenciais. Fonte: `front-end/src/features/auth/login-form.tsx` no commit `bfc1c43`. |

**Critério de stack.** O enunciado da Verzel (página 5) diz: “Back-End: NodeJS ou Python. Fique à vontade com o framework (NestJS, Express…)”. Isso abriu espaço para NestJS na API e Next.js no front.

### Detalhes por área

**Processo (D13, D14).** Implementação a partir das pranchas HTML/PNG como fonte visual; riscos de arquitetura decididos na tarefa que os usa; migration só local, commits locais, sem push. README e Notion espelhados e atualizados a cada tarefa.

**Sessão e autenticação (Tarefa 3, D15).**

- Senha com Argon2id (m=19456, t=2, p=1) via `@node-rs/argon2`.
- Sessão de 256 bits; o banco guarda só o SHA-256. Validade absoluta de 8 h, revogada no logout.
- Cookie HttpOnly, SameSite=Lax (`__Host-` em produção).
- CSRF por HMAC + Origin exato + cabeçalho `X-CSRF-Token`.
- Rate limit por IP da conexão (login 10/min), sem confiar em `X-Forwarded-For`.
- Proxy same-origin no Next, porque o rewrite não repassava o cookie.

#### Auditoria à prova de adulteração

Cada evento do lote (gênese, lance, extensão, liquidação) gera um envelope assinado com HMAC-SHA-256 que inclui a assinatura do evento anterior. A cadeia fica no PostgreSQL. O último checkpoint (revisão e assinatura) fica numa testemunha em disco, fora do banco, e a chave fica só no ambiente da API. A página pública `/lotes/:id/auditoria` recalcula a cadeia inteira e mostra íntegro, adulterado ou indeterminado:

- Alterar um lance muda o conteúdo assinado e quebra o HMAC (`CHAIN_MISMATCH`).
- Remover um evento quebra o encadeamento ou deixa o histórico menor que a testemunha (`HISTORY_TRUNCATED`).
- Inserir um evento sem a chave não gera assinatura válida (`CHAIN_MISMATCH`).
- Apagar o lote com a testemunha restante dá `LOT_REMOVED`.
- Sem chave ou sem testemunha, o resultado é indeterminado, nunca íntegro.

A confirmação segue a ordem assinar → gravar pendente → commit → promover checkpoint → responder; uma divergência bloqueia novas mutações. Limite assumido: quem tiver a chave e a testemunha ao mesmo tempo consegue forjar. Para testar: altere o valor de um lance direto no banco local e abra a auditoria do lote. Detalhes: [operação da integridade](operacao-integridade.md).

**Componentes (D16).** `radix-ui` como base do shadcn (Dialog, Sheet, HoverCard, NavigationMenu, Accordion), sem vaul.

**Banco hospedado (D20).** Supabase somente como PostgreSQL via Prisma, com regras e autorização no NestJS. O commit `07422af` separa os nomes das conexões: `DATABASE_URL` no runtime e preferência por `DIRECT_URL` no CLI, com fallback local. Sem Supabase Auth, PostgREST, Storage ou RLS como regra de negócio. O guia prevê Session pooler, TLS com certificado validado, Data API desativada e papel `auction_app` sem DDL; esses controles hospedados não foram ensaiados nesta tarefa. O projeto `arremate-verzel`, em São Paulo (`sa-east-1`), está registrado no adendo D20 de `docs/decisoes.md`; isso não comprova a conexão da API nem autoriza migration/seed/deploy. Mídia e testemunha continuam em diretórios próprios da API, não no Supabase Storage.

**Rodada 3 (D21).**

- Entrar, Cadastrar e Redefinir em Sheet lateral; redefinição simulada com mensagem neutra.
- Imagens em object-contain com cards de altura fixa; páginas Perfil, Suporte/FAQ e Como funciona.
- Favoritos: tabela e rotas com sessão + CSRF; a vitrine pública mantém o cache e o coração vem de uma consulta separada.
- Tour guiado no primeiro login, sem biblioteca, com recorte que acompanha o formato do componente e animação de entrada/saída; persistido em localStorage.
- Hero do próximo leilão com “Avise-me quando abrir” (`GET /api/lots/next`).
- Notificações: tabelas `lot_watches` e `notifications`, mantendo as 20 mais recentes. Um runner na API cria a notificação de forma idempotente quando o lote abre, porque o estado deriva do horário. O cliente faz polling a cada 30 s, sem SSE novo; toast local de 8 s, sem dependência nova.
- Footer na cor primária.

**Catálogo e testes.** Um produto por quadro: os lotes duplicados vindos do E2E foram removidos, e o E2E roda isolado em banco e portas próprios. Login rápido de demo fica atrás de flag.

### Entrada animada (D17 e D19)

Splash temático de 3 s com a marca Arremate, moldura latão e fundo papel, no primeiro acesso da sessão; entradas de 850 ms com intervalo maior entre componentes e saída suave de 800 ms. Atualizações de lance, saldo ou cronômetro não reiniciam a montagem. Sem som nem biblioteca adicional; movimento reduzido e interação por teclado, ponteiro ou foco liberam o acesso na hora. Para rever o splash, abrir sessão anônima.

Os testes cobrem primeiro frame, sessão, preço por SSE, depósito simulado, barra fixa mobile, impressão, storage indisponível e shell SSR sem JavaScript. A vitrine dinâmica usa Suspense/useSearchParams e requer JS; não se alega funcionalidade financeira sem JS. Sem migration nem mudança de configuração. [Plano](superpowers/plans/2026-10-24-entrada-animada.md) · [Evidência e limites](evidence/2026-10-24-entrada-animada.md).

### Adendo A7 e recursos Next

Faixa fixa de demonstração, links para Termos/Privacidade/Como funciona, `next/image` com fallback (`artwork-image.tsx`), estados loading/error por rota e OG por lote (`lotes/[id]/opengraph-image.tsx`). Incluído na branch. Fonte: adendo D21 em [decisões](decisoes.md).

## Comportamentos conhecidos e limitações

- O seed só roda em banco local (127.0.0.1/localhost) e exige `AUDIT_HMAC_KEY`.
- O catálogo de 24 obras é importado do The Met durante o seed. Sem rede, as obras que falham só geram aviso no console; o lote base continua sendo criado. Reexecutar o seed não zera nada; use `db:reset-demo`.
- Os lotes “encerrados” do catálogo são liquidados pelo fluxo normal: o seed espera alguns segundos para que fechem.
- O lote base do seed abre sem lances; os lances abertos estão nos lotes do catálogo. A conta `licitante1` (botão de demo) começa sem nenhum lance.
- Sem `AUDIT_HMAC_KEY` a API não publica lotes e não liquida; a auditoria responde indeterminado.
- Tempo real por SSE, com no máximo 3 conexões por IP (a quarta recebe 429); se o canal cai, a sala volta a consultar a cada 10 s.
- Os limites de login e de mutação ficam em memória de uma instância (não distribuídos).
- O login com Google fica desabilitado (“indisponível na demo”) sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`; o consentimento real não foi testado.
- O splash aparece só no primeiro acesso da sessão (use uma aba anônima para revê-lo).
- Sem as imagens geradas por `scripts/zoom-hires.py`, o zoom usa a imagem normal.
- Com `DEMO_BOTS=1`, `licitante2` a `licitante4` cobrem lances automaticamente até o teto configurado.
- Não verificado: Safari/Firefox, aparelho físico, CI remoto e deploy.

## Deploy (pendente)

Pendências já registradas; dependências e infraestrutura não foram reavaliadas nesta atualização documental.

Falta para o deploy (depende de liberação, conta ou segredo do Fernando):

1. Decidir a vulnerabilidade High do `multer` 2.4.0 (fixado por `@nestjs/platform-express` 12.2.0; a API não tem rota de upload): `overrides` para `multer` 2.5.0 (mudança de dependência, exige validação) ou aceitar o risco registrado. Até lá, `npm audit --audit-level=high` falha no CI.
2. Escolher fornecedor e custo da API Node persistente e do disco durável para mídia e testemunha (`MEDIA_DIR`, `AUDIT_WITNESS_DIR`). Nada contratado.
3. Concluir a configuração da Vercel e do fornecedor da API. O projeto PostgreSQL `arremate-verzel` já foi criado no Supabase; conexão da aplicação e configuração hospedada continuam pendentes.
4. Segredos de produção, gerados no painel do fornecedor e nunca no repo: `AUDIT_HMAC_KEY` nova (hex, 32+ bytes), senha do owner (só migração) e do `auction_app` (runtime), `DATABASE_URL`, `API_PROXY_TARGET`, `WEB_ORIGIN`/`SITE_URL` com o domínio real, `SEED_DEMO_PASSWORD` se não usar a senha padrão de demo.
5. Push para `origin` ([FernandoFerreira94/Arremate](https://github.com/FernandoFerreira94/Arremate)) feito em 26/10/2026; primeira execução do CI ainda **não verificada**.
6. Revisão humana antes de migração no banco hospedado, seed de demo e deploy.
7. Depois do deploy: repetir anônimo/login/duas contas, SSE pelo proxy, metadados no HTML, Met fora, restart do worker, backup/restore de banco + mídia + testemunha; conferir lote aberto antes do envio.

## Entrega do desafio

E-mail de codificação recebido em **22/10/2026, ~18h17 (America/Sao_Paulo)**; sete dias corridos levam a **29/10/2026, ~18h17**, com meta operacional de concluir até **29/10/2026 às 18h (America/Sao_Paulo)**. O e-mail de 19/10 pertence à etapa anterior (Coderbyte).

A entrega exige repositório público, aplicação publicada, README reproduzível, dados de demonstração e declaração de uso de IA. Envio pelo [formulário da Verzel](https://elitedev.verzel.com.br/?elite-dev-2026-2), só após revisão do Fernando.

## Fontes e documentação

- [Índice da pasta de decisões](INICIO.md) · [Registro de decisões](decisoes.md)
- [Requisitos rastreados por página do PDF](requisitos.md)
- [Arquitetura proposta e decisões](superpowers/specs/2026-10-23-casa-leiloes-design.md)
- [Plano Superpowers — dez capacidades](superpowers/plans/2026-10-23-casa-leiloes.md) · [cópia no Notion](https://app.notion.com/p/402d66ddfe9381b683bade1789ac68ad)
- [Hospedagem Vercel + API persistente](hospedagem.md)
- [Nome, logo, paletas e shadcn](design/DECISOES-VISUAIS.md) · [9 páginas e briefing para o Grok](design/briefing-grok.md) · [Prompt para o Grok](design/PROMPT-GROK.md)
- [Ambiente local](ambiente.md) · [Evidência do bootstrap](evidence/2026-10-23-bootstrap.md)
- [Testes, evidências e revisão obrigatória](qualidade.md)
- [Metadados, compartilhamento e indexação](metadados.md)
- [Referências Axion/Colinas e auditoria de skills](referencias-e-skills.md)
- [Lifecycle e registro dos gates](lifecycle.md)
- [Narrativa dos agentes e instruções para IAs que editam este README](narrativa-agentes.md)
