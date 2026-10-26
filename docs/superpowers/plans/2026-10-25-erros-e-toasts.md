# Plano — Aviso de erro simulado, auditoria de mensagens e toasts (Sonner)

Data: 25/10/2026 · Status: **PLANO — não implementar até o Fernando chegar em casa e liberar.**

## Fonte e limites desta auditoria
- O código lido foi o bundle `/workspace/arremate.bundle` (branch `chore/bootstrap`, commit `f12c326`, de 23/10/2026 21:30 BRT). `/workspace/casa-de-leilao` no box só tem `docs/`.
- Esse código é **anterior** ao merge `690746d`. Por isso não há código de notificações, watches, favoritos, cadastro, Google OAuth, cartão, `/wallet/entries`, `/lots/next` nem `/lots/upcoming` para ler. Esses itens estão marcados como **NÃO VERIFICADO** e precisam ser conferidos no PC antes da Task B1.
- Regras: nada de Prettier em arquivo inteiro (conferir com `git diff`), nenhuma migration nova, nenhuma dependência sem OK, commit local com `git commit -F`, sem push.

## Gates (bloqueiam partes do plano)
| Gate | O que bloqueia | Quem libera |
|---|---|---|
| G1 — OK para instalar `sonner` (componente shadcn) | Parte 3 inteira | Fernando, com as palavras dele |
| G2 — Prancha do toast do Fred (variações success, error, info, loading, com requestId, mobile 390 px, dark/light, posição) | Tasks C2 em diante | Fred entrega, Fernando aprova |
| G3 — Conferir no PC os endpoints pós-merge | Fechar a tabela da Parte 2 | Executor, no PC |

As Partes 1 e 2 **não dependem** de G1 nem de G2.

---

## Parte 1 — Aviso de erro simulado no estilo do Sentry

### Desenho
```
Back: HttpErrorFilter (global, já existe) ──► ErrorReporter.capture(evento)
Front: app/error.tsx + app/global-error.tsx + window.onerror + unhandledrejection
       ──► POST /api/client-errors (sem sessão obrigatória, rate-limited) ──► ErrorReporter
ErrorReporter ─► sanitiza ─► deduplica (fingerprint) ─► rate-limit ─► ErrorTransport
ErrorTransport (interface):
  - LogTransport (padrão, ATIVO): só Logger.warn com JSON do evento
  - SentryTransport / WebhookTransport: stubs documentados, NÃO ligados
Escolha por env `ERROR_TRANSPORT=log|webhook|sentry` (padrão `log`). Não é preciso criar secret agora; só documentar o nome.
```

### Evento (contrato)
```ts
type ErrorEvent = {
  id: string;              // uuid
  fingerprint: string;     // sha256(origem + nome + mensagem normalizada + 1ª linha útil da stack)
  source: "api" | "web";
  level: "error" | "warning";
  name: string; message: string; stack?: string;   // stack truncada em 4 KB
  route: string;           // ex.: "POST /lots/:id/bids" (template, nunca a URL com query)
  statusCode?: number; code?: string;
  requestId?: string;
  user?: { id: string; role: string };  // só id e papel, nunca e-mail ou nome
  release?: string; environment: string; timestamp: string;
  count: number;           // ocorrências agregadas na janela de dedupe
};
```

### Sanitização (sem dados sensíveis)
- Nunca enviar body, cookies, headers `authorization`/`cookie`/`x-csrf-token`, query string, valores de `.env`.
- Redigir na mensagem e na stack: e-mails, sequências de 13–19 dígitos (cartão), tokens hex/base64 longos, tokens de comprovante, `password`/`senha`.
- Capturar só 5xx e erros não-HttpException. 4xx de regra de negócio (ex.: `BID_BELOW_MINIMUM`) **não** viram alerta; só contam em métrica de log.

### Deduplicação e rate-limit
- Dedupe: mapa em memória `fingerprint → {primeiraVez, count}` com janela de 60 s. Dentro da janela, só incrementa `count`. Ao fechar a janela, envia um único resumo se `count > 1`.
- Rate-limit global: no máximo 30 eventos/min no transporte (token bucket). O excesso é descartado com um único aviso "N eventos descartados".
- Front: no máximo 5 eventos por aba a cada 60 s, dedupe por fingerprint no `sessionStorage`. O endpoint `/api/client-errors` usa o `RateLimiter` que já existe (chave por IP ou userId), corpo limitado a 8 KB e DTO validado.

