# Backend

Seguir AGENTS.md raiz. Base NestJS 12 + TypeScript strict + Prisma 7/PostgreSQL.

- Controller fino, service com regra de negócio, repository com Prisma/SQL. Sem BaseRepository genérico.
- Health é intencionalmente público e não retorna configuração/PII. Endpoints de negócio futuros exigem guard/policy e ownership.
- DTOs explícitos, whitelist/forbidNonWhitelisted; resposta segura pt-BR, requestId, nenhuma stack/SQL/segredo.
- Transação: usar somente tx para leituras decisórias e escrita. Ordem de locks lote→carteiras por ID e clock real após lock.
- DB runtime não é superuser e não cria schema. Owner local é só bootstrap/migration, nunca conexão da API.
- Bancos do projeto: 5462 dev e 5463 teste. Teste integrado usa somente TEST_DATABASE_URL.
- Schema do núcleo em `prisma/schema.prisma` (migration `auction_core`). Não inventar tabelas fora do plano. CHECKs ficam no SQL: Prisma 7 não os modela.
- Rodar typecheck separado do build/teste. Testes Jest unitários e integração PostgreSQL real; review antes de concluir.

## Boas práticas adicionais (Axion/Colinas, 23/10/2026)

- Nunca espalhar `req.body`: usar só campos explícitos do DTO validado; update com `PartialType`.
- Rotas específicas antes de `/:id`; `findOne` antes de update/delete (404 claro).
- IDOR: o recurso pedido pertence ao usuário/papel da request; checar dono no service.
- Exceções HTTP do Nest com mensagem pt-BR; nunca `throw new Error` em caminho de request. Senha, hash ou token nunca na resposta.
- Sem `console.log`: usar o `Logger` do Nest, sem segredo/PII em log.
- Prisma: `select` explícito; sem query dentro de loop; listagem paginada; schema só via migration com OK; nunca `db push`/`migrate reset`.
- Dinheiro bigint no domínio e string decimal no HTTP.
- O agente não sobe nem derruba banco/back de outros projetos.
