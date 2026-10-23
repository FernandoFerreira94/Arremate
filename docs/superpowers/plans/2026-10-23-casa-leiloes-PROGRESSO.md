# Progresso — Casa de Leilões

Atualizado em 23/10/2026. Tarefa 2 concluída. Tarefa 3 não foi iniciada.

## Tarefa 2 — concluída

- Cadeia: `back-end/src/audit/audit-chain.ts`. Vermelho por export ausente; depois 4 testes unitários verdes, com bytes e HMAC fixos.
- Testemunha: `checkpoint-store.ts`, `audit.service.ts`, `audit.repository.ts`. Integração vermelha por módulos ausentes; depois 8 testes verdes no `casadeleilao_test` (porta 5463) e diretório temporário.
- Ataques SQL (valor, usuário com o mesmo alias, inserção, remoção, reordenação, prefixo, lote removido, termo, fim, liquidação, linha duplicada) não voltam INTACT.
- Falha de write/fsync/rename depois do commit fica INDETERMINATE. Sem `pending`, o banco não é reassinado.
- Restart em processo novo. Leitura instável fica `CONCURRENT_READ`, não TAMPERED.
- Operação: `docs/operacao-integridade.md`.

## Tarefa 1 — concluída

- Dinheiro: `back-end/src/common/money.ts` e `back-end/test/money.spec.ts`.
- Schema e migration `20261023104706_auction_core` nos bancos locais 5462 e 5463.
- Integração do schema: 4 testes verdes contra `casadeleilao_test`.

## Revisão de segurança

- Assinatura: HMAC-SHA-256, `timingSafeEqual`, chave só em memória. `AuditResult` não leva usuário interno, e-mail, chave, assinatura nem token de recibo.
- Testemunha: caminho só com UUID; revisão monotônica; sem método que assine o banco atual quando falta o `pending`.
- SQL: parâmetros. `search_path` entra com `SET LOCAL` num identificador validado, dentro da transação, e não fica na conexão devolvida ao pool. Leitura em `REPEATABLE READ`.
- Linha duplicada de lote ou liquidação, mesmo depois de derrubar a chave primária, volta TAMPERED. Achado Médio da revisão adversária, fechado no mesmo dia. Sem High/Critical.
- Neste Windows, fsync de diretório devolve EPERM. A gravação do arquivo segue. Isso não prova durabilidade de diretório no Linux.
- Sessão, IDOR e a rota HTTP de auditoria ainda não existem.

## Comandos (exit 0, Node v24.22.1)

`npm run lint`, `npm run typecheck`, `npm test` (18), `npm run test:integration` (14), `npm run db:validate`, `npm run build`.

`GET /api/health/live` e `GET /api/health/ready` em 127.0.0.1:4300 responderam 200.

## Pendências

- Notion README não atualizado: o conector pede autenticação no Cursor desktop.
- Topologia de produção e o diretório real da testemunha não foram escolhidos nem contratados.
- Fsync de diretório no Linux não foi executado.
- Formatação BRL da UI fica na Tarefa 8.
- E2E e CI do GitHub não foram executados.