### Tasks
**A1 — Contrato e sanitizador (back).** Criar `back-end/src/observability/error-event.ts` e `sanitize.ts`.
- Testes unitários: um e-mail, um cartão 4242…, um token e um campo `password` saem redigidos, e a stack sai truncada.

**A2 — ErrorReporter + dedupe + rate-limit.** Criar `error-reporter.service.ts` com relógio injetável.
- Testes: 10 erros iguais em 60 s geram 1 envio com `count=10`; 2 fingerprints geram 2 envios; o 31º evento no minuto é descartado; ao fechar a janela sai o resumo.

**A3 — Transportes.** Interface `ErrorTransport`, `LogTransport` ativo, e `WebhookTransport`/`SentryTransport` como stubs que lançam "não configurado" e não são registrados. O módulo escolhe pelo env.
- Testes: o padrão é `LogTransport`; com valor desconhecido também cai em `log`; uma falha do transporte nunca derruba a requisição.
- Documentar em `docs/` como o ponto de troca, sem instalar `@sentry/node` (seria dependência nova e precisa de OK).

**A4 — Ligar no HttpErrorFilter.** Alterar só o trecho do `catch` em `common/http-error.filter.ts`: em 5xx (exceto 503 esperado) e erro não-Http, chamar `reporter.capture` com rota-template, requestId e actor (id/role). A resposta ao cliente **não muda**.
- Testes de integração: uma rota de teste que lança `Error` responde 500 `ERRO_INTERNO` com o mesmo corpo de hoje e o `LogTransport` recebe 1 evento com requestId; um 409 de regra não gera evento.
- Também: `process.on("unhandledRejection"/"uncaughtException")` no `main.ts` reporta e registra no log, sem mudar o comportamento de saída.

**A5 — Endpoint `POST /client-errors`.** Público e com CSRF? Como a página de erro pode estar sem sessão, usar só o check de Origin, mais o rate-limit e o limite de 8 KB. Responde 202 sem corpo.
- Testes: 202 com payload válido; 400 com payload inválido; 413 acima de 8 KB; 429 acima do limite; 403 com Origin estranha.

**A6 — Front: captura.** `src/lib/error-reporter.ts` (sanitiza, dedupe no sessionStorage, `navigator.sendBeacon` com fallback `fetch keepalive`), `src/components/app/error-listeners.tsx` (client, registra `window.onerror` e `unhandledrejection` no layout), `src/app/error.tsx` e `src/app/global-error.tsx` (UI de erro em pt-BR, botão "Tentar de novo" e `requestId`/`digest` para suporte). `ApiError` 4xx **não** é reportado.
- Testes vitest: um `throw` dispara 1 envio; 2 iguais disparam 1; o 6º em 60 s é bloqueado; a URL vai sem query. Teste E2E: rota de teste que lança mostra a tela de erro e a API recebe 202.
- A UI de `error.tsx`/`global-error.tsx` é componente novo, **por isso precisa de prancha do Fred** (G2b, separado do toast).

---

## Parte 2 — Auditoria das mensagens de sucesso e erro do back

### Como funciona hoje (verificado no código)
- Erros: o `HttpErrorFilter` global responde sempre `{ statusCode, code, message (pt-BR), requestId }`. A mensagem vem de um mapa fixo `codes` e, se o código ou o status não bate, cai num fallback genérico por status. **Isso já está bom e padronizado.**
- Sucesso: **nenhum endpoint devolve mensagem**. Devolve só o recurso (ex.: `WalletView`, `LotView`) ou 204 sem corpo. O front teria que inventar o texto do toast.

