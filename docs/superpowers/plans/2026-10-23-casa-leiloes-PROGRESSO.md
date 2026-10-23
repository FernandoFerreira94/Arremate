# Progresso — Casa de Leilões

Atualizado em 23/10/2026. Tarefa 2 não foi iniciada.

## Tarefa 1 — concluída

- Dinheiro: `back-end/src/common/money.ts` e `back-end/test/money.spec.ts`. Vermelho por módulo ausente; depois 9 testes verdes.
- Schema: `back-end/prisma/schema.prisma`. Migration `back-end/prisma/migrations/20261023104706_auction_core/migration.sql`.
- Aplicada com o owner só em `127.0.0.1:5462/casadeleilao` e `127.0.0.1:5463/casadeleilao_test`.
- Integração do schema: 4 testes verdes contra `casadeleilao_test`, num schema descartável.
- `test:unit` deixou de apontar só para `health.spec.ts`.
- Docs: decisões, spec, lifecycle, `.ai/architecture.md`, `docs/api.md`, README, plano.

## Revisão de segurança

- SQL: o teste usa parâmetros. O nome do schema de prova é constante. Não há concatenação de entrada de usuário.
- Dinheiro: parse rejeita decimal, notação científica, sinal, espaços e o que passa de `999999999999`, via `bigint`, sem `Number`. Saldo acumulado pode ser maior e cabe em `numeric(38,0)`. CHECK impede total ou comprometido negativo e comprometido acima do total.
- Papéis: `auction_app` em dev e teste faz SELECT/INSERT e recebe CREATE `42501`. Owner só na migration e no runner do teste. `DATABASE_URL` continua com `auction_app`.
- Privacidade: e-mail e `password_hash` existem na tabela. Esta tarefa não abre endpoint que os devolva. README, evidência e log não levam senha nem URL.
- Sem achado High/Critical nesta tarefa. Sessão, IDOR e testemunha ainda não existem; continuam risco do S5 para as tarefas seguintes.

## Comandos (exit 0, Node v24.22.1)

`npm run lint`, `npm run typecheck`, `npm test` (14), `npm run test:integration` (6), `npm run db:validate`, `npm run build`.

## Pendências

- Notion README não atualizado nesta sessão: o conector pede autenticação no Cursor desktop.
- Topologia de produção não escolhida e não contratada.
- Formatação BRL da UI fica na Tarefa 8.
- E2E e CI do GitHub não foram executados.
