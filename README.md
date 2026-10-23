# Arremate — Casa de Leilões (Desafio Verzel)

README e página do Notion ([README — em elaboração](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82)) são mantidos **sempre atualizados e com o mesmo conteúdo**, a cada tarefa concluída (Fernando, 23/10/2026; D14).

- [Comece aqui: pasta de decisões e detalhes](docs/INICIO.md).
- [Prompt pronto para o Grok iniciar as pranchas](docs/design/PROMPT-GROK.md).
- [Projeto canônico no Notion](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9).

## Estado atual (23/10/2026)

- **Nome:** Arremate (“Casa de Leilões”/`casadeleilao` fica como nome interno do repositório).
- **Stack:** monorepo npm (Node 24 LTS); `front-end` Next.js App Router + React + Tailwind 4 + shadcn; `back-end` NestJS 12 + Prisma 7; PostgreSQL 18 via Docker Compose. Site na Vercel e API Node persistente separada.
- **Design:** congelado (Design Freeze D12); fonte visual = pranchas HTML/PNG em `docs/design/pranchas/` e `docs/design/HANDOFF-GROK.md` (S6 aceito sem Penpot, D13).
- **Tarefa 3 concluída, só local:** sessão opaca, CSRF e papéis. O site em 3300 encaminha `/api` para a API em 4300. `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout` e `GET /api/auth/me` existem. Não há tela de entrar (Tarefa 8). As tarefas 1 e 2 permanecem. Sem push e sem deploy.
- **Tarefa 9 parcial, só local:** vitrine pública em `/`, sala do lote `/lotes/:id` com lance, contador e tempo real (SSE `GET /api/events?lotId=`, polling de 10 s se o canal cair), auditoria pública `/lotes/:id/auditoria` (`GET /api/lots/:id/audit`), comprovante `/comprovantes/:token`, metadados/OG/ícones e 404 real. Testes: unit 57, integração 91, Vitest 49, E2E 13. Sem `AUDIT_HMAC_KEY` não há lote para ver na sala; as suítes `live-bidding` e `provider-outage` ficam pendentes.
- **Tarefa 8 concluída, só local:** telas `/entrar`, `/carteira`, `/painel/lotes`, `/painel/lotes/novo` e `/meus-arremates` com design system shadcn (tokens do HANDOFF, só tema claro), navegação por papel e menu móvel. Vitest do front 36 testes e E2E Playwright 5 testes verdes. Publicar de verdade ainda exige `AUDIT_HMAC_KEY`. Vitrine e sala ao vivo ficam na Tarefa 9.
- **Tarefa 7 concluída, só local:** liquidação automática (a cada 1 s e no startup) que debita o vencedor, credita o vendedor e emite um comprovante público (`GET /api/receipts/:token`) validado pela auditoria. Listas do licitante (`/api/me/participations`, `/api/me/awards`) e painel do vendedor (`/api/seller/summary`). Sem tela ainda (Tarefas 8 e 9). Sem `AUDIT_HMAC_KEY` o runner não liquida.
- **Tarefa 6 concluída, só local:** lance (`POST /api/lots/:id/bids`, só licitante, com `Idempotency-Key`) com reserva integral do saldo, liberação do líder superado na mesma transação, prorrogação de 120 s (anti-sniping) e recusas com código em pt-BR. Testado sob concorrência no PostgreSQL real. Sem tela ainda (Tarefa 9).
- **Tarefa 5 concluída, só local:** carteira do licitante (`GET /api/wallet`) e depósito simulado idempotente (`POST /api/wallet/deposits`). Saldo total, comprometido e disponível em centavos como texto; cada depósito grava um lançamento `DEPOSIT` na mesma transação. Sem pagamento real, saque ou gateway. Sem tela ainda (Tarefa 8).
- **Tarefa 4 concluída, só local:** catálogo do Met (busca v1.1, só leiloeiro, 30/min), snapshot e imagem validados gravados antes de publicar, publicação idempotente com gênese de auditoria, cancelamento pelo dono e vitrine/detalhe/lista do vendedor. Sem tela ainda (Tarefa 8): o site em 3300 continua o placeholder. Publicar exige `AUDIT_HMAC_KEY` no arquivo de ambiente local; sem ela a API responde 503 `AUDITORIA_INDISPONIVEL`.
- **Arquitetura:** S5 continua aberto como risco aceito (D13). O rewrite externo do Next não preservou o cookie; o proxy é o Route Handler. Fornecedor de produção ainda não foi escolhido nem contratado. S7 não declarado.