### Tabela (código de 23/10, commit f12c326)
| # | Método | Rota | Sucesso hoje | Erros (code → HTTP) | Lacuna |
|---|---|---|---|---|---|
| 1 | GET | /auth/csrf | `{csrfToken}` 200 | LIMITE_EXCEDIDO 429 | — |
| 2 | POST | /auth/login | `PublicSession` 200, sem message | REQUISICAO_INVALIDA 400, CREDENCIAIS_INVALIDAS 401, CSRF_RECUSADO 403, LIMITE_EXCEDIDO 429, BANCO_INDISPONIVEL 503 | **sem mensagem de sucesso** |
| 3 | POST | /auth/logout | 204 sem corpo | SESSAO_NECESSARIA 401, CSRF_RECUSADO 403 | **sem mensagem de sucesso (204)** |
| 4 | GET | /auth/me | `{role}` 200 | SESSAO_NECESSARIA 401 (lançado com `HttpException` cru, não `ApiException`; o resultado é o mesmo) | inconsistência menor. No PC a resposta é `{role,userId,name}`: NÃO VERIFICADO aqui |
| 5 | GET | /catalog/search | `CatalogPage` | REQUISICAO_INVALIDA 400, SESSAO_NECESSARIA 401, ACESSO_NEGADO 403, LIMITE_EXCEDIDO 429, PROVEDOR_* 502/503 | — |
| 6 | GET | /catalog/items/:externalId | `CatalogItemView` | REQUISICAO_INVALIDA 400, OBRA_NAO_ENCONTRADA 404, LICENCA_RECUSADA/IMAGEM_INVALIDA 422, ORIGEM_RECUSADA/PROVEDOR_RESPOSTA_INVALIDA 502, PROVEDOR_INDISPONIVEL 503, 401/403/429 | — |
| 7 | GET | /media/:key | arquivo (stream) | NAO_ENCONTRADO 404 | erro de stream depois dos headers não é tratado nem reportado (cai na Parte 1) |
| 8 | GET | /health/live | `{status:"ok"}` | — | — |
| 9 | GET | /health/ready | `{status,database}` | 503 → BANCO_INDISPONIVEL | — |
| 10 | GET | /events?lotId= (SSE) | stream | NAO_ENCONTRADO 404, LIMITE_CONEXOES 429 | **`LIMITE_CONEXOES` não está no mapa `codes`** e cai no genérico "Muitas tentativas" |
| 11 | GET | /lots | página | 400 (validação) | — |
| 12 | GET | /lots/:id | `LotView` | NAO_ENCONTRADO 404 | — |
| 13 | GET | /lots/:id/audit | auditoria | NAO_ENCONTRADO 404 | — |
| 14 | GET | /lots/:id/bids | página | NAO_ENCONTRADO 404, 400 | — |
| 15 | GET | /seller/lots | página | 401, ACESSO_NEGADO 403 | — |
| 16 | GET | /seller/summary | resumo | 401, 403, AUDITORIA_INDISPONIVEL 503 (NÃO VERIFICADO se ocorre aqui) | — |
| 17 | GET | /me/participations | página | 401, 403 | — |
| 18 | GET | /me/awards | página | 401, 403 | — |
| 19 | POST | /lots | `LotView` 201, sem message | IDEMPOTENCIA_INVALIDA 400, VALOR_INVALIDO 400, DATAS_INVALIDAS 400, 401, 403, CSRF 403, IDEMPOTENCIA_CONFLITO 409, OBRA_*/LICENCA (via catálogo, NÃO VERIFICADO), AUDITORIA_INDISPONIVEL 503 | **sem mensagem de sucesso** |
| 20 | POST | /lots/:id/bids | lance aceito 201, sem message | VALOR_INVALIDO 400, NAO_ENCONTRADO 404, BID_BELOW_MINIMUM / INSUFFICIENT_FUNDS / ALREADY_LEADING / LOT_NOT_STARTED / LOT_ENDED / LOT_CANCELLED / LOTE_BLOQUEADO / IDEMPOTENCIA_CONFLITO 409, CONFIRMATION_PENDING / AUDITORIA_INDISPONIVEL 503, 401/403/429 | **sem mensagem de sucesso**; códigos em inglês misturados com pt-BR (só o `code`; a `message` já é pt-BR) |
| 21 | POST | /lots/:id/cancel | `LotView` 200, sem message | NAO_ENCONTRADO 404, LOTE_NAO_CANCELAVEL 409, LOTE_COM_LANCES 409, 401/403 | **sem mensagem de sucesso** |
| 22 | GET | /receipts/:token | comprovante | NAO_ENCONTRADO 404 | — |
| 23 | GET | /wallet | `WalletView` | 401, 403 | — |
| 24 | POST | /wallet/deposits | `WalletView` 200, sem message | VALOR_INVALIDO 400, IDEMPOTENCIA_INVALIDA 400, CAPACIDADE_EXCEDIDA 409, IDEMPOTENCIA_CONFLITO 409, 401/403/429 | **sem mensagem de sucesso** |

