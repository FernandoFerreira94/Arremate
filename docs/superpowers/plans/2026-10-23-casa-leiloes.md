# Casa de Leilões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para executar na sessão; superpowers:subagent-driven-development somente se Fernando escolher delegação. Steps use checkbox (`- [ ]`) syntax for tracking. Este é um plano, não autorização para iniciar as funcionalidades.

**Goal:** entregar o desafio Verzel completo: nove páginas, disputa consistente, dinheiro simulado, integridade verificável, metadados e implantação reproduzível.

**Architecture:** monorepo npm com Next.js App Router/React na Vercel e uma API NestJS persistente separada. PostgreSQL é autoridade transacional; REST consulta/muta, SSE invalida snapshots. Uma instância de API inicialmente, com mídia e testemunha de auditoria em armazenamento durável independente do banco.

**Tech Stack:** Node 24 LTS, TypeScript strict, Next.js, React, NestJS, Prisma 7 + SQL parametrizado, PostgreSQL 18, Tailwind 4, **shadcn obrigatório**, TanStack Query, React Hook Form/Zod, Jest, Vitest e Playwright. Versões instaladas em [ambiente](../../ambiente.md); lockfile é autoridade de resolução.

**Spec:** [arquitetura e invariantes](../specs/2026-10-23-casa-leiloes-design.md), [R01–R33/U01–U13](../../requisitos.md), [nove páginas](../../design/briefing-grok.md), [metadados](../../metadados.md), [testes](../../qualidade.md).

## Global Constraints

- React, Node.js, PostgreSQL e tema de obras de arte de acervo público: definidos por Fernando.
- Nome **Arremate**, logo, paleta, fontes e design system aprovados por Fernando em 23/10 (D01–D12, Design Freeze); “Casa de Leilões” fica como nome interno. Não inventar identidade visual na implementação; fonte: HANDOFF-GROK.
- shadcn é a base obrigatória dos componentes; adicionar somente os necessários, mantendo acessibilidade e tokens aprovados. Não instalar outra biblioteca visual por hábito.
- Nove páginas; estados, diálogos, 404 e acesso negado não viram funcionalidades extras. Sem cadastro/reset, pagamento real, frete, comissão, SaaS ou dark automático.
- Dinheiro em centavos inteiros: bigint no domínio; valores individuais bigint e saldos acumulados numeric(38,0) no DB; string decimal no HTTP. Datas UTC; exibição pt-BR/America/Sao_Paulo. Nenhum Number para calcular dinheiro.
- Primeiro lance >= inicial; seguintes >= atual + incremento; líder não cobre a si próprio; leiloeiro não dá lance.
- Janela `startsAt <= acceptedAt < endsAt`; relógio real do banco **depois de todos os locks**. Se `0 < endsAt - acceptedAt <= 120s`, `endsAt = acceptedAt + 120s`.
- Disponível = total − comprometido; reserva integral da liderança; liberação da anterior na mesma transação. Liquidação única debita vencedor, credita vendedor e cria um recibo.
- Auditoria percorre o histórico completo; detecta alteração, inserção, exclusão e truncamento/replay direto no DB. Sem testemunha verificável: INDETERMINATE, nunca INTACT.
- Imagem/metadados publicados persistem localmente; nenhuma leitura de lote/recibo/auditoria depende do catálogo externo.
- PII/credenciais nunca aparecem em projeção pública, SSE público, metadados, logs, comprovante ou evidência.
- Ciclo obrigatório por capacidade: teste vermelho → mínimo código → verde → review → evidência. Commit local só quando autorizado; push/deploy/envio/gasto exigem autorização própria.
- U12 permite somente bootstrap local antecipado. Produto/telas finais aguardam design, reconciliação do handoff e retomada de Fernando. Não marcar S6/S7 aprovados por inferência.
- README completo permanece no Notion durante o trabalho; copiar para o repositório somente ao finalizar validado.

## Review Focus

1. Uma carteira em dois lotes simultâneos não pode reservar mais que o total — tarefa 6: teste `cannotOvercommitAcrossLots`.
2. Uma espera por lock ultrapassa o fim: recusar sem prorrogar — tarefa 6: `rejectsAfterWaitingPastDeadline`.
3. DB confirma, mas disco/resposta falha: não duplicar nem afirmar sucesso/íntegro sem confirmação — tarefas 2/6: `commitWithoutCheckpointIsIndeterminate` e `retryReturnsOriginalBid`.
4. Auditoria concorrente e restauração de DB antigo não podem parecer íntegras — tarefa 2: `stableRevisionDuringRead` e `rejectsRestoredPrefix`.
5. Reinício ou dois liquidadores processam o mesmo lote uma vez — tarefa 7: `settlesOnceAcrossWorkersAndRestart`.

## Estado e execução

Plano revisado em 23/10/2026 a pedido de Fernando. Substitui a versão inicial Vite/Next ainda indefinida. Next.js foi escolhido tecnicamente para a Vercel e head nativo, dentro da autorização de instalação; não atribuir a Fernando aprovação individual de cada pacote.

Base local está em preparação/verificação: manifests/lockfile, dois pacotes, PostgreSQL isolado, health, placeholder sem design e ferramentas de teste. [Evidência de bootstrap](../../evidence/2026-10-23-bootstrap.md) distingue o que foi executado do que segue planejado. Nenhum checkbox de regra de produto abaixo está concluído.

Execução recomendada: nativa, por capacidade, com review independente nos pontos críticos e no fechamento. O núcleo tem interfaces acopladas e o prazo é curto; evitar vários implementadores modificando a mesma transação. A escolha de delegação e retomada permanece com Fernando. Design pode ocorrer em paralelo ao planejamento; nenhuma mensagem automática ao Grok.

## Contratos comuns e estrutura

```text
front-end/src/app/                     nove rotas, layouts e metadados nativos
front-end/src/features/{auth,lots,seller,wallet,awards,audit,receipts}/
front-end/src/components/ui/           código shadcn necessário, tokens do Grok
front-end/src/lib/{api,api-error,money,realtime,page-metadata}.ts
back-end/src/{auth,catalog,lots,wallets,audit,receipts}/
back-end/src/common/                   erros, segurança, validação e requestId
back-end/src/database/                 Prisma/SQL e transações concretas
back-end/prisma/{schema.prisma,migrations/,seed.ts}
back-end/test/integration/             PostgreSQL real e falhas de infraestrutura
e2e/                                  fluxos por papel e múltiplos contextos
docs/evidence/                        comando, ambiente, resultado e limite real
```

