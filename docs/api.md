# API — contratos de fronteira

Contratos da Tarefa 1, com o resultado de auditoria da Tarefa 2 e a sessão da Tarefa 3. Os endpoints de catálogo, carteira, lance, liquidação e SSE continuam desenho. Dinheiro, schema, integridade e a sessão HTTP já existem.

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

## Auditoria

A Tarefa 2 verifica o lote no backend. A rota `GET /api/lots/:id/audit` continua prevista para a Tarefa 9. O resultado público é:

```ts
type AuditResult = {
  status: AuditStatus;
  revision: number | null;
  count: number | null;
  verifiedAt: string;
  reasonCode: string;
  message: string; // pt-BR, sem id interno, e-mail, chave ou token
};
```

`signBid(event, previousSignature, key)` devolve hex de HMAC-SHA-256 dos bytes canônicos `v1`. A chave fica fora do banco. Ordem operacional e códigos: [operacao-integridade.md](operacao-integridade.md).

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

## Sessão (Tarefa 3)

Implementado: `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

```ts
type PublicSession = { role: Role; returnTo?: string };
```

Login devolve `role` e `returnTo`. `/me` devolve só `role`. Sem e-mail, `userId`, senha ou token. A tabela `users` não tem alias; o alias do lance continua na Tarefa 6.

`returnTo` só aceita `/`, `/entrar`, `/painel/lotes`, `/painel/lotes/novo`, `/carteira`, `/meus-arremates`, `/lotes/<uuid>`, `/lotes/<uuid>/auditoria` e `/comprovantes/<token de 20 a 128>`. Esquema, `//`, barra invertida, `%`, `..`, consulta e hash voltam 400 `REQUISICAO_INVALIDA`, sem sessão. Omitido: leiloeiro vai a `/painel/lotes`; licitante vai a `/`.

Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. Produção: `Secure` e nomes `__Host-session` / `__Host-csrf`. O valor de sessão é opaco (256 bits); o banco guarda só SHA-256. Validade absoluta de 8 horas. Logout grava `revoked_at`. Senha: Argon2id m=19456, t=2, p=1. Credencial inválida: 401 `CREDENCIAIS_INVALIDAS`. Sessão ausente, expirada ou revogada: 401 `SESSAO_NECESSARIA`.

CSRF: o cookie guarda o segredo; o JSON traz HMAC-SHA-256 desse segredo (ou do token de sessão) com a mensagem `csrf-v1`. Mutação exige `Origin` exato e `X-CSRF-Token`. Origem ausente, token errado ou origem externa: 403 `CSRF_RECUSADO`. Origens: `http://127.0.0.1:3300` e, se a variável for uma origem sem caminho, `WEB_ORIGIN`. Sem CORS. `trust proxy` desligado. O IP do limite é o da conexão.

Limites na memória de uma instância: login 10/min/IP, mutação 60/min/ator, catálogo 30/min/ator, auditoria 30/min/IP, SSE 3 conexões. As tarefas 4 e 9 chamam `consume("catalog"|"audit")` e `tryAcquireSse` nas rotas que ainda não existem. 429 `LIMITE_EXCEDIDO`.

`POST /api/wallet/deposits` e `POST /api/lots/:id/bids` exigem licitante. `POST /api/lots` e `POST /api/lots/:id/cancel` exigem leiloeiro. Papel errado: 403. Cancelar lote de outro: 404, sem dono no corpo. `userId`/`role` no corpo: 400. Depois da autorização esses quatro caminhos respondem 501 e não gravam. As tarefas 4–6 substituem `authorization.controller.ts` antes de registrar os mesmos caminhos.

O site encaminha `/api` em `front-end/src/app/api/[...path]/route.ts` para `API_PROXY_TARGET` (padrão `http://127.0.0.1:4300`). Só segue `cookie`, `origin`, `content-type`, `accept`, `x-csrf-token` e `idempotency-key`. Não segue `host` nem `X-Forwarded-For`. O cliente usa `credentials: "same-origin"`, CSRF só em mutação, sem `localStorage`/`sessionStorage`. `endSession` faz logout, fecha canais privados, remove queries que não são `public` e então redireciona.
