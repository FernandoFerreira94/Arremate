# Arquitetura — base local

Perfil STANDARD; rigor reforçado em saldo, auth e integridade. Next.js App Router na Vercel e NestJS persistente separado. PostgreSQL 18 é a autoridade transacional. Prisma 7.10.1 com adapter-pg. Node 24 LTS, npm workspaces, um lockfile.

- Dinheiro: `parseMoney` / `parsePositiveMoney` / `formatMoney` em `back-end/src/common/money.ts`. Centavos em `bigint`, teto `999999999999` por lançamento, saldo acumulado em `numeric(38,0)`. Sem `Number`.
- Schema do núcleo na migration `20261023104706_auction_core`, aplicada só em 127.0.0.1:5462 e 5463. CHECK de saldo, prazo e valores positivos estão no SQL, porque o Prisma 7 não os representa. Testemunha de auditoria continua fora do banco.
- Runtime `auction_app` sem CREATE. Owner só na migration e no runner do teste de schema.
- Portas locais: web 3300, API 4300, PostgreSQL dev 5462 / teste 5463, loopback.
- HMAC, sessão/CSRF, SSE, Met e topologia de produção seguem proposta (S5 aberto, risco aceito em D13). Nada contratado. Sem push/deploy.

Motivo/alternativa: Next simplifica Vercel e o HTML inicial. Nest organiza controller, service e repository. Prisma 8 era RC; a linha usada é 7.10.1.

U13 e D01–D14: shadcn obrigatório, nome Arremate, Design Freeze, S6 aceito em HTML/PNG. UI final continua na Tarefa 8.