## Como rodar (local)

1. Node 24 no PATH (`.nvmrc`); `npm ci`.
2. Copiar `.env.example` para `.env` e preencher as senhas locais (`DB_OWNER_PASSWORD`, `DB_APP_PASSWORD`, `DB_TEST_APP_PASSWORD`).
3. `npm run db:up` — PostgreSQL dev em 127.0.0.1:5462 e teste em 5463.
4. `npm run dev:api` (API, porta 4300) e `npm run dev:web` (site em http://127.0.0.1:3300).
5. Verificação: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run db:validate`, `npm run build`. O Vitest do front (`npm run test:unit --workspace front-end`) cobre o cliente de API. E2E: `npm run test:e2e` (não faz parte da Tarefa 3; o Playwright sobe outro site na 3300).
6. Saúde da API, com ela no ar na porta 4300: `GET http://127.0.0.1:4300/api/health/live` e `GET http://127.0.0.1:4300/api/health/ready`. O mesmo health responde em `http://127.0.0.1:3300/api/health/live` porque o site encaminha `/api`. A resposta não traz senha nem URL de banco.
7. A API usa `DATABASE_URL` com o papel `auction_app`, sem DDL. A migration local usa o owner só no runner, nos bancos 5462 e 5463. Não apontar a API para o owner e não aplicar migration fora do loopback. A chave `AUDIT_HMAC_KEY` e o diretório `AUDIT_WITNESS_DIR` ficam fora do banco e do Git; a API ainda não lê esses nomes porque a rota de auditoria entra depois. Sessão e CSRF não usam segredo novo no `.env`. `API_PROXY_TARGET` (padrão `http://127.0.0.1:4300`) e `WEB_ORIGIN` (origem extra, se houver) são opcionais.

## Fontes e documentação

- [Índice completo da pasta de decisões](docs/INICIO.md).
- [Registro de decisões](docs/decisoes.md).
- [Hospedagem Vercel + API persistente](docs/hospedagem.md).
- [Prompt para o Grok iniciar as pranchas](docs/design/PROMPT-GROK.md).

- [Projeto no Notion — rascunho privado](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9).
- [Requisitos rastreados por página do PDF](docs/requisitos.md).
- [Arquitetura proposta e decisões](docs/superpowers/specs/2026-10-23-casa-leiloes-design.md).
- [Plano Superpowers completo — dez capacidades](docs/superpowers/plans/2026-10-23-casa-leiloes.md).
- [Cópia do plano no Notion](https://app.notion.com/p/402d66ddfe9381b683bade1789ac68ad).
- [Nome, logo, paletas e shadcn](docs/design/DECISOES-VISUAIS.md).
- [Ambiente local](docs/ambiente.md) e [evidência do bootstrap](docs/evidence/2026-10-23-bootstrap.md).
- [9 páginas e briefing para o Grok](docs/design/briefing-grok.md).
- [Testes, evidências e revisão obrigatória](docs/qualidade.md).
- [Metadados, compartilhamento e indexação](docs/metadados.md).
- [Referências Axion/Colinas e auditoria de skills](docs/referencias-e-skills.md).
- [Lifecycle e registro dos gates](docs/lifecycle.md).

## Boot oficial do Dev Hub

A entrada é o [Project Lifecycle](https://app.notion.com/p/3c3d66ddfe93816e8b7cef1c8bc7c766), que controla a ordem abaixo. O [Boot Protocol](https://app.notion.com/p/34dd66ddfe93816aae0fc4e6b03654ed) é S8, e não o primeiro passo de um produto novo.

| Etapa | Trabalho | Saída exigida |
| --- | --- | --- |
| S0 | Intake da ideia/desafio | Problema, público, contexto e restrições |
| S1 | Validação proporcional ao desafio | GO / GO WITH CONDITIONS / PIVOT / NO-GO |
| S2 | Template Master | Produto, atores, permissões, fluxos e invariantes |
| S3 | Pesquisa de lacunas | Sem blocker pesquisável; hipóteses explícitas |
| S4 | Pre-Development Readiness | PRE-DEVELOPMENT ALIGNED |
| S5 | Project Init | Architecture Freeze aprovado |
| S6 | Design Gate | Pranchas e design system do Grok aprovados por Fernando |
| S7 | New Project — Implementation Handoff | IMPLEMENTATION READY |
| S8 | Repository Boot | Contexto, tooling e scaffold autorizados |
| S9 | Desenvolvimento por capacidades | Código, testes, revisão e documentação |
| S10 | Project Health | Contexto, código e fontes sem drift relevante |
| S11 | Release Review | READY ou risco aceitável explicitamente registrado |
| S12 | Publicação e manutenção | Deploy verificado, operação e acompanhamento |

No S8, verificar **S7 PASSED + IMPLEMENTATION READY + autorização explícita**. Consumir o handoff aprovado; auditar Git/lint/testes/CI/observabilidade/UI como KEEP/REPLACE/REMOVE/MISSING/N/A; gerar AGENTS.md e somente os arquivos `.ai/` necessários; instalar apenas tooling faltante; criar DESIGN.md a partir do design aprovado; configurar navegação de código quando houver código; então iniciar o scaffold. Não reabrir decisões LOCKED nem copiar manuais inteiros para o contexto.

**Histórico — exceção U12:** Fernando pediu criar a pasta casadeleilao, instalar tudo e aguardar pranchas/design system. A instrução do usuário autoriza bootstrap local antes do design/handoff final: manifests/lockfile, AGENTS raiz/front/back, cache .ai, tooling, bancos isolados, health e placeholder técnico. Não autoriza funcionalidades financeiras, telas finais, DESIGN.md inventado, deploy ou contratação. O restante do Boot deve ser reconciliado ao receber o design aprovado. O plano completo U13 está documentado; nenhum teste planejado de domínio foi marcado como executado.

**Atualização D13 (23/10/2026):** S6 aceito com pranchas HTML/PNG; S5 com riscos aceitos; implementação liberada a partir da Tarefa 1 (migration só local, commits locais, sem push/deploy). S5 não está PASSED.

## Entrega do desafio

O e-mail de codificação foi recebido em **22/10/2026, aproximadamente 18h17, America/Sao_Paulo**. Sete dias corridos resultam em **29/10/2026, aproximadamente 18h17**; planejar concluir antes. O e-mail de 19/10 pertence à etapa anterior, Coderbyte.

Entrega exige repositório público, aplicação publicada, README reproduzível, dados de demonstração e declaração de uso de IA. Envio pelo [formulário da Verzel](https://elitedev.verzel.com.br/?elite-dev-2026-2), somente após revisão de Fernando. Nenhum envio, publicação ou gasto foi autorizado nesta etapa.

## Execução e testes

Pasta canônica: `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao`. A pasta anterior com espaços foi preservada. Node24.22.1 LTS e npm11.19.0; um lockfile npm na raiz. Não alterar Node global de outros projetos. Configurar `.env` privado pelos nomes/placeholders de `.env.example`, com senhas próprias; nunca copiar segredos para README/log/Notion.

Comandos da fundação, da raiz: `npm ci`; `npm run db:up`; `npm run dev:api`; em outro terminal, `npm run dev:web`. Web local 3300, API 4300, PostgreSQL dev 5462 / teste 5463, somente loopback. Runtime do banco sem privilégios administrativos/DDL; owner só bootstrap/migration. A Tarefa 1 criou o schema do núcleo e a migration `20261023104706_auction_core`, já aplicada nesses dois bancos locais. Não há seed de domínio.

Verificação: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run db:validate`, `npm run db:generate`, `npm run build`, `npm run test:e2e`. Chromium requer `npx playwright install chromium` no primeiro uso. `npm run db:stop` para somente os bancos do projeto, sem remover volumes.

Executado na base (bootstrap U12, antes da Tarefa 1):5testes health/erros/pool,2integrações PostgreSQL real e2E2E Chromium (placeholder/HTMLlang-title-noindex/404). Lint front/back, tipos, Prisma validate/generate e builds passaram. Rodada final após `npm ci`:1043pacotes, árvore completa sem problemas, lint/tipos/Prisma/builds e os9testes da fundação passaram (exit0). Dossiê:24Markdown,33R presentes,0links locais quebrados e hash do PDF conferido. Resultados em evidence. Vitest está instalado, sem suíte de componentes ainda. CI configurado, não executado no GitHub.

Tarefa 1 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (14 testes: health + money), `npm run test:integration` (6 testes, inclusive o schema no `casadeleilao_test`), `npm run db:validate` e `npm run build` saíram 0. Detalhe em [docs/evidence/2026-10-23-tarefa-1.md](docs/evidence/2026-10-23-tarefa-1.md).

Tarefa 2 (23/10/2026, Node v24.22.1): a mesma bateria da raiz saiu 0, agora com a cadeia HMAC e a integração da testemunha. Detalhe e contagens em [docs/evidence/2026-10-23-tarefa-2.md](docs/evidence/2026-10-23-tarefa-2.md). E2E, sessão, páginas e deploy não foram executados nesta tarefa. O fsync de diretório no Linux não foi ensaiado.

Tarefa 3 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (22), `npm run test:integration` (25), `npm run db:validate` e `npm run build` saíram 0. Vitest do front: 7 testes. Saúde em 4300 e CSRF pelo site em 3300 responderam 200. Detalhe em [docs/evidence/2026-10-23-tarefa-3.md](docs/evidence/2026-10-23-tarefa-3.md). E2E, revisão independente e a página Notion não foram feitos. Sem migration nova.

Tarefa 4 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (41) e `npm run build` saíram 0. Smoke real do Met: busca, objeto 436524 e imagem 599×423 JPEG validada. Variáveis novas, só nomes: `AUDIT_HMAC_KEY` (hex, 32 bytes ou mais), `AUDIT_WITNESS_DIR` e `MEDIA_DIR` (padrão `.data/witness` e `.data/media`, fora do Git). Detalhe em [docs/evidence/2026-10-23-tarefa-4.md](docs/evidence/2026-10-23-tarefa-4.md). Sem migration nova.

Tarefa 7 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (53), `npm run test:integration` (88) e `npm run build` saíram 0. Detalhe em [docs/evidence/2026-10-23-tarefa-7.md](docs/evidence/2026-10-23-tarefa-7.md). Sem migration nova.

Tarefa 6 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (51), `npm run test:integration` (74) e `npm run build` saíram 0. Detalhe em [docs/evidence/2026-10-23-tarefa-6.md](docs/evidence/2026-10-23-tarefa-6.md). Sem migration nova.

Tarefa 5 (23/10/2026, Node v24.22.1): `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (62) e `npm run build` saíram 0. Detalhe em [docs/evidence/2026-10-23-tarefa-5.md](docs/evidence/2026-10-23-tarefa-5.md). Sem migration nova.

Segurança das dependências: auditoria de runtime (`--omit=dev`)0alertas. Auditoria completa9High derivados de braces3.0.3 sem correção upstream, só tooling eslint-config-next/shadcnCLI; não aceitar patterns externos nessas ferramentas. ESLint9.39.5 compatível com peers atuais do Next, com aviso de fim de suporte; acompanhar atualização compatível. Sem `audit fix --force` ou downgrade automático sugerido pelo auditor. Isso não é declaração de produção pronta.

Testes automatizados são opcionais no PDF, mas **obrigatórios neste projeto por decisão de Fernando**. Cada capacidade exige evidência de testes e revisão de código/segurança. Planejado não significa executado: consulte [Qualidade](docs/qualidade.md).

## Processo de documentação

`README.md` e a página Notion “README — em elaboração” têm o mesmo conteúdo e são atualizados a cada tarefa concluída (D14, supera U10). Não preencher execução/deploy/testes com resultados presumidos. A pasta docs/ contém decisões, requisitos, arquitetura, plano, qualidade, metadados e briefing do Grok.
