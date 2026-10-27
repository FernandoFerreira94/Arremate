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
| GET /api/me/participations; GET /api/me/awards | Licitante: próprias participações e arremates (Tarefa 7; `me/bids` virou `me/participations`) |
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

`POST /api/wallet/deposits` e `POST /api/lots/:id/bids` exigem licitante. `POST /api/lots` e `POST /api/lots/:id/cancel` exigem leiloeiro. Papel errado: 403. Cancelar lote de outro: 404, sem dono no corpo. `userId`/`role` no corpo: 400. Lance ainda responde 501 depois da autorização e não grava (Tarefa 6). Depósito é real desde a Tarefa 5. Criação e cancelamento de lote são reais desde a Tarefa 4.

O site encaminha `/api` em `front-end/src/app/api/[...path]/route.ts` para `API_PROXY_TARGET` (padrão `http://127.0.0.1:4300`). Só segue `cookie`, `origin`, `content-type`, `accept`, `x-csrf-token` e `idempotency-key`. Não segue `host` nem `X-Forwarded-For`. O cliente usa `credentials: "same-origin"`, CSRF só em mutação, sem `localStorage`/`sessionStorage`. `endSession` faz logout, fecha canais privados, remove queries que não são `public` e então redireciona.

## Carteira (Tarefa 5)

- `GET /api/wallet` — só licitante, só a própria carteira. Responde `{ totalCents, committedCents, availableCents, revision }`, valores em centavos como texto. Sem depósito ainda: tudo `"0"` e revisão 0, sem criar linha.
- `POST /api/wallet/deposits` — só licitante. Corpo `{ "amountCents": "10000" }`, cabeçalho `Idempotency-Key` (UUID). Responde 200 com a carteira atualizada.
  - Valor: inteiro positivo em texto, até `999999999999` por entrada. O saldo acumulado pode passar disso. Inválido: 400 `VALOR_INVALIDO`.
  - Mesma chave e mesmo valor: devolve a resposta gravada, sem creditar de novo, inclusive em chamadas simultâneas. Mesma chave com outro valor: 409 `IDEMPOTENCIA_CONFLITO`.
  - Capacidade física da coluna (38 dígitos) estourada: 409 `CAPACIDADE_EXCEDIDA`.
  - `userId` no corpo: 400. Leiloeiro: 403. Sem sessão: 401.
- Atomicidade: trava a carteira (`FOR UPDATE`), grava o lançamento `DEPOSIT` com referência única, atualiza o saldo e grava o registro de idempotência na mesma transação. Falha em qualquer passo desfaz tudo.
- Auxiliar comum: `back-end/src/common/idempotency.ts` (`withIdempotency`) com trava consultiva por escopo; resposta gravada até 32 KiB.

## Catálogo e lotes (Tarefa 4)

Fonte: The Met Collection API. Busca `GET https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=&hasImages=true&offset=&limit=8` (a busca v1 foi aposentada em 01/10/2026). Objeto: `/public/collection/v1/objects/{id}`. Imagem: `primaryImageSmall` em `images.metmuseum.org`.

Chamadas externas: só HTTPS, hosts exatos `collectionapi.metmuseum.org` e `images.metmuseum.org`, sem porta e sem credencial na URL. O DNS não pode resolver para rede privada, loopback, link-local ou multicast. Redirecionamento é recusado (`redirect: "manual"`). Timeout de 5 s por chamada e orçamento de 10 s por operação. No máximo uma nova tentativa em falha de rede, 429, 502, 503 ou 504, respeitando `Retry-After` se couber no orçamento. JSON até 1 MiB, com esquema validado campo a campo.

Imagem: até 10 MiB e 20 MP; JPEG, PNG ou WebP, com `Content-Type` e assinatura coerentes e dimensões lidas do cabeçalho. SVG e HTML são recusados. O arquivo vai para `MEDIA_DIR` com nome `sha256.ext` gerado pelo servidor, gravado em arquivo temporário e depois `rename`. `GET /api/media/:key` só aceita esse formato e responde com `nosniff` e cache imutável. `CatalogService.removeOrphanMedia(idade, agora)` apaga arquivos sem snapshot e mais velhos que a idade; não roda sozinho.

Snapshot: `(provider, external_id)` único, com `ON CONFLICT DO NOTHING`. Importar de novo não chama o provedor. Só entra obra com `isPublicDomain = true`; a licença é gravada como "Domínio público (The Met Open Access, CC0)". Título e demais campos ficam como texto puro e saem em JSON.