Criar arquivo apenas na capacidade que o usa. Controller → service → repository; somente repository importa Prisma/SQL. Sem BaseRepository/CQRS/event sourcing/Redis/microservices/store global de saldo. Testes usam seams reais para relógio/provider/disco, sem mockar os locks da prova de concorrência.

Contratos de fronteira definidos no módulo produtor e documentados em `docs/api.md` na tarefa 1:

```ts
type MoneyText = string; // centavos: /^(0|[1-9][0-9]*)$/, limites abaixo
type Role = "AUCTIONEER" | "BIDDER";
type Actor = { userId: string; role: Role }; // exclusivamente da sessão
type AuditStatus = "INTACT" | "TAMPERED" | "INDETERMINATE";
type ApiFailure = { statusCode: number; code: string; message: string; requestId: string; details?: Record<string, string> };
```

Proposta de limites de proteção, não requisitos inventados do PDF: entradas individuais positivas (depósito, lance inicial, incremento e lance) até `999999999999` centavos. Esse teto **não** limita o saldo acumulado nem o crédito de liquidações do leiloeiro. Wallet.total/committed usam numeric(38,0) exato; adaptador Decimal/string↔bigint sem Number; cada movimento individual/valor de Bid usa bigint. Somar em bigint e verificar a capacidade física do tipo antes de persistir; nenhuma liquidação válida da demonstração deve ser bloqueada pelo teto de entrada. JSON até 32 KiB; páginas de lotes/histórico/participações com 20 registros e teto 100. Zod no formulário melhora feedback; DTO/backend mantém autoridade. Reavaliar limites se houver impedimento real no teste, registrando decisão.

Idempotência obrigatória em depósito/lance/publicação: `Idempotency-Key` UUID, escopo ator+operação+recurso, hash do corpo canônico. Mesma chave/corpo retorna o resultado original; corpo diferente retorna 409. Guardar resultado financeiro durante toda a avaliação, sem expirar chave antes do respectivo histórico. Não expor chaves no público.

## Tarefa 1 — Consolidar handoff, dados e contratos

**Files:** modificar `docs/decisoes.md`, spec, `docs/lifecycle.md`, `.ai/architecture.md`; criar `docs/api.md`, `back-end/prisma/migrations/<timestamp>_auction_core/migration.sql`; modificar `back-end/prisma/schema.prisma`; criar `back-end/src/common/money.ts`, `back-end/test/money.spec.ts`, `back-end/test/integration/schema.integration.spec.ts`.

**Interfaces:** produz `parseMoney(value: string): bigint`, `formatMoney(value: bigint): MoneyText`; tabelas e constraints consumidas pelas tarefas 2–7. Teste/migração usa credencial de owner só no runner; runtime continua sem DDL.

- [x] Registrar handoff do design aprovado (D01–D12, Design Freeze 23/10) (S6 aceito em HTML/PNG, D13): links/versão dos artefatos, S5/S6/S7 aplicáveis, decisões remanescentes e retomada. Selecionar topologia concreta antes de release; não contratar automaticamente. Nota 23/10: registrado em `docs/decisoes.md` (seção Handoff da Tarefa 1) e `docs/lifecycle.md`. Topologia ainda aberta; nada contratado.
- [x] Escrever `money.spec.ts`: `parseMoney("100") === 100n`; rejeitar `"1.00"`, `"1e3"`, `"-1"`, espaços, tipo number e acima do teto; `formatMoney(123n) === "123"`. Rodar Jest com esse arquivo: vermelho por função ausente. Nota 23/10: vermelho por módulo ausente; depois 9 testes verdes.
- [x] Implementar conversão e DTOs explícitos. Separar dinheiro válido estruturalmente de campos que exigem `>0`. Front formata BRL apenas para exibição e converte entrada sem float. Nota 23/10: `parseMoney` aceita `"0"`; `parsePositiveMoney` exige `>0`. Contrato da UI em `docs/api.md`. Formatação BRL da tela fica na Tarefa 8, que já prevê o teste sem float. Sem DTO de endpoint nesta tarefa.
- [x] Definir schema: User(email normalizado único/role/passwordHash), Session(tokenHash único/expiry/revocation), Snapshot(provider+externalId único/dados públicos/licença/mediaKey), Lot(owner/snapshot/valores/datas/revision/state), Bid(lot/user/alias/sequence/valor/tempo/assinatura), Wallet(user único/total/committed), WalletEntry(referência única), Settlement(lot único), Receipt(settlement único/token aleatório único), Idempotency(escopo único/hash/resultado).
- [x] Constraints SQL: valores positivos; `0 <= committed <= total`; fim > início; sequence única por lote; FKs; dinheiro inteiro exato (bigint nos valores individuais, numeric(38,0) nos saldos acumulados); datas timestamptz. Indexar consulta de lotes por estado/prazo, dono, bids(lot,sequence), sessões/tokenHash, participações(user,lot). Não criar índice redundante de unique; validar EXPLAIN só onde o acesso justificar. Nota 23/10: CHECKs no SQL da migration porque o Prisma 7 não os emite. Unique de sequence e tokenHash não ganharam segundo índice. EXPLAIN adiado: ainda não há consulta de lista.
- [x] Escrever `schema.integration.spec.ts`: migração limpa aplica; duplicar sequence/liquidação/token/chave falha; runtime SELECT/INSERT permitido e CREATE/ALTER recusado; CHECK rejeita saldo negativo. Executar contra `casadeleilao_test`, nunca dev/produção. Nota 23/10: schema descartável `auction_core_probe` no banco de teste; 4 testes verdes.
- [x] Aplicar migração no banco de teste limpo com owner e rodar verde: `npm run test:integration --workspace back-end -- --testPathPatterns=schema.integration.spec.ts`. Atualizar scripts para executar suites futuras por padrão; não deixar `test:unit` preso apenas ao health. Nota 23/10: `migrate deploy` com owner em 5462 e 5463. `test:unit` ignora `integration` e roda health + money (14 testes).
- [x] Review do schema/privacidade/contratos e registrar evidência. Nenhuma credencial real no README, seed ou log. Checkpoint Git local apenas se solicitado. Nota 23/10: evidência em `docs/evidence/2026-10-23-tarefa-1.md`. Commits locais autorizados por Fernando nesta sessão. Sem push.

## Tarefa 2 — Provar a auditoria e as falhas de confirmação

**Files:** criar `back-end/src/audit/{audit.types.ts,audit-chain.ts,audit.service.ts,audit.repository.ts,checkpoint-store.ts}`, `back-end/test/audit-chain.spec.ts`, `back-end/test/integration/audit.integration.spec.ts`, `docs/operacao-integridade.md`.

