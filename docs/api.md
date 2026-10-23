# API — contratos de fronteira

Contratos da Tarefa 1. Os endpoints abaixo são o desenho; a implementação começa nas tarefas 3–7. Dinheiro e o schema já existem.

## Tipos

```ts
type MoneyText = string; // /^(0|[1-9][0-9]*)$/
type Role = "AUCTIONEER" | "BIDDER";
type Actor = { userId: string; role: Role }; // só da sessão
type AuditStatus = "INTACT" | "TAMPERED" | "INDETERMINATE";
type ApiFailure = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, string>;
};
```

`Actor` não vem do corpo. Erros em pt-BR, sem stack, SQL, segredo ou PII.

## Dinheiro

Centavos inteiros. `parseMoney` aceita texto estruturalmente válido, inclusive `"0"`, até `999999999999` por lançamento (depósito, lance inicial, incremento e lance). `parsePositiveMoney` é a mesma regra com `> 0`. `formatMoney` devolve o texto decimal de um `bigint` não negativo, sem `Number`. Saldo acumulado e crédito de liquidação do leiloeiro podem passar do teto de lançamento; a carteira guarda `total` e `committed` em `numeric(38,0)`. Cada movimento e cada lance usam `bigint`.

A UI formata BRL só para exibição e converte a entrada do formulário sem float. Essa formatação visual entra na Tarefa 8; o back já é a autoridade.

## Idempotência

Depósito, lance e publicação exigem `Idempotency-Key` UUID. O escopo único é ator + operação + recurso + chave. O mesmo corpo devolve o resultado original; corpo diferente devolve 409. O resultado financeiro permanece enquanto o histórico existir.

## Tabelas

`users`, `sessions`, `catalog_item_snapshots`, `lots`, `bids`, `wallets`, `wallet_entries`, `settlements`, `receipts`, `idempotency_records`. Detalhe e CHECKs: `back-end/prisma/schema.prisma` e a migration `20261023104706_auction_core`. A testemunha de auditoria não fica no PostgreSQL.

O papel `auction_app` faz SELECT/INSERT/UPDATE/DELETE. CREATE/ALTER ficam com o owner, só na migration local. A API não usa a credencial de owner.

## Endpoints previstos

| Endpoint | Permissão |
| --- | --- |
| GET /api/auth/csrf; POST /api/auth/login; POST /api/auth/logout; GET /api/auth/me | Sessão |
| GET /api/lots; GET /api/lots/:id; GET /api/lots/:id/bids | Público; sem cancelados na vitrine |
| GET /api/catalog/search; GET /api/catalog/items/:externalId | Leiloeiro |
| POST /api/lots; POST /api/lots/:id/cancel | Leiloeiro, próprio lote |
| GET /api/seller/lots; GET /api/seller/summary | Leiloeiro autenticado |
| GET /api/wallet; POST /api/wallet/deposits | Licitante, própria carteira |
| POST /api/lots/:id/bids | Licitante |
| GET /api/me/bids; GET /api/me/awards | Próprias participações e arremates |
| GET /api/lots/:id/audit; GET /api/receipts/:publicToken | Público, sem PII |
| GET /api/events?lotId= | SSE |
| GET /api/health/live; GET /api/health/ready | Saúde, sem segredo |

HTTP: 400 entrada, 401 sessão, 403 papel, 404 recurso privado, 409 conflito, 429 limite, 503 dependência ou confirmação indisponível. Paginação `page >= 1`, padrão 20, teto 100. A vitrine usa 8 itens (D10).
