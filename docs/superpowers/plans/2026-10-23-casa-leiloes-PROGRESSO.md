# Progresso — Casa de Leilões

Atualizado em 23/10/2026. Tarefa 3 concluída no código e nos testes. A revisão independente de auth continua aberta. Tarefa 4 não foi iniciada.

## Tarefa 3 — concluída no local

- Sessão: Argon2id m=19456, t=2, p=1; token de 256 bits; só o hash no banco; 8 horas absolutas; logout revoga. `@node-rs/argon2` aprovado por Fernando (D15, 23/10 14:21).
- CSRF: HMAC do cookie HttpOnly; `Origin` exato; sem CORS; `trust proxy` desligado.
- Papéis: leiloeiro não deposita nem lança; licitante não cria; lote de outro no cancelamento volta 404. Os quatro caminhos são stubs e não gravam.
- Proxy: Route Handler `front-end/src/app/api/[...path]/route.ts`. O rewrite externo não repassou o cookie.
- Login devolve `{ role, returnTo }`. `/me` devolve só `{ role }`. Sem alias de conta.
- Evidência: `docs/evidence/2026-10-23-tarefa-3.md`.

## Tarefa 2 — concluída

- Cadeia HMAC e testemunha fora do banco. Integração no `casadeleilao_test` (porta 5463).
- Operação: `docs/operacao-integridade.md`.

## Tarefa 1 — concluída

- Dinheiro inteiro e migration `20261023104706_auction_core` nos bancos locais 5462 e 5463.

## Revisão de segurança

- Autoria desta tarefa: ver a evidência. Sem High/Critical nessa leitura.
- Subagente de revisão não rodou (cota). O item “review independente” do plano permanece aberto.
- Limite em memória e IP da conexão são a limitação declarada de uma instância.
- Fsync de diretório no Linux segue não executado (Tarefa 2).

## Comandos (exit 0, Node v24.22.1)

`npm run lint`, `npm run typecheck`, `npm test` (22), `npm run test:integration` (25), `npm run db:validate`, `npm run build`. Vitest do front: 7 testes.

`GET /api/health/live` e `GET /api/health/ready` em 127.0.0.1:4300 responderam 200. `GET /api/auth/csrf` pelo site em 3300 respondeu 200; login inválido respondeu 401.

## Pendências

- Revisão independente de autenticação, limite, cache e proxy.
- Notion README não atualizado: o conector pede autenticação no Cursor desktop.
- Topologia de produção e o diretório real da testemunha não foram escolhidos nem contratados.
- Fsync de diretório no Linux não foi executado.
- SSE pelo proxy não foi medido.
- Tela de entrar e formatação BRL ficam na Tarefa 8.
- E2E e CI do GitHub não foram executados.