**Consumes:** schema da tarefa 1. **Produces:** `signBid(event: CanonicalBid, previousSignature: string): string`; `verifyLot(lotId: string): Promise<AuditResult>`; `CheckpointStore.read(lotId): Promise<Checkpoint | null>`; `advance(expectedRevision: number, next: Checkpoint): Promise<void>`. AuditResult contém status/revision/count/verifiedAt/reasonCode públicos. CanonicalBid inclui lotId,bidId,bidderUserId,alias,sequence,amountCents,acceptedAt,previousSignature,keyVersion; IDs internos não saem na resposta.

- [x] Teste unitário fixa bytes canônicos e assinatura determinística: ordem dos campos, UTF-8, representação decimal, precisão temporal e versão. Trocar qualquer campo, inclusive bidderUserId mantendo alias, invalida. Rodar vermelho; implementar serialização explícita e HMAC/timingSafeEqual. Nota 23/10: vermelho por módulo ausente; depois 4 testes verdes em `audit-chain.spec.ts`.
- [x] Integração cria gênese + 3 lances assinados; SQL direto altera valor/usuário, insere, remove início/meio/fim/tudo, reordena, restaura prefixo antigo e remove lote. `verifyLot` nunca retorna INTACT nesses ataques. Snapshot legítimo vazio com gênese válida retorna INTACT/count0. Nota 23/10: esses ataques voltam TAMPERED; gênese vazia volta INTACT/count 0. Linha duplicada de lote também é TAMPERED (`DUPLICATE_ROW`).
- [x] Escrever `commitWithoutCheckpointIsIndeterminate`, `stableRevisionDuringRead`, `rejectsRestoredPrefix`: falha de write/fsync/rename, reinício e corrida leitura×atualização não produzem falso íntegro; sem chave/testemunha retorna INDETERMINATE. Não classificar leitura transitória concorrente como adulteração definitiva. Nota 23/10: os três nomes passam. Gap fica `CONFIRMATION_GAP` e bloqueia mutação com `CONFIRMATION_PENDING`. Corrida fica `CONCURRENT_READ`. Prefixo restaurado, relido em processo novo, fica `HISTORY_TRUNCATED`.
- [x] Rodar `npm run test:integration --workspace back-end -- --testPathPatterns=audit.integration.spec.ts`: vermelho por protocolo ausente. Implementar testemunha fora do DB com revisão monotônica, volume persistente, gravação atômica e coordenação por lote na instância única. Ensaio de durabilidade final também no Linux de destino; rename no Windows não é prova de fsync de diretório no Linux. Nota 23/10: vermelho por módulos ausentes; depois 8 testes verdes no `casadeleilao_test` e diretório temporário. Neste Windows o fsync de diretório devolve EPERM e não prova o Linux. Esse ensaio continua para o destino.
- [x] Documentar ordem exata DB commit→checkpoint→resposta/evento. Qualquer gap bloqueia novas mutações/liquidação do lote e devolve confirmação indeterminada; reconciliação só com evidência confiável. Nunca reconstruir testemunha assinando DB atual suspeito. O plano aceita indisponibilidade segura após falha, não promete recuperação automática. Nota 23/10: [operacao-integridade.md](../../operacao-integridade.md). `retryCheckpoint` só promove o `pending` já assinado.
- [x] Fixar metadados críticos do lote (dono/snapshot/termos/datas iniciais) na gênese e extensão/resultado no envelope verificável. Vincular recibo à liquidação e cadeia; tarefa 7 testa o vínculo final. Nenhum dinheiro novo depende de histórico comprovadamente adulterado. Nota 23/10: alterar termo, fim vigente ou liquidação deixa de ser INTACT. `assertCanMutate` recusa o lote. O fluxo do recibo na liquidação continua na Tarefa 7.
- [x] Rodar verde com PostgreSQL real + diretório temporário isolado e novo processo para restart. Review independente do modelo de ameaça, protocolo e testes. Se não provar R26, rever A08 antes de ampliar o produto. Nota 23/10: R26 ficou demonstrado nos ataques do teste, inclusive processo novo. Revisão adversária sem High/Critical; o caso Médio de linha duplicada foi fechado no mesmo dia. A08 não foi revertida. Volume de produção e fsync de diretório no Linux seguem abertos.

## Tarefa 3 — Sessão, permissões e fronteira Vercel/API

**Files:** criar `back-end/src/auth/{auth.controller.ts,auth.service.ts,auth.repository.ts,session.guard.ts,roles.guard.ts,csrf.guard.ts,dto/login.dto.ts}`, `back-end/test/integration/auth.integration.spec.ts`; modificar `back-end/src/app.ts`, `front-end/next.config.ts`; criar `front-end/src/lib/{api.ts,api-error.ts}`, `front-end/src/features/auth/{auth-api.ts,session-query.ts}`, `docs/api.md`.

**Consumes:** Actor/schema e erros comuns. **Produces:** GET `/api/auth/csrf`, POST `/login`, POST `/logout`, GET `/me`; `requireActor(request): Promise<Actor>`; `login(input,csrf): Promise<PublicSession>` com Set-Cookie; `logout` revoga DB. PublicSession só função/alias e dados próprios mínimos.

- [x] Escrever testes: credencial válida/inválida genérica; sessão expirada/revogada; leiloeiro 403 no depósito/lance; licitante 403 na criação; IDOR retorna 404; injeção de role/userId recusada; cookie nunca aparece no JSON/log. CSRF ausente/incorreto ou Origin externo recusa inclusive login; `returnTo=https://evil` e `//evil` recusados.
- [x] Rodar vermelho. Implementar hash de senha da A13 com parâmetros oficiais atuais/compatíveis, token opaco 256bits e só hash no DB, expiração absoluta 8h, revogação e CSRF vinculado à pré-sessão/sessão. Rate limits iniciais: login 10/min/IP, mutações 60/min/ator, catálogo 30/min/ator, auditoria 30/min/IP, SSE 3conexões/sessão ou IP anônimo; calibrar na tarefa 10. Rate limit de uma instância é limitação declarada.
- [x] Configurar caminho `/api` same-origin por rewrite para API persistente, cookies HttpOnly/SameSite=Lax, Secure e `__Host-` em produção, sem Domain. Permitir origens exatas conhecidas; não confiar em X-Forwarded/Host arbitrário nem CORS wildcard. API não exige segredo embutido no frontend; autentica cada request.
- [x] API client: credentials same-origin, CSRF em mutações, timeout/erro com code/requestId, sem tokens no storage. Após logout limpar queries privadas e encerrar SSE antes de redirecionar. Nunca logar bodies sensíveis.
- [x] Rodar verde em API real e navegador; comprovar cookies/CSRF pelo proxy. Tarefa 8 conecta login visual; tarefa 10 repete em URL publicada. Se rewrite bufferizar SSE ou não preservar cookies/headers, corrigir topologia antes de freeze de release; não adicionar polling silencioso como falsa prova do requisito ao vivo.
- [ ] Review independente de autenticação, rate limit, cache e confiança no proxy; evidência com valores sensíveis omitidos. A revisão do autor está na evidência e não achou High/Critical. O subagente de revisão não rodou (cota). Permanece pendência.

