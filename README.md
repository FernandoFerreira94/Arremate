# Arremate — Casa de Leilões (Desafio Verzel)

Plataforma de leilões online de obras de arte de acervo público, com lances em tempo real, carteira simulada, anti-sniping, auditoria verificável e comprovante público. “Casa de Leilões”/`casadeleilao` é o nome interno do repositório.

Este README e a página do Notion “README — em elaboração” têm **o mesmo conteúdo** e são atualizados a cada tarefa concluída (D14, 23/10/2026, supera U10). Execução, deploy e testes nunca são preenchidos com resultados presumidos.

- [Comece aqui: pasta de decisões e detalhes](docs/INICIO.md)
- [Registro de decisões](docs/decisoes.md)
- [Projeto canônico no Notion (rascunho privado)](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9)

## Visão geral

- **Visitante:** vê a vitrine, a sala do lote, a auditoria pública e o comprovante.
- **Licitante:** deposita na carteira simulada, dá lances e acompanha participações e arremates.
- **Leiloeiro (vendedor):** busca obras no catálogo do The Met, publica e cancela os próprios lotes e acompanha o painel.
- **Fora do escopo original:** cadastro público obrigatório, tenancy, assinatura, admin genérico, IA no produto, nota fiscal, revenda, app nativo e recuperação de senha.

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
| 10 (parte local) | Seed de demo, corpo JSON grande responde 413, ensaio de 20 licitantes simultâneos (p95 237 ms, invariantes ok) e CI com migração em banco vazio, seed, audit e E2E (CI ainda não rodou: sem remote). |

Extensões de 24/10:

- **Conteúdo de demonstração (D18):** 24 obras CC0 do The Met; estimativa e laudo de conservação sempre marcados como “Simulado para demonstração”; nota do artista, proveniência com link “Ver no The Met”, técnica e número de lances no cartão. Commit local `24b3521`. Evidência: `docs/evidence/2026-10-24-conteudo-demo.md`.
- **Entrada animada (D17, calibrada em D19):** splash temático com a marca, moldura latão e fundo papel, só no primeiro acesso da sessão; títulos, blocos e cards entram em sequência. Ver seção própria abaixo.
- **Rodada 3 — pranchas R1–R10, hero e notificações (D22, registrada como D21 na branch):** adendo ao Freeze D12 (Sheet de auth, redefinição simulada, imagens contain, páginas novas), favoritos, tour, hero com carrossel dos próximos agendados (`GET /api/lots/upcoming`), Avise-me, notificações e rodapé F3-cor. Feito na branch local `feat/rodada-3` (último commit `c11f308`) e incorporado por merge local. Pendente de integração: botão Google, cadastro real, nome/e-mail/cartões no Perfil e links da Carteira por aba. **Pendentes de implementação funcional:** Pix/cartão simulado e login com Google. A revisão do código não encontrou esses fluxos em nenhuma das duas branches. Evidência: `docs/evidence/2026-10-24-rodada-3.md`.

**Recorte das branches.** A `feat/rodada-3` (`c11f308`) entrou na `chore/bootstrap` por merge local `--no-ff` em 25/10/2026, sem push. Na revisão dos conflitos, cada lado foi mantido.

**Arquitetura:** S5 continua aberto como risco aceito (D13). O rewrite externo do Next não preservou o cookie; o proxy é o Route Handler. Banco de produção definido: Supabase como PostgreSQL via Prisma (D20); o fornecedor da API ainda não foi contratado e a API ainda não foi conectada ao banco hospedado. S7 não declarado.

## Como rodar (local)

Pasta canônica: `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao` (a pasta anterior com espaços foi preservada). Não alterar o Node global de outros projetos.