**Endpoints pós-merge — todos NÃO VERIFICADO (G3):** `POST /auth/register`, `GET /auth/google` e o callback, `GET /lots/next`, `GET /lots/upcoming?limit=5`, os de watch (POST/DELETE), notificações (lista e marcar como lida), favoritos (POST/DELETE), cartão (salvar/remover), depósito Pix e cartão, `GET /wallet/entries`. É preciso preencher a mesma tabela no PC. A expectativa, sem confirmação, é que as mutações também não tenham mensagem de sucesso.

**Resultado (código verificado):** 7 de 24 endpoints com lacuna: 6 mutações sem mensagem de sucesso (#2, 3, 19, 20, 21, 24) e o #10 com código fora do mapa. Há também 2 inconsistências menores, que não entram na contagem (#4 `HttpException` cru e #7 erro de stream).

### Formato padrão proposto
- **Erro (mantém o atual):** `{ statusCode, code, message, requestId, details? }`. A `message` é sempre pt-BR e vem do mapa `codes`, que passa para `common/messages.ts` com tipagem.
- **Sucesso em mutação:** `{ message: string, data: T }`, com `message` em pt-BR. Exemplos: "Login realizado.", "Você saiu da conta.", "Lote publicado.", "Lance de R$ X registrado.", "Lote cancelado.", "Depósito de R$ X adicionado à carteira.".
- **GETs não mudam** (sem envelope), para não quebrar o front nem os E2E.
- O logout passa de 204 para 200 `{ message }`. É mudança de contrato, então os testes que esperam 204 mudam junto.
- **Opção de menor risco (recomendada):** em vez do envelope `data`, adicionar só `message` ao objeto que já é devolvido (`{ ...view, message }`). Assim o front atual continua lendo os mesmos campos. A decisão é do Fernando, a registrar como D-próximo em `decisoes.md`.

### Tasks
**B0 — G3 no PC:** rodar `rg "@(Get|Post|Put|Patch|Delete)\(" back-end/src` e completar a tabela com os endpoints pós-merge. Só leitura.

**B1 — Centralizar mensagens:** mover `codes` para `common/messages.ts` (`ERROR_MESSAGES` e `SUCCESS_MESSAGES`), incluir `LIMITE_CONEXOES` (429, "Muitas pessoas acompanhando este lote agora. Tente em instantes.") e trocar o `HttpException` de `/auth/me` por `ApiException`. Editar só os trechos e conferir no `git diff`.
- Testes: unitário que garante que todo `ApiException(code)` usado em `src/` existe no mapa com o mesmo status (varredura com rg ou AST no teste), e integração em que `/events` acima do limite responde `LIMITE_CONEXOES`.

**B2 — Mensagem de sucesso nas mutações** (helper `withMessage(view, key, vars)`), uma task por módulo:
- B2a auth (login, logout, register*), B2b lots (create, cancel), B2c bids, B2d wallet (deposits Pix/cartão*), B2e watches, favoritos, notificações e cartão*. O * indica NÃO VERIFICADO.
- Testes: integração por endpoint verificando o status e `message` igual ao texto esperado; os E2E que já existem continuam verdes; o replay idempotente devolve a mesma `message`.

**B3 — Documentar** a tabela final em `docs/` e passar a lista ao front. É o que liga ao item 3.

---

## Parte 3 — Toast do shadcn (Sonner) em todas as ações

> **Gates:** G1 (OK para a dependência `sonner`) e G2 (prancha do Fred). Até lá, só as tasks C0 e C1a podem ser preparadas.

### Ligação com a Parte 2
- Um helper único `src/lib/notify.ts`:
  - `notifySuccess(res)` → `toast.success(res.message ?? fallbackLocal)`
  - `notifyError(err)` → se for `ApiError`, `toast.error(err.message, { description: "Código para suporte: " + requestId })`; senão, "Não foi possível concluir a operação." e reporta ao ErrorReporter (Parte 1).
  - `notifyPromise(promise, {loading})` para ações lentas (publicar lote, depósito).
- `ApiError` 401 `SESSAO_NECESSARIA` mostra toast e redireciona para `/entrar`.
- `CONFIRMATION_PENDING` (503) usa toast de aviso, não de erro, com o texto "repita com a mesma chave".

### Ações por tela (código de 23/10; o pós-merge é NÃO VERIFICADO)
| Tela | Ação | Sucesso | Erro |
|---|---|---|---|
| /entrar (`login-form.tsx`) | Entrar | "Login realizado." | message da API (credenciais, limite, CSRF) |
| /entrar | Cadastro*, Google* (desabilitado na demo: toast info "indisponível na demo") | — | — |
| Header/menu | Sair (`auth-api.logout`) | "Você saiu da conta." | message |
| /lotes/[id] (`lot-room-page.tsx`) | Dar lance (após confirmar) | "Lance registrado." | os 8 códigos de lance |
| /lotes/[id] | Acompanhar/avisar-me (watch)*, Favoritar* | "Vamos te avisar…" | message |
| /lotes/[id] | Conexão SSE perdida/reconectada | info discreta | LIMITE_CONEXOES |
| /carteira (`wallet-page.tsx`) | Depositar Pix / cartão*, salvar cartão* | "Depósito adicionado." | VALOR_INVALIDO, CAPACIDADE_EXCEDIDA… |
| /painel/lotes | Cancelar lote | "Lote cancelado." | LOTE_COM_LANCES, LOTE_NAO_CANCELAVEL |
| /painel/lotes/novo (`new-lot-page.tsx`) | Publicar lote (promise) | "Lote publicado." | DATAS_INVALIDAS, catálogo 4xx/5xx |
| /painel/lotes/novo | Buscar/selecionar obra | — (só erro) | PROVEDOR_*, LIMITE_EXCEDIDO |
| Global | Notificação nova (hoje `components/app/toast.tsx`)* | toast info com link | — |
| Global | Erro inesperado (Parte 1) | — | toast genérico + requestId |
| /comprovantes/[token] | Copiar link/código | "Copiado." | "Não foi possível copiar." |

### Substituição de `components/app/toast.tsx` (NÃO VERIFICADO: o arquivo só existe pós-merge)
1. Mapear os usos com `rg "components/app/toast"`.
2. Trocar a chamada por `toast(...)` do Sonner, mantendo a duração de 8 s só nas notificações e 4 s no resto (confirmar na prancha).
3. Remover o arquivo e os testes dele só depois de os E2E de notificação passarem com o Sonner.

### Tasks
**C0 — Pedir a prancha ao Fred** (G2): success, error com requestId, warning, loading/promise, notificação com link, empilhamento de 3, mobile 390 e desktop 1440, cores do tema bordô `--primary`, `aria-live`.
- Teste: nenhum (gate).

**C1a — `notify.ts` com interface pura** (sem Sonner, só a assinatura e o mapeamento de `ApiError` para o texto).
- Testes vitest: o mapeamento de cada código, o fallback e o 401 que redireciona.

**C1b — [G1] Instalar via `npx shadcn add sonner`** e colocar o `<Toaster/>` no layout. Revisar o `package-lock` no diff.
- Teste: build ok e snapshot do layout.

**C2 — [G2] Estilizar o Toaster** conforme a prancha.
- Teste: Playwright visual em 390 e 1440 mais checagem de a11y (role=status/alert).

**C3..C8 — Uma task por tela da tabela acima** (entrar, header, sala do lote, carteira, painel, novo lote).
- Testes E2E por tela: o caminho feliz mostra o toast de sucesso com o texto da API, e um caso de erro forçado (ex.: lance abaixo do mínimo, depósito de 0) mostra o toast de erro. Rodar com `workers=1`.

**C9 — Substituir `components/app/toast.tsx`.**
- Testes: os E2E de notificação continuam verdes e `rg` confirma que não sobrou nenhum uso.

**C10 — Ligar `notifyError` ao ErrorReporter** (só para erros não-ApiError).
- Teste vitest: um erro inesperado gera toast e 1 report.

## Ordem sugerida
B0 → A1–A5 → B1 → B2 → B3 → A6 (UI após G2b) → C0/C1a → [G1] C1b → [G2] C2–C10. Cada task fecha com os testes dela verdes, `git diff` revisado e commit local.