Nota 23/10/2026: o rewrite externo do Next não repassou Cookie/`Origin`/`X-CSRF-Token` (403 no proxy, 401 direto). O same-origin ficou em `front-end/src/app/api/[...path]/route.ts`. `users` não tem alias; login devolve `{ role, returnTo }` e `/me` só `{ role }`. Depósito, lance, criação e cancelamento são stubs que recusam papel/dono e não gravam; as tarefas 4–6 substituem `authorization.controller.ts` antes de registrar os mesmos caminhos. Catálogo, auditoria e SSE só têm o limitador, ainda sem rota.

## Tarefa 4 — Catálogo, snapshots e publicação/cancelamento

**Files:** criar `back-end/src/catalog/{met-catalog.client.ts,catalog.service.ts,catalog.controller.ts,image-importer.ts}`, `back-end/src/lots/{lots.controller.ts,lots.service.ts,lots.repository.ts,dto/create-lot.dto.ts}`, `back-end/test/integration/{catalog,lots}.integration.spec.ts`, fixtures sanitizadas em `back-end/test/fixtures/met/`.

**Consumes:** Actor, money, auditoria/gênese. **Produces:** `searchCatalog(query: string,page: number): Promise<CatalogPage>`; `importItem(externalId: number): Promise<PersistedSnapshot>`; `createLot(actor: Actor,input: CreateLotInput,key: string): Promise<LotView>`; `cancelLot(actor: Actor,lotId: string): Promise<LotView>`; list/detail/seller endpoints da spec. CreateLotInput aceita externalId/initialCents/incrementCents/startsAt/endsAt, não owner/snapshot/title/URL livres.

- [x] Smoke do endpoint oficial atual Met + imagem Open Access; registrar status, objeto/origem/licença e fixture real sem segredo. Se provider não funcionar, documentar e avaliar alternativa AIC com impacto explícito; não fabricar resposta de API.
- [x] Testes vermelhos: timeout/429/schema inválido; redirect/host/rede privada recusados; MIME/assinatura/tamanho impróprios; license não pública; datas inválidas/fim<=início/início passado; valores zero/abaixo/teto; mass assignment/IDOR. Título externo com `<script>` deve permanecer texto.
- [x] Implementar fetch limitado: HTTPS/allowlist exata e validação de cada destino, sem redirect arbitrário; máximo de imagem 10MiB e dimensões 20MP, JPEG/PNG/WebP verificados; sem SVG/HTML remoto. Timeout5s por chamada, orçamento total10s, no máximo1retry GET transitório respeitando Retry-After. Limites são controles propostos; registrar ajuste necessário.
- [x] Persistir snapshot e imagem verificada antes de publicar; mediaKey gerada pelo servidor, sem path fornecido pelo usuário. Upsert provider+externalId e concorrência não duplicam snapshot. Imagem final disponível mesmo sem provider; rollback não deixa lote publicado sem snapshot, limpar órfãos de importação por rotina explícita segura.
- [x] Listagem calcula estado temporal com clock do servidor: ao vivo/agendado/encerrado; cancelado fora da vitrine mas visível ao dono/link direto seguro. Sem editar termos após publicação. Cancelar só dono, zero lances e antes de encerrar, sob o mesmo lock do lance.
- [x] Rodar verde: `npm run test:integration --workspace back-end -- --testPathPatterns="catalog|lots"`. Desligar provider e comprovar list/detail/media persistidos. Tarefa 9 amplia teste para auditoria/comprovante. Teste cancelamento×primeiro lance é fechado na tarefa 6.
- [x] Review de SSRF, imagem/licença, autorização e atomicidade da publicação; evidência com origem da obra preservada. Revisão do autor em `docs/evidence/2026-10-23-tarefa-4.md`; revisão independente não rodou.

Nota 23/10/2026: feita sem cursor-agent. Smoke real do Met OK (busca 153 resultados, objeto 436524, imagem JPEG 599×423). Publicar exige `AUDIT_HMAC_KEY`; sem ela 503. A busca pede o detalhe dos 8 objetos com concorrência 4 no mesmo orçamento de 10 s; item que falha sai da página. Sem tela (Tarefa 8).

## Tarefa 5 — Carteira e depósito simulado idempotente

**Files:** criar `back-end/src/wallets/{wallets.types.ts,wallets.controller.ts,wallets.service.ts,wallets.repository.ts,dto/deposit.dto.ts}`, `back-end/src/common/idempotency.ts`, `back-end/test/integration/{wallets,idempotency}.integration.spec.ts`.

**Consumes:** Actor, MoneyText, schema. **Produces:** `getWallet(actor: Actor): Promise<WalletView>`; `deposit(actor: Actor,amountCents: MoneyText,key: string): Promise<WalletView>`. WalletView contém totalCents/committedCents/availableCents strings e revisão; somente titular lê.

- [x] Escrever testes: depósito10000 aumenta total/disponível10000 e comprometido0; valor inválido e overflow não movem saldo; duas chamadas simultâneas com mesma chave creditam uma vez; chave/corpo diferente 409; carteira de terceiro/leiloeiro inacessível. Somatório do ledger reconcilia saldo.
- [x] Rodar vermelho. Implementar transação concreta no repository: lock carteira, idempotência/unicidade, teto somente da entrada/capacidade de armazenamento e lançamento de depósito simulado. Sem pagamento, saque ou gateway.
- [x] Rodar `npm run test:integration --workspace back-end -- --testPathPatterns="wallets|idempotency"`: verde com conexões PostgreSQL independentes. Verificar rollback por falha após ledger não deixa saldo parcial.
- [x] Review de autorização/atomicidade e evidência (autoria própria; review independente segue aberto). Não marcar reserva/liberação testadas até tarefa 6.

## Tarefa 6 — Lance, reserva e anti-sniping sob concorrência

