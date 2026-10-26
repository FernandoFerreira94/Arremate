# Progresso — Casa de Leilões

Atualizado em 23/10/2026. Tarefa 8 concluída no local (telas privadas e entrar). As revisões independentes de auth, catálogo, carteira, lance, liquidação e componentes continuam abertas. Tarefa 9 concluída no local. Tarefa 10 (parte local) concluída; deploy aguarda OK, contas e segredos do Fernando.

## Tarefa 10 — parte local concluída

- Commits `b68ca12` (seed, 413, carga) e `fe3c17f` (CI).
- Seed idempotente com 1 leiloeiro + 2 licitantes fictícios, obra 437329 e 1 lote aberto; rodado no dev 5462.
- Carga: 20 licitantes × 5 rodadas + carteira em dois lotes, p95 237 ms, invariantes ok.
- Segurança: headers, SQL/JSON/página/sem sessão ok; corpo grande era 500, agora 413.
- Testes: unit 59, integração 96, Vitest 49, E2E 16.
- Pendente: decisão do multer (High), fornecedor/contas/segredos, push, CI real, deploy, backup/restore, review independente.
- Evidência: `docs/evidence/2026-10-23-tarefa-10.md`.

## Tarefa 9 — concluída no local

- API: SSE `GET /api/events?lotId=` e `GET /api/lots/:id/audit`; eventos após lance, cancelamento e encerramento.
- Telas: `/`, `/lotes/:id`, `/lotes/:id/auditoria`, `/comprovantes/:token`, 404 real, OG/ícones/robots.
- Testes: unit 57, integração 91, Vitest 49, E2E 16 (inclui `live-bidding` 2 e `provider-outage` 1 com lotes reais).
- `DESIGN.md` criado; `.design-system/` não.
- Evidência: `docs/evidence/2026-10-23-tarefa-9.md`.

## Tarefa 8 — concluída no local

- Design system: componentes shadcn escritos sobre `radix-ui` (D16), tokens do HANDOFF §2, só tema claro (D08), Fraunces + Inter.
- Telas: `/entrar`, `/carteira`, `/painel/lotes`, `/painel/lotes/novo`, `/meus-arremates`; header por papel, menu móvel (folha), estados de carregando/vazio/erro/acesso negado.
- Dinheiro em BigInt sem float, horário BRT → UTC, depósito/publicação com uma `Idempotency-Key` por intenção.
- Testes: Vitest do front 36; E2E 5 (incluindo `private-journeys` 3).
- Limitações: sem tabela de movimentações (sem API); header sem apelido; publicação real NÃO VERIFICADA sem `AUDIT_HMAC_KEY`; links para `/lotes/:id` e comprovantes dão 404 até a Tarefa 9; `DESIGN.md`/`.design-system/` e screenshots pendentes.
- Evidência: `docs/evidence/2026-10-23-tarefa-8.md`.

## Tarefa 7 — concluída no local

- Liquidação: runner a cada 1 s e varredura no startup; lote → carteiras em ordem de ID → relógio do banco; débito do vencedor, crédito do vendedor, ledger, settlement e recibo numa transação; vínculo selado na testemunha.
- Lote não íntegro ou com confirmação pendente não liquida. Falha da testemunha depois do commit deixa INDETERMINATE até `retryCheckpoint`, sem duplicar.
- Comprovante público `GET /api/receipts/:token` (token de 192 bits), validado pela auditoria a cada leitura; sem PII.
- Listas: `GET /api/me/participations`, `GET /api/me/awards`, `GET /api/seller/summary`. `LotView.result` distingue CLOSED_PENDING, SETTLED e CLOSED_NO_BIDS.
- Evidência: `docs/evidence/2026-10-23-tarefa-7.md`.

## Tarefa 6 — concluída no local