| Rota | Acesso | Resposta |
| --- | --- | --- |
| `GET /api/catalog/search?q=&page=` | Leiloeiro, 30/min | `{ items, page, pageSize: 8, total, hasMore }`; item com `externalId`, `title`, `artist`, `date`, `medium`, `credit`, `sourceUrl`, `thumbnailUrl`, `importable`, `reason` (`LICENCA_RECUSADA` ou `SEM_IMAGEM`) |
| `GET /api/catalog/items/:externalId` | Leiloeiro, 30/min | O mesmo item |
| `POST /api/lots` | Leiloeiro, `Idempotency-Key` UUID | 201 `LotView` |
| `POST /api/lots/:id/cancel` | Leiloeiro dono | 200 `LotView` |
| `GET /api/lots?page=&q=&state=` | Público | 8 por página, sem cancelados; ao vivo, depois agendados, depois encerrados. `state` (`live`, `scheduled`, `ended`, `ending`) filtra a aba no SQL; `counts` traz o total de cada aba sobre a busca inteira |
| `GET /api/lots/:id` | Público | `LotView`, inclusive cancelado |
| `GET /api/lots/:id/bids?page=&limit=` | Público | `{ alias, amountCents, sequence, acceptedAt }` |
| `GET /api/seller/lots?page=&limit=` | Leiloeiro | Os próprios lotes, inclusive cancelados |
| `GET /api/media/:key` | Público | A imagem |

Corpo de `POST /api/lots`: só `externalId`, `initialCents`, `incrementCents`, `startsAt` e `endsAt` (ISO 8601). Outro campo: 400 `REQUISICAO_INVALIDA`. Valores em texto de centavos, maiores que zero e até `999999999999`; senão 400 `VALOR_INVALIDO`. Início até 60 s no passado pelo relógio do banco e fim depois do início; senão 400 `DATAS_INVALIDAS`. A mesma chave com o mesmo corpo devolve o mesmo lote; com outro corpo, 409 `IDEMPOTENCIA_CONFLITO`. Chave ausente ou inválida: 400 `IDEMPOTENCIA_INVALIDA`.

```ts
type LotView = {
  id: string; externalId: string; title: string; artist: string; date: string; medium: string; dimensions: string;
  credit: string; license: string; sourceUrl: string | null; imageUrl: string; // /api/media/<sha256>.<ext>
  initialCents: string; incrementCents: string; currentCents: string | null; minimumNextCents: string; bidCount: number;
  startsAt: string; endsAt: string; state: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED"; settlementPending: boolean; serverNow: string;
};
```

O estado vem de `clock_timestamp()` do banco. `LotView` não traz o dono.

Publicação: snapshot e imagem primeiro; depois uma transação grava lote e registro de idempotência; depois a gênese da auditoria. Se a gênese falhar, lote e registro são apagados e a resposta é 503 `AUDITORIA_INDISPONIVEL`. Sem `AUDIT_HMAC_KEY` a API não publica (503) e não grava nada.

Cancelamento: `SELECT ... FOR UPDATE` no lote. Outro dono ou lote inexistente: 404. Já cancelado, liquidado ou encerrado: 409 `LOTE_NAO_CANCELAVEL`. Com lance: 409 `LOTE_COM_LANCES`. Só muda `status`; `revision` fica igual e a auditoria continua íntegra. A corrida com o primeiro lance fecha na Tarefa 6, que usa o mesmo lock.

Erros do provedor: 503 `PROVEDOR_INDISPONIVEL`, 502 `PROVEDOR_RESPOSTA_INVALIDA` ou `ORIGEM_RECUSADA`, 422 `LICENCA_RECUSADA` ou `IMAGEM_INVALIDA`, 404 `OBRA_NAO_ENCONTRADA`.

## Liquidação e comprovante (Tarefa 7)

- Runner a cada 1 s e no startup; sem auditoria configurada não liquida. Resultado em `LotView.result`: `OPEN`, `CLOSED_PENDING`, `SETTLED`, `CLOSED_NO_BIDS`, `CANCELLED`.
- `GET /api/receipts/:token` → `PublicReceipt { code, simulated, valid, lotId, artwork { externalId, title, artist, credit, license, imageUrl }, winnerAlias, sellerAlias, amountCents, startsAt, endsAt, settledAt, audit { status, verifiedAt, message } }`. `valid` só com auditoria `INTACT`. Token `[A-Za-z0-9_-]{32}` (192 bits); outro formato ou inexistente → 404 `NAO_ENCONTRADO`. O token localiza o documento, não autentica.
- `GET /api/me/participations?page=` → `{ items: [{ lotId, title, imageUrl, endsAt, myTopCents, currentCents, outcome, receiptToken }], page, pageSize: 20, total }`; `outcome`: `LEADING`, `OUTBID`, `PENDING`, `WON`, `LOST`, `CANCELLED`. `WON` só depois de liquidado.
- `GET /api/me/awards?page=` → `{ items: [{ lotId, title, imageUrl, amountCents, settledAt, receiptToken }] , ... }`.
- `GET /api/seller/summary` → `{ settledCreditCents, settled, closedNoBids, open, pending, cancelled }`; soma só créditos liquidados.