**Files:** criar `back-end/src/lots/{bidding.service.ts,bidding.repository.ts,dto/place-bid.dto.ts}`, `back-end/test/integration/{bidding-concurrency,time-boundaries,bid-idempotency}.integration.spec.ts`; modificar auditoria e catálogo/lot contracts somente se documentado.

**Consumes:** Actor, carteira/idempotência, `CheckpointStore`/cadeia. **Produces:** `placeBid(actor: Actor,lotId: string,amountCents: MoneyText,key: string): Promise<AcceptedBid>`; AcceptedBid contém projeção pública do lance, lotRevision, serverNow, endsAt e walletRevision; não expõe usuário interno.

- [x] Testes de valores: inicial10000 aceita10000/recusa9999; atual10000+incremento500 aceita10500/recusa10499; líder não repete lance mesmo com saldo. Carteira total15000 em dois lotes de10000 aceita só um (`cannotOvercommitAcrossLots`); ao superar, antigo disponível restaura e novo reserva tudo na mesma transação.
- [x] Fronteiras: aceita no início exato; recusa antes e no fim exato; restando121s não estende; 120s mantém fim;119s/1s estende para acceptedAt+120s; rejeição nunca estende. `rejectsAfterWaitingPastDeadline` segura lock em conexão separada, deixa prazo passar, libera, verifica recusa e estado intacto. Clock de teste não pode substituir o lock real.
- [x] Corridas: dois lances simultâneos válidos; cancelamento×primeiro lance só um vence; lance×liquidação revalida fim atualizado; retry chave/corpo igual retorna mesmo bidId (`retryReturnsOriginalBid`), corpo distinto409. Falha depois de commit/antes da resposta consulta idempotência e não cria novo lance.
- [x] Rodar vermelho. Implementar sequência: lock lote → carteiras envolvidas ordenadas por ID → relógio `clock_timestamp()` → validar estado/papel/líder/mínimo/saldo → liberar/reservar integralmente → gravar bid+ledger+revisão+prazos+idempotência na **mesma transação** → checkpoint → resposta/evento. Leitura decisória sempre no cliente transacional, nunca fora por “otimização”.
- [x] Retry limitado a conflitos transitórios identificados (deadlock/serialização, até3tentativas com jitter); não repetir recusa de negócio. Idempotência revalidada na transação. Coordenação da testemunha por lote não substitui locks de carteiras entre lotes; uma instância inicialmente.
- [x] Códigos distintos em pt-BR: BID_BELOW_MINIMUM, INSUFFICIENT_FUNDS, ALREADY_LEADING, LOT_NOT_STARTED, LOT_ENDED, LOT_CANCELLED, CONFIRMATION_PENDING. Em confirmação indeterminada: retornar503 com requestId/operação consultável pelo mesmo retry, bloquear mutações desse lote; não anunciar rejeição nem sucesso falso.
- [x] (23/10: verde, 20 repetições, invariantes conferidos; review independente NÃO feito, ver evidência da Tarefa 6) Rodar verde nas três suites + repetição controlada da corrida20vezes, asserts finais de reservas/ledger/contador/assinaturas e nenhum saldo negativo. Review independente obrigatório com leitura do código conectado. Registrar barreiras/requests/resultados sem credenciais.

## Tarefa 7 — Liquidação recuperável, resultados e comprovante

**Files:** criar `back-end/src/lots/{settlement.service.ts,settlement.repository.ts,settlement-runner.ts}`, `back-end/src/receipts/{receipts.controller.ts,receipts.service.ts,receipts.repository.ts}`, `back-end/test/integration/{settlement,recovery,receipts}.integration.spec.ts`; completar endpoints seller/me no módulo lots.

**Consumes:** lots/bids/wallets e auditoria. **Produces:** `settleLot(lotId: string): Promise<ClosedLot>`; `settleDueLots(): Promise<ProcessingSummary>`; `getReceipt(token: string): Promise<PublicReceipt>`; `listParticipations(actor,page)`, `listAwards(actor,page)`, `getSellerSummary(actor)`.

- [ ] Testes vermelhos: `settlesOnceAcrossWorkersAndRestart` executa dois workers e novo processo, espera um débito/um crédito/um recibo; dois arremates de600000000000 para o mesmo vendedor resultam em saldo1200000000000 e dois recibos válidos, sem bloquear o segundo crédito; sem lance fecha sem vencedor/movimento/recibo; lote prorrogado não fecha cedo; lote adulterado/indeterminado não liquida; falha em etapa intermediária faz rollback completo.
- [ ] Implementar runner a cada1s e varredura no startup, sem job por lote em memória. Lock lote→carteiras ordenadas, clock real pós-lock, verificar testemunha/estado, debitar total+comprometido do vencedor, creditar total do vendedor, ledger e settlement/receipt únicos na transação. Pendência de confirmação do witness continua fail-closed.
- [ ] Reforçar vínculo verificável de winner/bid/valor/seller/receipt: SQL direto altera vencedor, dono ou recibo e auditoria não apresenta documento como válido. `PublicReceipt` só lot/snapshot/alias de vencedor/alias público do vendedor/valor/datas/código, sem nome/email/IDs internos. Token aleatório >=128bits, não sequencial, sem tratá-lo como autenticação.
- [ ] Listas próprias incluem participação perdida e ganhos só após liquidação; painel soma créditos liquidados, não valor potencial aberto. Estados CLOSED_PENDING/SETTLED e CLOSED_NO_BIDS distinguíveis na UI; `serverNow >= endsAt` já impede lance independentemente do worker.
- [ ] Rodar verde: `npm run test:integration --workspace back-end -- --testPathPatterns="settlement|recovery|receipts"`; ensaiar restart após prazo/commit/checkpoint, testar dois lotes compartilhando carteiras sem deadlock persistente. Review financeiro/privacidade e evidência.

## Tarefa 8 — Design system shadcn, navegação e páginas de ação

**Files:** criar a partir do Grok `DESIGN.md`, `.design-system/{README,colors,typography,components,layouts,responsive,accessibility}.md`; `front-end/components.json`, componentes necessários em `src/components/ui/`, `src/app/providers.tsx`; criar rotas `src/app/entrar/page.tsx`, `src/app/painel/lotes/page.tsx`, `src/app/painel/lotes/novo/page.tsx`, `src/app/carteira/page.tsx`, `src/app/meus-arremates/page.tsx`; features de auth/seller/wallet/awards, testes próximos do comportamento; `e2e/private-journeys.spec.ts`.

