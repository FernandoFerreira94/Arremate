# Mensagens da API (D25)

Auditoria B0 em 26/10/2026, sobre os 43 endpoints existentes. Formato aprovado: as mutações só **acrescentam** `message` (pt-BR) ao que já devolviam; erros seguem `{ statusCode, code, message, requestId }`. Textos centralizados em `back-end/src/common/messages.ts`.

## Corrigidos (15)

| Endpoint | Antes | Agora |
|---|---|---|
| `POST /api/auth/login` | sem `message` | "Login realizado." |
| `POST /api/auth/register` | sem `message` | "Conta criada." |
| `GET /api/auth/me` | 401 fora do `ApiException` | `SESSAO_NECESSARIA` padronizado |
| `PUT /api/lots/:id/favorite` | sem `message` | "Adicionado aos favoritos." |
| `DELETE /api/lots/:id/favorite` | sem `message` | "Removido dos favoritos." (front oferece Desfazer pelo PUT idempotente) |
| `PUT /api/lots/:id/watch` | sem `message`; 409 caía em `ERRO_INTERNO` | "Vamos avisar quando o lote abrir."; 409 `LOTE_JA_ABERTO` |
| `DELETE /api/lots/:id/watch` | sem `message` | "Aviso desativado." |
| `POST /api/me/notifications/read-all` | sem `message` | texto de notificações lidas |
| `POST /api/me/notifications/:id/read` | sem `message` | texto de notificação lida |
| `POST /api/lots` | sem `message` | lote publicado |
| `POST /api/lots/:id/bids` | sem `message` | "Lance de R$ X registrado." |
| `POST /api/lots/:id/cancel` | sem `message` | lote cancelado |
| `GET /api/lots/:id/events` | 429 sem código mapeado | `LIMITE_CONEXOES` |
| `POST /api/wallet/cards` | sem `message` | "Cartão de teste salvo." |
| `POST /api/wallet/deposits` | sem `message` | "Depósito de R$ X adicionado à carteira." |

## Mantidos

- `POST /api/auth/logout` e `DELETE /api/wallet/cards/:id` seguem 204 sem corpo (o formato aprovado só acrescenta); o front usa texto local ("Você saiu da conta.", "Cartão removido.").
- Leituras (GET) e o fluxo Google não mudaram.

## Novo

- `POST /api/client-errors` → 202. Origem permitida (403), até 8 KB (413), 20/min por IP (429), corpo validado (400). Isento de CSRF; o `ErrorReporter` só registra em log (sanitizado, dedupe de 60 s, 30/min).