- Lance: `POST /api/lots/:id/bids`, só licitante, `Idempotency-Key` obrigatório. Resposta pública sem ID de usuário.
- Transação única: lote `FOR UPDATE`, carteiras em ordem de ID, relógio do banco, decisão pura, lance + revisão + prazo + `RELEASE`/`RESERVE` + idempotência; testemunha avança depois do commit (falha → 503 `CONFIRMATION_PENDING`, lote bloqueado até `retryCheckpoint`).
- Anti-sniping: menos de 120 s restantes → fim = aceite + 120 s.
- Corridas testadas 20 vezes; invariantes de reserva/ledger/auditoria conferidas.
- Stub 501 de lance da Tarefa 3 removido. Teste intermitente de `lots` com folga de 5 s no início (causa NÃO VERIFICADO).
- Evidência: `docs/evidence/2026-10-23-tarefa-6.md`.

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

Tarefa 9: `npm run lint`, `npm run typecheck`, `npm test` (57), `npm run test:integration` (91), `npm run build`, Vitest do front (49), `npx playwright test` (16). Tarefa 8: `npm run lint`, `npm run typecheck`, `npm test` (53), `npm run test:integration` (88), `npm run build`, Vitest do front (36), `npx playwright test` (5). Tarefa 7: `npm run lint`, `npm run typecheck`, `npm test` (53), `npm run test:integration` (88), `npm run build`. Tarefa 6: `npm run lint`, `npm run typecheck`, `npm test` (51), `npm run test:integration` (74), `npm run build`. Tarefa 5: `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (62), `npm run build`. Tarefa 4: `npm run lint`, `npm run typecheck`, `npm test` (43), `npm run test:integration` (41), `npm run build`. Tarefa 3: `npm test` (22), `npm run test:integration` (25), `npm run db:validate`. Vitest do front: 7 testes.

`GET /api/health/live` e `GET /api/health/ready` em 127.0.0.1:4300 responderam 200. `GET /api/auth/csrf` pelo site em 3300 respondeu 200; login inválido respondeu 401.

## Pendências

- Adicionar `AUDIT_HMAC_KEY` (hex, 32 bytes ou mais) ao arquivo de ambiente local; opcional `AUDIT_WITNESS_DIR` e `MEDIA_DIR`. Só Fernando edita esse arquivo.
- Revisão independente de SSRF, imagem e publicação.

- Revisão independente de autenticação, limite, cache e proxy.
- Notion README não atualizado: o conector pede autenticação no Cursor desktop.
- Topologia de produção e o diretório real da testemunha não foram escolhidos nem contratados.
- Fsync de diretório no Linux não foi executado.
- SSE pelo proxy não foi medido.
- CI do GitHub não foi executado (E2E local verde na Tarefa 8).

- 24/10: D18 conteúdo de demonstração implementado só local (seed de 24 obras, estimativa e laudo simulados). Evidência: docs/evidence/2026-10-24-conteudo-demo.md.

## Auth/pagamentos — preparação independente das pranchas (24/10/2026)

- D20: Supabase somente PostgreSQL; Prisma CLI prefere DIRECT_URL, com fallback local DATABASE_URL; runtime permanece separado.
- Etapa 7 preparada localmente: variável de exemplo vazia e guia de Session pooler/TLS/roles/Data API. Validação e revisão em docs/evidence/2026-10-24-auth-pagamentos.md.
- Etapas 1–6 (faixa/imagens/estados, cadastro, Pix, histórico/extrato, cartão, Google) continuam pendentes. Novas pranchas com Fred.
- Nenhum banco hospedado acessado/migrado/semeado; sem deploy/push. Projeto/credenciais/validação Supabase e OK para migration/seed/deploy dependem de Fernando.


## Auth/pagamentos — etapa 1 (D21, 24/10/2026)

- Implementados faixa A7, rodapé e páginas Termos/Privacidade/Como funciona; next/image em8usos/7arquivos, fallback e origens restritas; loading/error em12segmentos;404 locais e OG por lote. Fonte Fraunces oficial/OFL, mantendo next/font.
- Evidência e gates reais: docs/evidence/2026-10-24-auth-pagamentos.md. Plano específico: 2026-10-24-auth-pagamentos-etapa-1.md. Sem declarar etapas2–6 concluídas.
- Supabase arremate-verzel criado em sa-east-1 por autorização direta, US$0/mês cotados, ACTIVE_HEALTHY; Custelo já INACTIVE. Não houve migration/seed da aplicação nem deploy hospedado.
- Notion segue bloqueado pela revisão automática, sem gravações externas. Alterações paralelas de motion/pranchas ficam fora do commit.

Estado desta etapa: EM ANDAMENTO, sem commit. E2E bloqueado antes de iniciar pela porta4310 ocupada; lint/tipos, API65, front60 e integração99 aprovados. Imagens/OG/status404/screenshot finais pendentes. Minor de fallback A→B→A registrado na evidência.

## Rodada 3 — pranchas R1–R10 (24/10/2026)

- D22 (D21 na branch): adendo ao Freeze D12. Implementado em `feat/rodada-3` (worktree separado, commits locais, sem push).
- Sheet de auth, cabeçalho novo, últimos lances, abas `?aba=`, card fixo, Detalhes, confirmação R7, Perfil, Suporte/FAQ, Como funciona; seed 0025–0036.
- Verde: lint, typecheck, vitest 64, unit 65, integração 99, Playwright 21. Evidência: docs/evidence/2026-10-24-rodada-3.md.
- Pendente de integração (Codex): botão Google, cadastro real, nome/e-mail/cartões no Perfil, links Carteira `?aba`. Termos/Privacidade entraram pela etapa 1 do Codex e estão no rodapé F3-cor.
- 25/10: hero H2 + carrossel H2b, Avise-me, notificações N1–N4 e rodapé F3-cor (`c11f308`). Merge local `--no-ff` de `feat/rodada-3` em `chore/bootstrap` em 25/10/2026, sem push.

## Auth/pagamentos — cadastro, Google e pagamentos simulados (D24, 26/10/2026)

- Trabalho do Codex revisado e concluído em commits separados; acentos regravados por ele restaurados em commit próprio.
- Cadastro/login por e-mail, `/auth/me` com nome (sem `/api/me/id`), Google OAuth (variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`), cartão de teste sem PAN/CVV, depósitos Pix e cartão idempotentes, extrato e histórico de lances.
- Migration `20261025103000_auth_payments` aplicada só em 5462/5463.
- Verde: lint, typecheck, unit 70, vitest 90, integração 120, Playwright 39 (workers=1).
- NÃO VERIFICADO: consentimento real do Google (sem credencial). D23 (vínculo Google com e-mail diferente) reservada e não aprovada.