**Consumes:** handoff visual aprovado e APIs tarefas 3–7. **Produces:** layout/nav por papel, formulários e cinco páginas privadas/login funcionais. ProvidersQueryClient único; dinheiro/tempo não duplicados em store. AppRouter Server Components para shell/metadados e Client Components só onde precisa interação.

- [ ] Conferir nome/logo/paleta, fonte/licença, tokens semânticos, desktop1440/mobile390 e estados. Inicializar shadcn compatível com Next/Tailwind4; gerar apenas Button,Input,Label,Card,Dialog,AlertDialog,Tabs,Table,Badge,Alert,Skeleton,Select/DatePicker se necessários ao desenho. Sem copiar DS de Axion/Colinas ou adicionar animação/3D sem requisito.
- [ ] Escrever testes vermelhos de comportamento: login preserva email após falha; valor BRL converte sem float; depósito duplo clique envia uma chave; publicação mantém campos em erro e usa snapshot confiável; cancelamento recusado atualiza painel; lista perdida não aparece como vitória. Vitest com configuração DOM apropriada somente ao primeiro teste de componente; sem testes que apenas espelham classe CSS.
- [ ] Implementar API/hooks centralizados; navegação pública+área por papel; guard de página é UX e backend mantém autorização. Sem cache compartilhado para sessão/saldo; limpar dados privados ao mudar usuário/logout. Data/hora do formulário indica fuso e converte para UTC determinístico.
- [ ] Conteúdo exato por página no briefing: Entrar sem cadastro/reset; Meus lotes com resultado/total recebido/cancelamento elegível; Criar lote buscar→selecionar→configurar→revisar; Carteira três saldos/depósito simulado/lotes liderados; Meus arremates participações+vitórias/comprovantes. Pending/empty/erro/sucesso/acesso negado implementados, sem botão decorativo sem ação.
- [ ] Rodar unitários frontend e `npm run test:e2e -- private-journeys.spec.ts`: login pelos dois papéis, IDOR direto, logout/back sem dado privado, depósito/publicação/cancelamento e navegação mobile. Labels, teclado/foco, erro associado e diálogo com retorno de foco.
- [ ] Review de componentes/segurança/client cache e comparação com pranchas; evidência/screenshots nos tamanhos aprovados. Não declarar sala ao vivo pronta nesta tarefa.

## Tarefa 9 — Páginas públicas, sala ao vivo, auditoria e metadados

**Files:** rotas `front-end/src/app/page.tsx`, `src/app/lotes/[id]/page.tsx`, `src/app/lotes/[id]/auditoria/page.tsx`, `src/app/comprovantes/[token]/page.tsx`; features lots/audit/receipts; `src/lib/{realtime,page-metadata}.ts`; `src/app/{layout,not-found,robots,opengraph-image}.*` conforme convenções nativas; `back-end/src/lots/events.controller.ts`, `lot-events.service.ts`; `e2e/{live-bidding,public-audit,metadata,provider-outage}.spec.ts`.

**Consumes:** API/visual tarefas 2–8. **Produces:** quatro páginas públicas, SSE GET `/api/events?lotId=`, eventos `lot.updated` e `wallet.updated` privado (ID/revisão), metadados nativos Next. Não criar renderizador de head no Nest.

- [ ] Testes vermelhos Playwright em dois contextos: lance/superação/prorrogação/ranking/saldo sem reload; visitante/leiloeiro não podem dar lance; canal público não vaza carteira/PII; expiração/revogação fecha eventos privados. Desconectar/reconectar refaz snapshot; evento duplicado/fora de ordem não regride revisão.
- [ ] Implementar um EventSource por aba/página ativa, limpeza, heartbeat15s, revalidação e limites. Em reconexão/foco refazer snapshots autoritativos; canal indisponível ativa polling10s e informa dado degradado. No pending de lance não inventar saldo/liderança; confirmação atualiza queries de lote/carteira/participações/painel.
- [ ] Vitrine mostra três estados e paginação; sala exibe obra/crédito, atual/mínimo, histórico com aliases, ranking por maior lance de cada participante e posição própria, contador sincronizado por serverNow, líder/superado/prorrogado/encerrando/resultado. UI recebe códigos R15 e exibe mensagem junto à ação; cronômetro cliente nunca decide aceite.
- [ ] Auditoria pública oferece histórico completo paginado preso à mesma revisão; verificação backend cobre tudo. Mudança de revisão invalida paginação e reinicia consulta sem misturar versões. INDETERMINATE não usa selo positivo. Comprovante mostra simulação, resultado seguro, copiar link/imprimir, vínculo auditoria e erro real de token/integridade.
- [ ] T16: `generateMetadata`/Metadata API com nome/logo aprovados, títulos e descrições por rota; canonical por SITE_URL allowlist, OG/Twitter/alt/imagem1200x630 pública persistida; favicon/apple-touch-icon; sem PII/saldo/preço-prazo volátil no preview. Demo noindex como baseline seguro; eventual indexação pública exige aprovação. Sem sitemap de URLs não indexáveis; robots não impede crawler ler noindex. `notFound()` para404, sem página200 de erro.
- [ ] `metadata.spec.ts` usa requestHTTP sem JS: title/description/canonical/OG/robots únicos por página; injeta título/Host/query e verifica escape/origem; navega loteA→loteB→carteira→logout→Home sem tags/PII antigas. Privadas têm noindex e não vazam dados ao anônimo/preview. Assets sociais com status/MIME corretos.
- [ ] `provider-outage.spec.ts`: após criar lote, bloquear host externo e percorrer vitrine/sala/auditoria/comprovante/imagem sem dependência. `public-audit.spec.ts`: sem login, verificar íntegro/adulterado/indeterminado e nenhuma PII em JSON/head/DOM/SSE.
- [ ] Rodar todas as quatro suites verdes; validar320/390/768/1440px, zoom200%, teclado/reduced-motion e anúncio moderado de lances, sem anunciar contador a cada segundo. Review de conexão/cache/privacidade e fidelidade ao Grok; evidência.

## Tarefa 10 — Seed, segurança, deploy e entrega

**Files:** `back-end/prisma/seed.ts`, `back-end/test/integration/seed.integration.spec.ts`, `.github/workflows/ci.yml`, `docs/{hospedagem,ambiente}.md`, evidências de release; README fonte no Notion; README.md local só no final validado.

**Consumes:** todas as capacidades. **Produces:** instalação limpa reproduzível, demo pronta para avaliar, URLs verificadas e declaração factual de IA. Publicação depende de autorização específica.

