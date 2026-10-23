# Progresso — Casa de Leilões

Atualizado em 23/10/2026. Tarefa 5 concluída no código e nos testes. As revisões independentes de auth, catálogo e carteira continuam abertas. Tarefa 6 é a próxima.

## Tarefa 5 — concluída no local

- Carteira: `GET /api/wallet` e `POST /api/wallet/deposits`, só licitante e só a própria carteira. Depósito simulado, sem pagamento real.
- Transação única: trava da carteira, lançamento `DEPOSIT`, saldo e registro de idempotência. Falha depois do lançamento não deixa saldo parcial (testado).
- Idempotência comum em `back-end/src/common/idempotency.ts`: mesma chave em paralelo credita uma vez; outra carga na mesma chave dá 409.
- Teto de 999999999999 centavos só por entrada; saldo acumulado passa disso (testado com 1999999999998).
- Reserva e liberação ficam para a Tarefa 6.
- Evidência: `docs/evidence/2026-10-23-tarefa-5.md`.

## Tarefa 4 — concluída no local

- Catálogo do Met: busca v1.1, só leiloeiro, 30/min, 8 por página. HTTPS com hosts exatos, DNS sem rede privada, sem redirect, 5 s por chamada, 10 s por operação, uma nova tentativa com `Retry-After`.
- Imagem: 10 MiB, 20 MP, JPEG/PNG/WebP com assinatura conferida. Arquivo `sha256.ext` em `MEDIA_DIR`, servido por `/api/media/:key`. Limpeza de órfãos é rotina explícita.
- Lotes: publicação idempotente com gênese da auditoria; cancelamento do dono sob `FOR UPDATE`, sem lance e antes do fim; vitrine sem cancelados; detalhe, lances públicos e lista do vendedor.
- Sem `AUDIT_HMAC_KEY` a publicação responde 503 e não grava. A chave não está configurada no dev: Fernando precisa adicioná-la ao arquivo de ambiente local.
- Evidência: `docs/evidence/2026-10-23-tarefa-4.md`.

## Tarefa 3 — concluída no local

- Sessão: Argon2id m=19456, t=2, p=1; token de 256 bits; só o hash no banco; 8 horas absolutas; logout revoga. `@node-rs/argon2` aprovado por Fernando (D15, 23/10 14:21).
- CSRF: HMAC do cookie HttpOnly; `Origin` exato; sem CORS; `trust proxy` desligado.
- Papéis: leiloeiro não deposita nem lança; licitante não cria; lote de outro no cancelamento volta 404. Depósito e lance ainda são stubs.
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

Tarefa 5: `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (62), `npm run build`. Tarefa 4: `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (41), `npm run build`. Tarefa 3: `npm test` (22), `npm run test:integration` (25), `npm run db:validate`. Vitest do front: 7 testes.

`GET /api/health/live` e `GET /api/health/ready` em 127.0.0.1:4300 responderam 200. `GET /api/auth/csrf` pelo site em 3300 respondeu 200; login inválido respondeu 401.

## Pendências

- Adicionar `AUDIT_HMAC_KEY` (hex, 32 bytes ou mais) ao arquivo de ambiente local; opcional `AUDIT_WITNESS_DIR` e `MEDIA_DIR`. Só Fernando edita esse arquivo.
- Revisão independente de SSRF, imagem e publicação.
- Corrida cancelamento × primeiro lance: Tarefa 6.

- Revisão independente de autenticação, limite, cache e proxy.
- Notion README não atualizado: o conector pede autenticação no Cursor desktop.
- Topologia de produção e o diretório real da testemunha não foram escolhidos nem contratados.
- Fsync de diretório no Linux não foi executado.
- SSE pelo proxy não foi medido.
- Tela de entrar e formatação BRL ficam na Tarefa 8.
- E2E e CI do GitHub não foram executados.