## Erros e toasts (D25, 26/10/2026)

- Plano `2026-10-25-erros-e-toasts.md` e pranchas T1/T2/E1 em `docs/design/pranchas/toast/`.
- API: `message` em pt-BR nas mutações, códigos `LIMITE_CONEXOES` e `LOTE_JA_ABERTO`, `/auth/me` padronizado; 15 de 43 endpoints corrigidos (tabela em `docs/api-mensagens.md`). `ErrorReporter` só em log e `POST /api/client-errors`.
- Front: Sonner (`sonner@2.0.7` exato) no lugar do toast próprio, `lib/notify`, código de suporte com Copiar, Desfazer no favorito, N4 migrado, tela de erro E1 e `global-error`.
- Verde: lint, typecheck, unit 80, vitest 95, integração 123, Playwright 47 (workers=1).
- Aberto: aviso de hidratação #418 visto em `/painel/lotes/novo` e `/carteira`, causa não isolada.

## Achados da Sentinela M1, M2, B1, B3 (D26, 26/10/2026)

- M1: IP real pelo proxy `/api` com `trust proxy` = loopback; limite de login depois de Origin/CSRF e limite por e-mail.
- M2: CSP com nonce, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e HSTS só em produção.
- B1: cota própria para erros do navegador e limite de `/api/client-errors` por IP real. B3: 3 streams SSE por IP real.
- API em 4300 agora roda o build (`node dist/main.js`) em console próprio; a queda vinha do `node --watch` reiniciando sozinho.
- Verde: lint e typecheck sem erro, unit 81/81, vitest 100/100, integração 126/126 (23 suítes), E2E 48/48 com workers=1, build ok. O E2E de lances fecha os contextos que abre (cada um segura um SSE do limite de 3 por IP).