- [ ] Teste vermelho do seed/reexecução: 1leiloeiro+2licitantes fictícios, credenciais de demonstração documentadas de forma consciente, snapshot real/licença, pelo menos1lote aberto. Seed não zera saldo/apaga lances nem reabre lote silenciosamente; comando explícito de preparo cria novo lote com datas relativas se necessário.
- [ ] Rodar verde e jornada inteira: visitante→login→depósito→obra/lote→duas contas disputam→superação/prorrogação→encerramento→crédito/arremate/recibo/auditoria. Provar independentemente recusa por cada R15 e semlances/cancelamento. Revisar matriz R01–R33 abaixo contra evidências, não contagem de testes.
- [ ] Instalação limpa pelo lockfile em CI, migração/seed num PostgreSQL vazio, lint, typecheck, unitários frontend/backend, integração, E2E e builds. CI deve falhar com qualquer check; não publicar credenciais reais nem expor DB. Auditar dependências sem `audit fix --force`; investigar High/Critical aplicáveis e atualizar compatível.
- [ ] Validar dados malformados, SQL/XSS/SSRF/CSRF/IDOR, limites JSON/valor/página/conexões, cache privado, CSP/TLS/cookies, headers/trustproxy e logs/requestId. Ensaio proporcional: 20licitantes simultâneos em um lote + dois lotes/carteira; medir p95/erros e validar invariantes, sem prometer escala ilimitada.
- [ ] Definir fornecedor/custo e endereço da API/DB, volumes de mídia/testemunha, segredo/chaves fora do DB, migraçãoowner/runtime separado, TLS, proxySSE e backups coerentes. Ensaiar backup/restore DB+mídia+witness e rollback; restaurar DB antigo sozinho deve impedir falso íntegro. RPO/RTO finais só após ensaio e restrições do serviço.
- [ ] Review independente final do código conectado + PDF + design + evidências. Resolver High/Critical e critérios obrigatórios; registrar limites conhecidos. Segurança absoluta não é critério que se possa prometer; ausência de evidência não é PASS.
- [ ] Apresentar artefato/custo/destino para autorização de deploy. Depois de autorizado, publicar frontendVercel/APIpersistente/DB e repetir anon/login/duascontas, SSE real, metadataHTTP, snapshotoffline, workerrestart, health/backup/restore. Não usar fs temporário de Functions para witness nem cron diário para encerramento.
- [ ] Atualizar README no Notion com comandos executados, `.env.example` por nomes, migrações/seed, credenciais **somente fictícias da demo**, regras/limitações/recuperação/testes/URLs e uso factual de Codex/Grok. Copiar bloco final para README.md local quando validado. PDF original privado não vai para repo público.
- [ ] Verificar lote realmente aberto antes do envio de29/10/2026~18h17; repository/link públicos e sem segredos. Fernando revisa; push/publicação de repo/formulário somente com autorização. Registrar estado real de entrega.

## Cobertura e ordem

| Requisitos | Tarefas responsáveis |
| --- | --- |
| R01/R04/R06–R08/R16 | 4, 8, 9 |
| R02/R03/R27 | 3, 5–9 |
| R05/R28–R33 | 1, 10; bootstrap em evidência separada |
| R09/R13/R24/R25 | 7–9 |
| R10/R11/R14/R15 | 6, 9 |
| R12/R17–R23 | 5, 6, 9 |
| R26 | 2, 6, 7, 9, 10 |
| U05 testes/review/docs | Todas as tarefas |
| U08 metadados | 8–10 |
| U09 Vercel/API; U10 README Notion | 3, 10 |
| U13 shadcn e identidade visual | Handoff, 8, 9 |

Dependências: 1→2→3→4→5→6→7→8→9→10. O desenho do Grok pode acontecer agora, sem implementar telas antecipadamente. Extra de busca/filtro/dark/cancelamento após lance só se o obrigatório estiver validado e Fernando autorizar.

Planejamento de calendário, não promessa: 23/10 base+plano+design em andamento;24–25/10 integridade/auth/catálogo/carteira/lance;26/10 liquidação e integração visual;27/10 tempo real/metadados/E2E;28/10 release/deploy autorizado/correções;29/10 reserva de entrega. Gate crítico falhando remove extras, nunca um R obrigatório/teste/review.

## Auto-revisão do plano

Os33R estão atribuídos; U01–U13 preservados. Assinaturas/projeções são definidas pelo módulo produtor; HTTP usa string e domínio bigint. Cada capacidade tem caminho de teste, vermelho/verde, revisão e evidência. Os cinco riscos do Review Focus têm testes nominais nas tarefas responsáveis. Não há domínio no frontend nem renderer de head duplicado no Nest.

**Pendências explícitas:** Design Freeze declarado; S6 aceito com HTML/PNG como fonte visual, sem Penpot (D13); itens abertos do S5 ficam como risco, decididos por tarefa; implementação autorizada a partir da Tarefa 1 (migration só local, commits locais, sem push); prova técnica da testemunha; mecanismo de senha conforme compatibilidade; fornecedor/custo/origens reais e proxySSE. Por D13, os itens abertos do S5 são risco decidido por tarefa; ainda impedem declarar release/segurança/handoff concluídos. Plano aguarda revisão e retomada de Fernando antes das tarefas de produto.

## PD — Design (Grok/Fred), adicionado em 23/10/2026

> Adição. Não altera as Tarefas 1–10 nem decisões anteriores; detalha a parte visual das Tarefas 8 e 9. **Design Freeze declarado por Fernando em 23/10/2026 (D12)**; S6 aceito com HTML/PNG sem Penpot e implementação autorizada a partir da Tarefa 1 (D13: migration só local, commits locais, sem push). Fonte detalhada: [HANDOFF-GROK](../../design/HANDOFF-GROK.md) e [índice das pranchas](../../design/pranchas/INDICE.md).

### Decisões de design aprovadas pelo Fernando em 23/10

Nome **Arremate**; paleta Bordô #6E1E2B, Latão #A9823A e papel #F6F3EC; fontes Fraunces (títulos e valores) e Inter (UI); atalhos de lance mínimo, +1 e +2 incrementos; depósito simulado de R$ 1 a R$ 100 mil; vitrine ordenada pelo término mais próximo; sem aviso ao visitante quando o The Met cair; sem dark mode.

**Aprovados em 23/10 (D09–D12):** logo “A” em Fraunces; paginação da vitrine com 8 itens; atalhos de depósito 1k/5k/10k; Design Freeze. **Pendentes na implementação:** validação de a11y; texto exato das recusas e códigos de erro (alinhar com o back-end).