1. Node 24 no PATH (`.nvmrc`); `npm ci`.
2. Copiar `.env.example` para `.env` e preencher as senhas locais (`DB_OWNER_PASSWORD`, `DB_APP_PASSWORD`, `DB_TEST_APP_PASSWORD`). Nunca copiar segredos para README, log ou Notion.
3. `npm run db:up` — PostgreSQL dev em 127.0.0.1:5462 e teste em 5463, só loopback. `npm run db:stop` para só os bancos do projeto, sem remover volumes.
4. `npm run dev:api` (API, porta 4300) e, em outro terminal, `npm run dev:web` (site em [http://127.0.0.1:3300](http://127.0.0.1:3300)).
5. Dados de demo: `npm run db:seed --workspace back-end`. Cria as contas `leiloeiro@arremate.demo` e `licitante1@arremate.demo` a `licitante4@arremate.demo` (senha de demo definida no seed; pode ser trocada por `SEED_DEMO_PASSWORD`), o catálogo de 24 obras e 1 lote aberto. `-- --sem-catalogo` pula o catálogo; `-- --preparar-lote` cria um lote novo aberto. Só banco local; reexecutar não zera nada.
6. Saúde da API: `GET http://127.0.0.1:4300/api/health/live` e `/api/health/ready`. O mesmo health responde em `http://127.0.0.1:3300/api/health/live`, porque o site encaminha `/api`. A resposta não traz senha nem URL de banco.

**Banco e segredos.** A API usa `DATABASE_URL` com o papel `auction_app`, sem DDL nem privilégio administrativo. O owner só roda bootstrap/migration, nos bancos 5462 e 5463. Não apontar a API para o owner nem aplicar migration fora do loopback. `AUDIT_HMAC_KEY` (hex, 32+ bytes), `AUDIT_WITNESS_DIR` e `MEDIA_DIR` (padrão `.data/witness` e `.data/media`) ficam fora do banco e do Git; publicar e liquidar exigem `AUDIT_HMAC_KEY`. Sessão e CSRF não usam segredo novo. `API_PROXY_TARGET` (padrão `http://127.0.0.1:4300`) e `WEB_ORIGIN` são opcionais.

## Como validar

**Fluxo principal para o avaliador**

1. Subir o ambiente e rodar o seed (passos acima).
2. Entrar como licitante e fazer um depósito simulado na carteira.
3. Abrir um lote na vitrine e dar lances; em outra aba, com outro licitante, disputar o mesmo lote e ver a atualização em tempo real.
4. Ao encerrar, conferir o comprovante e a auditoria pública do lote.
5. Também verificável: login rápido de demo (atrás de flag); tour guiado no primeiro login; favoritos; hero do próximo leilão com “Avise-me quando abrir” e a notificação quando o lote abre; um produto por quadro na vitrine; página 404 própria.

### Roteiro de auth, carteira e histórico

Este roteiro descreve o comportamento existente no código; não é um relatório de execução. As contas são fictícias. Use apenas os bancos locais do projeto.

1. **E-mail e senha:** após o seed, abra `/entrar` e use `licitante1@arremate.demo`. Consulte a senha pública de demonstração no [seed](back-end/prisma/seed.ts); se o ambiente usar `SEED_DEMO_PASSWORD`, use a senha local definida para o seed. Entre também como `leiloeiro@arremate.demo` e observe a navegação por papel.
2. **Login rápido:** na `feat/rodada-3`, com `NEXT_PUBLIC_DEMO_LOGIN` habilitada na build, abra Entrar e escolha “Entrar como licitante de teste” ou “Entrar como leiloeiro de teste”. Os botões usam a senha pública padrão do seed; se ela foi substituída, use o formulário manual. Esses botões ainda não estão integrados à `chore/bootstrap`.
3. **Mensagens neutras e sessão:** compare senha incorreta com e-mail inexistente: ambos devem produzir o mesmo erro de credenciais. Faça logout e tente abrir `/carteira`; a área privada deve exigir login. Confira os atributos do cookie sem copiar seu valor. `Secure` e `__Host-` são condicionais à produção.
4. **CSRF e limites:** na aba Rede do navegador, confira Origin e `X-CSRF-Token` em uma mutação autenticada. Reenviar a mutação sem o cabeçalho deve resultar em 403. Tentativas de login acima do limite do [limitador](back-end/src/auth/rate-limit.ts) devem resultar em 429; o contador é local à instância da API.
5. **Depósito simulado:** como licitante, abra `/carteira`, anote o saldo e use um atalho ou um valor válido. Confirme e confira o acréscimo no saldo. Na aba Rede, `POST /api/wallet/deposits` recebe `amountCents` e `Idempotency-Key`, sem dados de cartão. Reenviar a mesma requisição com a mesma chave não deve gerar novo crédito; alterar o corpo mantendo a chave deve gerar conflito.
6. **Participações e arremates:** com `licitante1@arremate.demo` e `licitante2@arremate.demo` em sessões de navegador separadas, dê lances no mesmo lote e abra `/meus-arremates`. Participações deve refletir quem lidera e quem foi superado; após a liquidação, mostra o resultado. Um lote vencido aparece em Arrematados com comprovante público. Para consultar resultados sem aguardar um leilão longo, use os lotes encerrados do catálogo de demonstração. Lista vazia é um estado válido quando a conta ainda não participou.
7. **Supabase:** confira os nomes `DATABASE_URL`/`DIRECT_URL`, [Prisma](back-end/prisma.config.ts), guards e [D20](docs/decisoes.md#d20--supabase-somente-postgresql--24102026). O teste funcional continua no PostgreSQL local. Conexão hospedada, papéis e TLS precisam de ensaio próprio; este roteiro não pede migration, seed ou deploy hospedado.

### Recursos sem fluxo executável neste recorte

Google OAuth/OIDC, cadastro persistido, cadastro de cartão, Pix, extrato navegável da carteira e a nova aba de histórico ainda não têm implementação completa nas branches locais revisadas. Não são apresentados como entregas nem recebem passos fictícios de validação.

- **Google:** o formulário da `feat/rodada-3` contém apenas um TODO para o botão. Não há rotas de OAuth, state, PKCE ou vínculo de conta no backend revisado.
- **Cadastro:** o `RegisterShell` da `feat/rodada-3` coleta nome, e-mail, senha e aceite dos termos, mas ao enviar informa que a integração ainda virá; não grava usuário.
- **Cartão e Pix:** a carteira existente declara que não usa Pix, cartão ou dados bancários; o DTO recebe somente o valor. Não há cadastro de cartão, QR Pix nem processamento por esses métodos. Falta fonte para afirmar aprovação simulada desses fluxos ou persistência segura de cartões. Nenhum número real de cartão é necessário para validar o depósito atual.
- **Histórico e extrato:** já existem Participações e Arrematados, com consultas por usuário. A nova aba de histórico e a exposição do extrato de `wallet_entries` são extensões pendentes; um lançamento no banco não comprova uma tela de extrato.

Fontes do limite de escopo: [rotas de auth](back-end/src/auth/auth.controller.ts), [DTO](back-end/src/wallets/dto/deposit.dto.ts), [carteira](front-end/src/features/wallet/wallet-page.tsx), [schema](back-end/prisma/schema.prisma) e, na `feat/rodada-3`, `auth-sheet.tsx`/`login-form.tsx` em `front-end/src/features/auth/`.

**Testes**

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run db:validate`, `npm run db:generate`, `npm run build`.
- Vitest do front: `npm run test:unit --workspace front-end` (cliente de API e componentes).
- E2E: `npm run test:e2e` (Chromium exige `npx playwright install chromium` no primeiro uso). O Playwright sobe build próprio de produção (site 3310, API 4310) contra o PostgreSQL de teste 5463.
- Movimento de entrada isolado: `node e2e/entry-motion-isolated.cjs`.

Testes automatizados são opcionais no PDF, mas **obrigatórios neste projeto**: cada capacidade exige evidência de testes e revisão de código/segurança. Planejado não significa executado: ver [Qualidade](docs/qualidade.md).

### Histórico de verificação

Registros anteriores, preservados na reconciliação entre README e Notion. As suítes da aplicação não foram reexecutadas nesta atualização de documentação; as contagens abaixo não são um resultado novo nem comprovam os recursos pendentes descritos acima.

| Etapa (Node v24.22.1) | Resultado |
| --- | --- |
| Bootstrap U12 | 5 testes health/erros/pool, 2 integrações PostgreSQL real e 2 E2E Chromium (placeholder/HTML lang-title-noindex/404). Lint, tipos, Prisma validate/generate e builds ok. Após `npm ci`: 1043 pacotes, árvore sem problemas, 9 testes da fundação (exit 0). Dossiê: 24 Markdown, 33 R presentes, 0 links locais quebrados, hash do PDF conferido. |
| Tarefa 1 | Bateria da raiz exit 0: `npm test` 14 (health + money), integração 6 (inclui schema no `casadeleilao_test`), `db:validate`, build. [Evidência](docs/evidence/2026-10-23-tarefa-1.md). |
| Tarefa 2 | Bateria exit 0, com cadeia HMAC e testemunha. E2E, sessão, páginas e deploy não executados; fsync de diretório no Linux não ensaiado. [Evidência](docs/evidence/2026-10-23-tarefa-2.md). |
| Tarefa 3 | Unit 22, integração 25, Vitest 7; saúde em 4300 e CSRF pelo site em 3300 com 200. E2E e revisão independente não feitos. Sem migration nova. [Evidência](docs/evidence/2026-10-23-tarefa-3.md). |
| Tarefa 4 | Unit 43, integração 41, build ok. Smoke real do Met: busca, objeto 436524, imagem 599×423 JPEG validada. [Evidência](docs/evidence/2026-10-23-tarefa-4.md). |
| Tarefa 5 | Unit 43, integração 62. [Evidência](docs/evidence/2026-10-23-tarefa-5.md). |
| Tarefa 6 | Unit 51, integração 74. [Evidência](docs/evidence/2026-10-23-tarefa-6.md). |
| Tarefa 7 | Unit 53, integração 88. [Evidência](docs/evidence/2026-10-23-tarefa-7.md). |
| Tarefa 8 | Vitest 36, E2E Playwright 5. |
| Tarefa 9 | Unit 57, integração 91, Vitest 49, E2E 16 (duas abas disputando, reta final até comprovante, provider fora). |
| Tarefa 10 | Unit 59, integração 96, Vitest 49, E2E 16. [Evidência](docs/evidence/2026-10-23-tarefa-10.md). |
| D18 | Unit 59, integração 99, Vitest 49, Playwright 23, build ok. |
| D17 (entrada animada) | 20 E2E no build local de produção, 49 unitários do front, typecheck/lint/build; review independente; screenshots desktop 1440/mobile 390. |
| D19 | 6 checks de navegador isolado (API simulada só no teste), splash 3006 ms, entrada 850 ms. Com Docker ativo: 20 E2E em 1,2 min no build de produção e banco isolado (exit 0). |
| Rodada 3 | Lint, typecheck, Vitest 64, unit 65, integração 99, Playwright 21. |

Tarefas 4 a 7 sem migration nova.

**Último registro anterior da branch feat/rodada-3:** unit da API 65/65, Vitest 71/71, integração 110/110, E2E 25/25.

**Segurança das dependências.** Auditoria de runtime (`--omit=dev`): 0 alertas. Auditoria completa: 9 High derivados de braces 3.0.3, sem correção upstream, só em tooling (eslint-config-next/shadcn CLI); não aceitar patterns externos nessas ferramentas. ESLint 9.39.5 compatível com os peers do Next, com aviso de fim de suporte. Sem `audit fix --force` nem downgrade automático. Isso não é declaração de produção pronta.

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
- Ao concluir cada tarefa: atualizar `README.md`, o plano e esta página (regra do `AGENTS.md`).

### Project Lifecycle (Dev Hub)

A entrada é o [Project Lifecycle](https://app.notion.com/p/3c3d66ddfe93816e8b7cef1c8bc7c766). O [Boot Protocol](https://app.notion.com/p/34dd66ddfe93816aae0fc4e6b03654ed) é o S8, não o primeiro passo de um produto novo.

| Etapa | Trabalho | Saída exigida |
| --- | --- | --- |
| S0 | Intake da ideia/desafio | Problema, público, contexto e restrições |
| S1 | Validação proporcional ao desafio | GO / GO WITH CONDITIONS / PIVOT / NO-GO |
| S2 | Template Master | Produto, atores, permissões, fluxos e invariantes |
| S3 | Pesquisa de lacunas | Sem blocker pesquisável; hipóteses explícitas |
| S4 | Pre-Development Readiness | PRE-DEVELOPMENT ALIGNED |
| S5 | Project Init | Architecture Freeze |
| S6 | Design Gate | Pranchas e design system validados por Fernando |
| S7 | New Project — Implementation Handoff | IMPLEMENTATION READY |
| S8 | Repository Boot | Contexto, tooling e scaffold autorizados |
| S9 | Desenvolvimento por capacidades | Código, testes, revisão e documentação |
| S10 | Project Health | Contexto, código e fontes sem drift relevante |
| S11 | Release Review | READY ou risco aceitável explicitamente registrado |
| S12 | Publicação e manutenção | Deploy verificado, operação e acompanhamento |

No S8, verificar **S7 PASSED + IMPLEMENTATION READY + autorização explícita**. Consumir o handoff; auditar Git/lint/testes/CI/observabilidade/UI como KEEP/REPLACE/REMOVE/MISSING/N/A; gerar `AGENTS.md` e só os arquivos `.ai/` necessários; instalar apenas tooling faltante; criar `DESIGN.md` a partir do design validado; configurar navegação de código; então iniciar o scaffold. Não reabrir decisões LOCKED nem copiar manuais inteiros para o contexto.

**Exceção U12 (histórico).** Fernando pediu criar a pasta casadeleilao, instalar tudo e aguardar pranchas/design system. Isso autorizou o bootstrap local antes do design/handoff final (manifests/lockfile, AGENTS raiz/front/back, cache `.ai`, tooling, bancos isolados, health e placeholder técnico), mas não funcionalidades financeiras, telas finais, `DESIGN.md` inventado, deploy ou contratação. O plano completo U13 está documentado; nenhum teste de domínio planejado foi marcado como executado.

**D13 (23/10/2026).** S6 aceito com pranchas HTML/PNG como fonte visual, sem Penpot; S5 com riscos aceitos (não PASSED); implementação liberada a partir da Tarefa 1 (migration só local, commits locais, sem push/deploy).

**Design.** Congelado (Design Freeze D12). Fonte visual: pranchas HTML/PNG em `docs/design/pranchas/` e `docs/design/HANDOFF-GROK.md`. [Prompt pronto para o Grok iniciar as pranchas](docs/design/PROMPT-GROK.md).

### Versões alternativas, contadas pelos agentes (Fernando escolhe uma)

#### Versão A (narrativa)

Nós somos os agentes que construíram o Arremate. Antes de qualquer linha de código, o Fernando já tinha desenhado o caminho que íamos seguir: um ciclo de vida em treze estágios, do S0 ao S12, que transforma uma ideia numa máquina de estados verificável. Ideia, validação, definição de produto, pesquisa de lacunas, prontidão, Architecture Freeze, Design Freeze, handoff, boot do repositório, desenvolvimento, saúde, release e produção. Nenhum de nós escolhe a próxima etapa pela memória da conversa: lemos o Lifecycle Control do projeto e avançamos pelo primeiro gate ainda não cumprido.

Cada um tem seu papel. O orquestrador lê o enunciado, quebra o trabalho em tarefas e roda os gates. O Fred, nosso designer, desenha as pranchas antes de existir qualquer componente novo; hero, header e footer nasceram de três variações dele. Os executores, Codex e Cursor/Claude Code, escrevem o código com testes e deixam a evidência em `docs/evidence/`. O QA roda o E2E num mundo à parte, com build, portas e banco próprios.

Podemos pesquisar, comparar alternativas e repetir um gate quantas vezes for preciso. Mas o Fernando definiu onde paramos: troca de decisão já congelada, escolha de design com mais de uma direção válida, credencial, produção, gasto real ou qualquer ação destrutiva. Nesses pontos levamos a ele as alternativas e o trade-off, e ele decide pelo critério, não pela pressa. Foi assim que dependências como `@node-rs/argon2` e `radix-ui` entraram, cada uma com motivo registrado em `docs/decisoes.md`.

Aprendemos a ser honestos com o que sabemos. Planejado não é executado; o que não verificamos fica marcado como não verificado. Commits pequenos, diff conferido, migration só no banco local e nada hospedado sem validação humana. O Fernando projetou a arquitetura, nós executamos dentro dela, e cada entrega passou pelo olhar dele antes de virar parte do produto.

#### Versão B (objetiva)

Somos um time de agentes de IA operando numa arquitetura projetada pelo Fernando. Ele dirige; nós planejamos, desenhamos e programamos.

- **Processo:** seguimos o Project Lifecycle do Dev Hub (S0 a S12) como máquina de estados. A próxima etapa vem do Lifecycle Control do projeto, nunca da memória da conversa. Uma etapa só avança quando todos os critérios BLOCKER do gate estão atendidos ou registrados como risco aceito.
- **Papéis:** orquestrador (plano, tarefas, gates); Fred, designer de UI/UX (pranchas antes de qualquer componente novo); Codex e Cursor/Claude Code (implementação com testes e evidência); QA/E2E isolado (build, portas e banco próprios).
- **Autonomia com limites:** pesquisamos, comparamos e repetimos gates sozinhos. Paramos para decisão do Fernando em mudança de decisão congelada, direção visual com várias opções válidas, credencial, produção, gasto real ou ação destrutiva.
- **Critério do Fernando:** cada escolha relevante foi levada a ele com alternativas e motivo, e ficou registrada em `docs/decisoes.md` (D01 em diante).
- **Disciplina:** commits locais pequenos com diff conferido; nenhuma dependência nova sem validação; migrations só locais; nada hospedado sem validação humana; o que não foi verificado fica marcado como não verificado.

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
| E-mail e senha com Argon2id (D15; `92df234`) | Verifica o hash Argon2id; conta inexistente passa por verificação com hash fictício e recebe o mesmo erro de senha incorreta. Reduz a exposição da existência de contas. Alternativa descartada para o hash: scrypt. Fontes: [D15](docs/decisoes.md), [hash](back-end/src/auth/password-hash.ts) e [auth](back-end/src/auth/auth.service.ts). |
| Sessão revogável no servidor (`92df234`) | Cookie HttpOnly e SameSite=Lax; Secure e prefixo `__Host-` em produção. O banco guarda somente o SHA-256 do token, com expiração absoluta e revogação no logout. Evita persistir o token de sessão em claro no banco. Fontes: [decisão de sessão](docs/decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [cookies](back-end/src/auth/session-cookie.ts) e [repositório](back-end/src/auth/auth.repository.ts). |
| CSRF com origem explícita (`92df234`) | Toda mutação exige Origin permitido e `X-CSRF-Token` validado por HMAC; o cookie sozinho não autoriza a operação. Confiar em `Host` para definir a origem foi descartado. Fontes: [decisão de sessão](docs/decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [guard](back-end/src/auth/csrf.guard.ts) e [auth](back-end/src/auth/auth.service.ts). |
| Limites por conexão e ator (`92df234`) | Login limitado por IP da conexão; mutações privadas, por ator. Cabeçalhos do cliente não escolhem a identidade usada no limite. Confiar em `X-Forwarded-For` foi descartado. O contador fica na memória de uma instância, sem alegar proteção distribuída. Fontes: [decisão de sessão](docs/decisoes.md#sess%C3%A3o-decidida-na-tarefa-3-23102026), [limitador](back-end/src/auth/rate-limit.ts) e [IP](back-end/src/auth/session-cookie.ts). |
| Crédito simulado com transação e idempotência (D05; `6e6ebe4`) | O backend valida o valor, bloqueia a carteira, grava `DEPOSIT` e atualiza o saldo na mesma transação. Mesma chave e corpo devolvem o resultado anterior; outro corpo gera conflito. A simulação substitui a cobrança por gateway real, sem pedir dados bancários. Fontes: [D05](docs/decisoes.md), [serviço](back-end/src/wallets/wallets.service.ts), [lançamento](back-end/src/wallets/wallets.repository.ts) e [idempotência](back-end/src/common/idempotency.ts). |
| Participações e arremates consultados pela API (`566513f`) | O usuário da sessão determina quais lances e arremates entram na consulta. Disputa e resultado vêm do servidor; o comprovante vem da liquidação persistida. Filtrar os dados de todos os usuários no navegador foi descartado pelo acesso restrito na API. Fontes: [consultas](back-end/src/lots/settlement.repository.ts) e [tela](front-end/src/features/awards/my-awards-page.tsx). |
| Supabase somente como PostgreSQL (D20; `07422af`) | `DATABASE_URL` atende o runtime; o CLI Prisma prefere `DIRECT_URL`, com fallback local. Regras, papéis e propriedade dos lotes ficam no NestJS. Usar Supabase Auth, PostgREST, Storage ou RLS como camada de autorização foi descartado para manter uma implementação das regras na API. Preparação não comprova conexão hospedada. Fontes: [D20](docs/decisoes.md#d20--supabase-somente-postgresql--24102026), [Prisma](back-end/prisma.config.ts) e [guard](back-end/src/auth/roles.guard.ts). |
| Login rápido usa a autenticação normal (`bfc1c43`, `feat/rodada-3`) | Botões de demonstração enviam credenciais fictícias do seed ao mesmo endpoint de login, sob os mesmos limites. A flag pública `NEXT_PUBLIC_DEMO_LOGIN` controla sua exibição na build; não se concede sessão sem validar credenciais. Fonte: `front-end/src/features/auth/login-form.tsx` no commit `bfc1c43`. |

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

**Integridade (Tarefa 2).** HMAC-SHA-256 encadeado com testemunha em disco fora do PostgreSQL. A ordem é assinar, gravar pendente, fazer commit, promover o checkpoint e só então responder; divergência bloqueia mutação.

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

Os testes cobrem primeiro frame, sessão, preço por SSE, depósito simulado, barra fixa mobile, impressão, storage indisponível e shell SSR sem JavaScript. A vitrine dinâmica usa Suspense/useSearchParams e requer JS; não se alega funcionalidade financeira sem JS. Sem migration nem mudança de configuração. [Plano](docs/superpowers/plans/2026-10-24-entrada-animada.md) · [Evidência e limites](docs/evidence/2026-10-24-entrada-animada.md).

### Adendo A7 e recursos Next no checkout principal

O trabalho ainda não commitado da etapa 1 acrescenta faixa fixa de demonstração, links para Termos/Privacidade/Como funciona, `next/image` com fallback, estados loading/error por rota e OG por lote. Preserva os tokens, `next/font` e o motion existente. A implementação no working tree não equivale à conclusão dos gates; a validação final continua pendente. Fontes: adendo D21 da `chore/bootstrap` em [decisões](docs/decisoes.md), `front-end/src/components/app/artwork-image.tsx` e `front-end/src/app/lotes/[id]/opengraph-image.tsx` no working tree.

## Deploy (pendente)

Pendências já registradas; dependências e infraestrutura não foram reavaliadas nesta atualização documental.

Falta para o deploy (depende de liberação, conta ou segredo do Fernando):

1. Decidir a vulnerabilidade High do `multer` 2.4.0 (fixado por `@nestjs/platform-express` 12.2.0; a API não tem rota de upload): `overrides` para `multer` 2.5.0 (mudança de dependência, exige validação) ou aceitar o risco registrado. Até lá, `npm audit --audit-level=high` falha no CI.
2. Escolher fornecedor e custo da API Node persistente e do disco durável para mídia e testemunha (`MEDIA_DIR`, `AUDIT_WITNESS_DIR`). Nada contratado.
3. Concluir a configuração da Vercel e do fornecedor da API. O projeto PostgreSQL `arremate-verzel` já foi criado no Supabase; conexão da aplicação e configuração hospedada continuam pendentes.
4. Segredos de produção, gerados no painel do fornecedor e nunca no repo: `AUDIT_HMAC_KEY` nova (hex, 32+ bytes), senha do owner (só migração) e do `auction_app` (runtime), `DATABASE_URL`, `API_PROXY_TARGET`, `WEB_ORIGIN`/`SITE_URL` com o domínio real, `SEED_DEMO_PASSWORD` se não usar a senha padrão de demo.
5. Criar repositório remoto e autorizar push (o CI só roda no GitHub; ainda **não verificado**).
6. Revisão humana antes de migração no banco hospedado, seed de demo e deploy.
7. Depois do deploy: repetir anônimo/login/duas contas, SSE pelo proxy, metadados no HTML, Met fora, restart do worker, backup/restore de banco + mídia + testemunha; conferir lote aberto antes do envio.

## Entrega do desafio

E-mail de codificação recebido em **22/10/2026, ~18h17 (America/Sao_Paulo)**; sete dias corridos levam a **29/10/2026, ~18h17**, com meta operacional de concluir até **29/10/2026 às 18h (America/Sao_Paulo)**. O e-mail de 19/10 pertence à etapa anterior (Coderbyte).

A entrega exige repositório público, aplicação publicada, README reproduzível, dados de demonstração e declaração de uso de IA. Envio pelo [formulário da Verzel](https://elitedev.verzel.com.br/?elite-dev-2026-2), só após revisão do Fernando. Nenhum envio, publicação ou gasto foi autorizado nesta etapa.

## Fontes e documentação

- [Índice da pasta de decisões](docs/INICIO.md) · [Registro de decisões](docs/decisoes.md)
- [Requisitos rastreados por página do PDF](docs/requisitos.md)
- [Arquitetura proposta e decisões](docs/superpowers/specs/2026-10-23-casa-leiloes-design.md)
- [Plano Superpowers — dez capacidades](docs/superpowers/plans/2026-10-23-casa-leiloes.md) · [cópia no Notion](https://app.notion.com/p/402d66ddfe9381b683bade1789ac68ad)
- [Hospedagem Vercel + API persistente](docs/hospedagem.md)
- [Nome, logo, paletas e shadcn](docs/design/DECISOES-VISUAIS.md) · [9 páginas e briefing para o Grok](docs/design/briefing-grok.md) · [Prompt para o Grok](docs/design/PROMPT-GROK.md)
- [Ambiente local](docs/ambiente.md) · [Evidência do bootstrap](docs/evidence/2026-10-23-bootstrap.md)
- [Testes, evidências e revisão obrigatória](docs/qualidade.md)
- [Metadados, compartilhamento e indexação](docs/metadados.md)
- [Referências Axion/Colinas e auditoria de skills](docs/referencias-e-skills.md)
- [Lifecycle e registro dos gates](docs/lifecycle.md)
- [Projeto no Notion — rascunho privado](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9)

---

## 🤖 Instruções para IAs que forem editar este README

Se você é um agente adicionando sua parte, siga estas regras:

1. **Voz:** escreva na voz da IA, em primeira pessoa (os agentes contando como trabalharam).
2. **Critério, não diálogo:** mostre o critério e a validação do Fernando. Nunca transcreva respostas dele nem use “aprovado” ou equivalentes.
3. **Só fatos com fonte:** use apenas o que está no Notion do projeto ou em `docs/decisoes.md`. O que não foi verificado fica marcado como **não verificado**.
4. **Preserve:** mantenha tudo o que já existe e só acrescente.
5. **Sem senhas:** nunca escreva senhas ou segredos; aponte para o seed e para o `.env.example`.
6. **Espelhamento (D14):** README do repositório e esta página do Notion têm o mesmo conteúdo; atualize os dois.
7. **Tom:** pt-BR técnico e humano, frases curtas.