### Arquivos

- `docs/design/pranchas/00-design-system.png`, `01-estados-componentes.png` e `02`–`13` (Vitrine, Sala e Carteira desktop/mobile; Entrar, Meus lotes, Criar lote, Meus arremates, Auditoria e Comprovante com estados E*/M*).
- `docs/design/pranchas/src/` (HTML de apresentação e geradores `_gen/`; não é código do produto).
- `docs/design/pranchas/assets/icons/` (lucide), `assets/obras/` (imagens CC0 do The Met com JSON de origem/crédito) e `assets/meta/` (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png` 180×180, `og-image.png` 1200×630, `og-art-436535.jpg`).
- `docs/design/pranchas/INDICE.md` e `docs/design/HANDOFF-GROK.md` (tokens, componentes, responsivo, estados, créditos, rastreabilidade §8/§8b/§8c, pendências §9).
- Na Tarefa 8, `DESIGN.md` e `.design-system/` derivam do HANDOFF; tokens vão para as variáveis do tema shadcn em `front-end` (U13).

### Dependências

- Fontes **Fraunces** e **Inter** (OFL), carregadas pelo mecanismo de fontes do framework escolhido no freeze.
- Primitivas **shadcn** listadas no HANDOFF §3 (Button, Card, Badge, Tabs, Input/Label/Form, Alert, AlertDialog, Sheet, Table, Skeleton, Sonner, Pagination, DropdownMenu/Avatar, Tooltip, ScrollArea) e ícones lucide.
- Imagens **CC0 do The Met**, com crédito persistido.
- **Nenhuma biblioteca extra** de UI/motion. Instalação de componente/fonte só na Tarefa 8, com aprovação.

### Etapas de implementação do design (após S7 e autorização)

- [ ] D0 — Tokens (HANDOFF §2) no tema shadcn, tipografia, grid, foco, radius, sombras, camadas e motion com `prefers-reduced-motion`; assets de `assets/meta/` no head (U08/T16).
- [ ] D1 — Componentes compostos: LoteCard, SaldoCard, PainelDeLance, StatusLote, Posição, Integridade, Simulado, Origem, campo monetário R$ e fallback "Imagem indisponível" (prancha 01).
- [ ] D2 — Vitrine (02/03): abas, ordenação por término, estados E*/M*; R01, R06, R16. Integra com as Tarefas 4 e 9.
- [ ] D3 — Sala do lote (04/05): agendado/ao vivo/encerrado, histórico, posição, atalhos, prorrogação, reconexão, erros de lance, leiloeiro sem lance; R02, R03, R10, R11, R15, R17–R19, R22–R25, U03. Integra com as Tarefas 6 e 9.
- [ ] D4 — Carteira (06/07): total/comprometido/disponível, depósito simulado R$1–R$100 mil; R03, R12, R20, R21, R24. Integra com as Tarefas 5 e 8.
- [ ] D5 — Entrar (08): E1–E7/M1–M3, sem cadastro/recuperação; retorno ao lote de origem; U07. Integra com as Tarefas 3 e 8.
- [ ] D6 — Meus lotes (09) e Criar lote (10): R02, R04, R07–R09, R16. Integra com as Tarefas 4, 7 e 8.
- [ ] D7 — Meus arremates (11) e Comprovante (13): R13, R24, R27. Integra com as Tarefas 7, 8 e 9.
- [ ] D8 — Auditoria (12): íntegro/adulterado/indeterminado, paginação completa; R14, R25–R27. Integra com as Tarefas 2 e 9.

### Testes de design

- Teclado (ordem e foco visível em todas as páginas e dialogs/sheets); leitor de tela (labels, nomes acessíveis, anúncios de lance/superado/erro via live region).
- Largura 320px e zoom 200% sem perda de conteúdo ou rolagem horizontal; alvos de toque ≥ 44px.
- Contraste AA conforme HANDOFF §2 (latão nunca como texto).
- `prefers-reduced-motion`: sem pulso nem contagem animada.
- OG/metadados (T16): HTML inicial com title, OG 1200×630 com alt, favicon, apple-touch-icon; sem saldo/PII/preço volátil; noindex na Auditoria.
- Evidência real em `docs/evidence/`; nada consta como aprovado antes de rodar.

### Critérios de aceite por página (HANDOFF §8/§8b)

| Página | Rota | Aceite | Requisitos |
| --- | --- | --- | --- |
| Vitrine | `/` | Abas por status, término mais próximo primeiro, cancelados fora, origem/crédito, queda do Met só registrada internamente | R01, R06, R16, U02 |
| Entrar | `/entrar` | E1–E7/M1–M3; erro genérico de credencial; sem cadastro/recuperação | U07 |
| Sala do lote | `/lotes/:id` | Lance atual, mínimo, histórico, posição, ganhando/superado, prorrogação +120s, reconexão, erros de lance, leiloeiro sem lance | R02, R03, R10, R11, R15, R17–R19, R22–R25, U03 |
| Meus lotes | `/painel/lotes` | Só lotes próprios; cancelar só sem lances, corrida perdida; total recebido sem processando | R02, R08, R09 |
| Criar lote | `/painel/lotes/novo` | Buscar → escolher → valores/datas → revisar/publicar; dados da API não editáveis; Met fora | R04, R07, R16, R23 |
| Carteira | `/carteira` | Total − comprometido = disponível; depósito simulado explícito R$1–R$100 mil | R03, R12, R20, R21, R24 |
| Meus arremates | `/meus-arremates` | Arrematados + participações, apurando, copiar link do comprovante | R13, R24 |
| Auditoria | `/lotes/:id/auditoria` | Sem login, histórico completo paginado, íntegro/adulterado/indeterminado, sem PII | R14, R25, R26, R27 |
| Comprovante | `/comprovantes/:token` | Válido/404/indisponível/adulterado/não verificável/impressão, sem PII | R24, R27 |
| Design system | — | Tokens, componentes e assets U08 | U04, U07, U08 |

Fora do design: R05, R28–R33, U01, U05, U06, U09–U11.

## D13 — Liberação da implementação (Fernando, 23/10/2026 10:26)

Fernando: “Libero: aceito HTML/PNG sem Penpot, arquitetura em aberto como risco, e Tarefa 1 com migration local e commits locais”. Começar pela Tarefa 1. Migration só no banco local (dev/teste, portas 5462/5463); commits locais permitidos; push, PR, deploy e gasto continuam exigindo autorização própria. Itens abertos do S5 são riscos: decidir e registrar na tarefa que depender deles, sem bloquear o início.
