# Casa de Leilões — proposta técnica para Architecture Freeze

Data: 23/10/2026. **Especificação de implementação; decisões de produto pendentes continuam propostas.** U12 autorizou criar a base local antecipadamente; U13 pediu o plano completo e definiu shadcn. Bootstrap não aprova design/handoff nem autoriza funcionalidades, migrations de domínio ou publicação. Fontes: [requisitos](../../requisitos.md), [Lifecycle](../../lifecycle.md) e [Project Init](https://app.notion.com/p/37dd66ddfe9381638313f39ccae2154a).

## Intenção e limites

Entregar integralmente o desafio Verzel, com regras financeiras simuladas corretas sob concorrência, auditoria explicável e operação reproduzível. Priorizar evidência observável, manutenção simples e privacidade. Design é responsabilidade do Grok, aprovado por Fernando. Não transformar o teste em SaaS genérico, mercado com pagamentos reais ou plataforma de arte comercial.

Perfil recomendado: **STANDARD**, com gates reforçados em lances, saldo, autenticação e integridade. Não há dinheiro real nem tenancy; isso não reduz a exigência de transações, testes de corrida e revisão de segurança nesses módulos.

## Registro de decisões propostas

| ID | Recomendação | Alternativa realista | Motivo / trade-off | Estado |
| --- | --- | --- | --- | --- |
| A01 | Next.js App Router + React + TS strict | Vite SPA com HTML por rota | Vercel e metadados nativos no HTML inicial; domínio permanece só na API Nest. Evita renderer próprio de head | SELECIONADA no bootstrap U12; decisão técnica do executor |
| A02 | Node.js + NestJS, monólito modular | Express com módulos explícitos | Guards, DTOs, DI e testes conhecidos de Axion; um pouco mais de estrutura, sem framework próprio | SELECIONADA no bootstrap; domínio ainda não implementado |
| A03 | PostgreSQL | MySQL | Escolha de Fernando; transações relacionais e locks atendem carteira/leilões. Não há razão para trocar | DEFINIDA pelo usuário |
| A04 | Prisma no acesso comum e SQL parametrizado para locks | node-postgres + SQL | Convenção conhecida; SQL de concorrência explícito no repository. Não esconder lock em ORM genérico | PROPOSTA |
| A05 | Sessão opaca em cookie HttpOnly; hash da sessão no DB | JWT curto em cookie + revogação | Logout/revogação e SSE same-origin simples. Uma leitura de sessão; sem token no localStorage | PROPOSTA |
| A06 | SSE + REST + recuperação por snapshot/polling | WebSocket | Lances são POST; eventos são unidirecionais. Evita protocolo bidirecional e infraestrutura extra | PROPOSTA |
| A07 | Met Collection API, busca paginada v1.1 e importação persistida | Art Institute of Chicago API | Arte escolhida por Fernando; metadados/imagens abertas. Provider não pode ser dependência de leitura dos lotes | PROPOSTA; chamada real ainda não validada |
| A08 | HMAC encadeado + checkpoint durável fora do DB | Assinaturas públicas + armazenamento imutável externo | Detecta adulteração direta no DB e truncamento; exige volume persistente independente e teste de falhas | PROPOSTA crítica; validar protótipo antes de fixar |
| A09 | Site na Vercel; API Node persistente separada; PostgreSQL e armazenamento durável | Web/API em Functions com persistência/execução externa | Fronteira híbrida confirmada por Fernando; preservar domínio/transações na API e validar proxy/cookies/SSE/metadados | FRONTEIRA DEFINIDA; fornecedor de API/DB/custo e integração ainda abertos |
| A10 | Tailwind + componentes shadcn com design aprovado do Grok | CSS próprio foi considerado antes de U13 | Fernando determinou shadcn; tokens/nome/logo/paletas continuam com Grok e aprovação de Fernando | DEFINIDA pelo usuário U13; CLI base instalada, visual pendente |
| A11 | TanStack Query para estado remoto; estado local React | Fetch + cache próprio | Coordena invalidação por SSE, reconexão e mutações. Sem Redux/Zustand ou cópia do saldo em store | PROPOSTA |
| A12 | Comprovante HTML compartilhável | PDF gerado no servidor | Satisfaz o link exigido com menos dependência e layout duplicado | PROPOSTA |
| A13 | Hash de senha Argon2id | scrypt assíncrono nativo do Node | Seguir parâmetros atuais OWASP e compatibilidade no S8; nunca hash rápido para senha | PROPOSTA |

Versões fixadas no lockfile após consulta de compatibilidade no bootstrap U12; [ambiente](../../ambiente.md). Node24 LTS e Prisma7 estável, sem atualizar para Prisma8 RC sugerido pela CLI. Antes de nova dependência, validar documentação oficial/compatibilidade; sem atualização automática para beta.

U09 substitui a hipótese inicial de um único Nest servindo todo o site: [topologia Vercel + API persistente](../../hospedagem.md). A01 foi reconciliada escolhendo Next/metadados nativos no bootstrap; validar proxy/cookies/SSE em produção antes do release; não colocar testemunha/worker em disco temporário ou memória de Functions. U10 define [README no Notion](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82) até a cópia final ao repositório.

## Fronteiras e organização prevista

Monorepo simples: `front-end/` e `back-end/`. Sem Nx/Turborepo, pacote genérico shared ou gerador de arquitetura. Contratos HTTP documentados; compartilhar tipos somente se a duplicação real justificar.

Backend: módulos `auth`, `catalog`, `lots`, `wallets`, `audit`, `receipts` e infraestrutura `common`, `database`, `health`. Dentro de cada módulo, apenas controller, DTO, service e repository necessários.

- Controller valida, autentica/autoriza e delega; nenhuma regra de lance nele.
- Service aplica invariantes; não importa Prisma. Repository concentra Prisma/SQL e delimita a transação. Callback tipado permite política de domínio dentro da transação sem expor o cliente Prisma ao service.
- Sem BaseRepository, RepositoryFactory, CQRS, event sourcing, microservices ou camada de use cases para cada método.
- Operações financeiras compartilhadas usam o mesmo contexto transacional. Dentro da transação, usar apenas seu cliente `tx`, inclusive leituras críticas. Não seguir a regra legada de Colinas de mover leitura decisória para fora do lock.
- Interfaces somente em fronteiras reais: API de catálogo e checkpoint independente precisam de substituição determinística nos testes.

Frontend: páginas compõem features (`auth`, `lots`, `wallet`, `arremates`, `audit`, `seller`). HTTP/erros centralizados; hooks de query por feature; componentes UI reutilizados a partir do design aprovado. O servidor é autoridade de dinheiro, permissão, ranking e tempo.

## Modelo conceitual e invariantes de dados

Modelo da tarefa 1 do [plano](../plans/2026-10-23-casa-leiloes.md), materializado em `back-end/prisma/schema.prisma` e na migration `20261023104706_auction_core`. Prisma 7 não representa CHECK; os predicados ficam no SQL da migration. `AuditCheckpoint` continua fora do PostgreSQL.

| Conceito | Responsabilidade / restrições previstas |
| --- | --- |
| User | ID interno, credencial, função AUCTIONEER/BIDDER; email único normalizado; sem PII em projeções públicas |
| Session | Hash de identificador aleatório, usuário, expiração e revogação; token bruto só no cookie |
| CatalogItemSnapshot | Origem, externalId, título, atributos, créditos/licença, imagem local verificada; único por provider/externalId |
| Lot | Proprietário, snapshot, inicial/incremento, datas, encerramento/cancelamento, maior lance e revisão |
| Bid | Lote, usuário interno, alias público do lote, valor, horário aceito, sequência e assinatura encadeada; histórico somente de inclusão |
| Wallet | Saldo total e comprometido; disponível derivado; `0 <= comprometido <= total` |
| WalletEntry | Depósito simulado, reserva/liberação e liquidação, referências únicas e trilha reconciliável |
| Settlement / Receipt | Um resultado por lote e um comprovante por arremate; token público aleatório; projeção pública sem PII |
| IdempotencyRecord | Usuário + operação + chave única + digest do corpo + resultado; atômico com a mutação |
| AuditCheckpoint | Contagem, cabeça, versão e estado do lote em armazenamento independente do PostgreSQL |

Valores em centavos inteiros: bigint no domínio; valores individuais bigint e Wallet.total/committed numeric(38,0) exato no DB; strings decimais no JSON, nunca float. Adaptador converte Decimal/string↔bigint sem Number; BRL só na UI. Teto proposto por entrada individual (depósito/lance/inicial/incremento): `999999999999` centavos, sem aplicar esse teto ao saldo acumulado nem ao crédito do leiloeiro. Validar capacidade física do tipo antes de persistir. Dois arremates de600000000000 devem creditar1200000000000 sem bloqueio. Rejeitar negativo, zero onde proibido, decimal, NaN e overflow. Limites são controles técnicos, não exigências do PDF.

Datas UTC com precisão consistente entre assinatura/DB/API; interface em pt-BR. Estado temporal derivado: agendado antes do início, ao vivo em `startsAt <= now < endsAt`, encerrado quando tempo acabou; flag `settlementPending` distingue término da liquidação. Cancelamento e liquidação são estados persistidos. Não depender de cron para rejeitar lance após prazo.

Constraints aplicadas na Tarefa 1: valores de lote e lance positivos; `ends_at > starts_at`; `0 <= committed <= total`; e-mail já normalizado; unicidade de e-mail, `(provider, externalId)`, `tokenHash`, `(lotId, sequence)`, carteira por usuário, referência de lançamento, liquidação por lote, token de recibo e escopo de idempotência `(userId, operation, resourceKey, idempotencyKey)`. Índices de lotes por `(status, endsAt)` e dono, lances por `(userId, lotId)` e FKs sem repetir o índice do unique. JSON de idempotência até 32 KiB. Listas paginadas (`page >= 1`, `limit` padrão 20, máximo 100; vitrine com 8 itens por D10), projeções explícitas e sem N+1.

## Lance, saldo e concorrência — contrato proposto

`placeBid(actor, lotId, amountCents, idempotencyKey) -> BidAccepted`.

1. Exigir licitante autenticado, DTO com campos permitidos e chave de idempotência. Nunca aceitar `userId`, função, vencedor, saldo ou horário do cliente.
2. Serializar confirmação/checkpoint do mesmo lote na instância única. A correção financeira depende dos locks do DB, não dessa fila em memória.
3. Iniciar transação curta; bloquear lote com `SELECT ... FOR UPDATE`. Revalidar idempotência sob unicidade; repetição do mesmo corpo retorna o mesmo resultado, corpo diferente retorna 409.
4. Bloquear as carteiras envolvidas em ordem determinística de ID. Todas as operações seguem lote primeiro, carteiras depois; depósito só bloqueia carteira e não adquire lote depois.
5. Ler o relógio real do DB **depois de adquirir os locks**, com `clock_timestamp()`. `now()` fixa o início da transação e pode aceitar lance atrasado após espera. Verificar cancelamento, prazo, encerramento, líder, mínimo e disponível com dados atuais.
6. Primeiro lance >= inicial; seguintes >= maior + incremento. Líder atual não cobre a si próprio. Sem reserva do mesmo usuário no mesmo lote em duplicidade.
7. Liberar reserva do líder anterior e reservar valor integral do novo líder **na mesma transação**. Uma carteira em dois lotes também é serializada; não aceitar disponível calculado antes do lock.
8. Gravar lance, alias imutável no payload assinado, sequência, assinatura e atualização do lote; registrar movimentações e idempotência. Novo horário final na janela de U03: `acceptedAt + 120s`. Usar horário anterior se fora da janela. Recusa não prorroga.
9. Commit; gravar checkpoint independente durável em ordem monotônica antes de confirmar/publicar. Falha nessa etapa produz estado de confirmação indeterminada e bloqueia novas mutações do lote até reconciliação; não devolver sucesso falso nem novo débito ao repetir chave.
10. Somente após confirmação, emitir invalidação de lote e eventos privados das carteiras afetadas. Recarregar snapshots autoritativos; nunca incrementar dinheiro otimisticamente no navegador.

Deadlock/erro de serialização: retry limitado a 3 tentativas, repetindo a transação inteira e revalidando relógio/regras; nenhuma chamada externa nem evento antes do commit. Falha definitiva retorna conflito transitório recuperável, sem duplicidade. Configurar timeouts e limite de conexões; não manter transação aberta esperando API ou SSE.

## Encerramento e cancelamento

`settleLot(lotId) -> ClosedLot`: executor periódico curto na API e varredura no startup procuram lotes vencidos. Sob lock do lote e carteiras ordenadas, revalidar fim (pode ter sido prorrogado), liderança e integridade confirmada. Se já liquidado, retornar resultado existente. Sem lance: fechar sem vencedor. Com lance: retirar reserva e debitar total do vencedor, creditar leiloeiro, registrar entradas pareadas e criar recibo único na mesma transação. Nunca debitar também na aceitação do lance.

Índice/constraint de liquidação única protege retries e execuções simultâneas; período de indisponibilidade não perde encerramentos. Lotes vencidos mostram encerrado/resultado em processamento até a confirmação final. Falha de processamento fica em log/health e permite retry, sem retomar lances.

`cancelLot(actor, lotId)`: somente dono leiloeiro, lote não encerrado, zero lances sob o mesmo lock da disputa. Primeiro lance e cancelamento concorrentes têm apenas um resultado válido. Não apagar histórico/lote. Estorno após lances é opcional fora do MVP.

## Integridade: o que precisa ser provado

Hash simples e cabeça guardada apenas no mesmo DB não bastam contra atacante que reescreve a cadeia ou remove seu final. Proposta:

- Cada lance contém payload canônico versionado com `lotId`, `bidId`, **bidderUserId interno**, sequência, alias, valor inteiro, instante aceito e assinatura anterior. HMAC-SHA-256 com chave fora do DB; codificação e precisão explicitamente determinísticas. O vínculo interno também é assinado para impedir troca do usuário debitado preservando o alias. Esse identificador participa apenas da verificação no backend e nunca aparece na projeção pública. Não assinar JSON de ordem variável.
- Criar checkpoint de gênese para cada lote. Manter fora do PostgreSQL uma testemunha durável de `lotId`, contagem, assinatura final e revisão. Diretório montado em volume próprio, não temporário, acesso restrito. Imagens em volume distinto.
- Atualização atômica de arquivo (arquivo temporário, sincronização, rename e sincronização de diretório conforme plataforma) e ordenação por lote. Não permitir substituir checkpoint mais recente por um antigo. Auditar também metadados críticos do lote e vínculo do recibo.
- Auditoria consulta todo o histórico em ordem de sequência, verifica HMAC, continuidade, contagem e cabeça contra a testemunha. Paginação da tela não limita a verificação. Detectar alteração, inserção, remoção do meio/fim, remoção de todo o histórico e remoção do lote com testemunha remanescente.
- Ler conjunto e testemunha como versão estável; se houver commit/checkpoint em andamento, repetir limitadamente ou retornar **INDETERMINATE**, nunca acusar adulteração definitiva só por uma leitura concorrente.
- Estados públicos: **INTACT**, **TAMPERED**, **INDETERMINATE**. Falta/indisponibilidade da testemunha, chave ausente ou gap de confirmação jamais retornam íntegro. Manter resultado explicável em pt-BR.
- Gap após commit e antes do checkpoint não pode ser reparado simplesmente assinando o conteúdo atual do DB. Exigir recuperação baseada em evidência confiável/backup ou manter lote bloqueado. Esse cenário precisa de ensaio antes de aceitar A08. Não prometer recuperação automática que ainda não foi demonstrada.
- No modelo de ameaça, atacante pode modificar o DB, mas não chave/volume da aplicação. Comprometimento simultâneo do host e chave não é resolvido por esta solução. A verificação pública confia no backend; prova criptográfica independente do servidor exigiria assinaturas públicas/testemunha externa, fora do MVP proposto.

**Gate técnico A08:** primeira capacidade técnica de S9, somente após S7/S8 autorizados: demonstrar em teste real alteração direta do DB (inclusive troca de `bidderUserId` preservando alias), truncamento/replay, falha de disco/restart e leitura durante lance. Se não passar, retornar a S5 para rever A08 antes de implementar as demais capacidades; não fazer código experimental durante o freeze. Escala horizontal requer substituir coordenação/testemunha local por armazenamento/coordenador apropriado e rever SSE; não basta subir segunda réplica.

## API e transporte previstos

Prefixo `/api`; contratos em JSON, erros `{ statusCode, code, message, details?, requestId }`, texto pt-BR. `details` contém só erros de campos permitidos. HTTP: 400 entrada inválida, 401 sessão, 403 papel, 404 recurso privado ausente/não autorizado por ownership, 409 conflito/regra de negócio, 429 limite, 503 dependência/confirmacão indisponível. Recusas de R15 têm códigos distintos.

| Endpoint | Permissão / objetivo |
| --- | --- |
| GET /auth/csrf; POST /auth/login; POST /auth/logout; GET /auth/me | Bootstrap de CSRF, sessão e revogação |
| GET /lots; GET /lots/:id; GET /lots/:id/bids | Público; sem cancelados na vitrine; só aliases e valores públicos |
| GET /catalog/search?q=&page=; GET /catalog/items/:externalId | Leiloeiro; proxy validado e limitado do catálogo |
| POST /lots; POST /lots/:id/cancel | Leiloeiro; criação a partir do snapshot confiável; próprio lote |
| GET /seller/lots; GET /seller/summary | Só lotes e recebimentos do leiloeiro autenticado |
| GET /wallet; POST /wallet/deposits | Licitante; próprio saldo; depósito simulado idempotente |
| POST /lots/:id/bids | Licitante; entrada em centavos; idempotência |
| GET /me/bids; GET /me/awards | Próprias participações e arremates |
| GET /lots/:id/audit; GET /receipts/:publicToken | Público, sem dados pessoais; resultado íntegro só com verificação real |
| GET /events?lotId= | SSE público do lote, opcionalmente eventos privados da sessão |
| GET /health/live; GET /health/ready | Saúde sem configuração/segredos expostos |

Rotas específicas vêm antes de `/:id` quando houver conflito. Conteúdos personalizados não entram em cache público. A sessão, e nunca um parâmetro `userId`, identifica destinatário de evento privado. SSE limita conexões, encerra ao expirar/revogar sessão e limpa listeners na desconexão. Payload de invalidação contém ID/revisão sem saldo/PII em canal público. Snapshot inicial, reconexão e polling moderado (proposta: 10s quando canal falha) corrigem eventos perdidos; exibir conexão degradada.

## Metadados do site

Metadados do site são uma exigência adicional de Fernando (U08): seguir [a especificação de head, compartilhamento e indexação](../../metadados.md) e a fronteira [Vercel/API](../../hospedagem.md). A01 usa Next na Vercel com Metadata/generateMetadata no servidor, dados públicos persistidos e escape seguro; HTML inicial sem depender de JS do crawler. Nenhum renderer de head no Nest. Noindex já protege o placeholder; a demo segue esse baseline seguro, com eventual indexação pública sujeita à aprovação de Fernando.

## Catálogo e imagens

Met é autoridade só do item importado, não de lote/lance. Busca oficial atual usa `/public/collection/v1.1/search` paginada; documentação informa retirada de v1/search em 01/10/2026. Não copiar tutorial antigo. Selecionar registros com imagem e licença pública verificada, salvar metadados, origem e imagem própria da aplicação antes de publicar lote. Apenas URLs HTTPS de hosts permitidos, sem redirects para rede privada; validar MIME, assinatura, tamanho e timeout. Nunca permitir URL arbitrária do usuário no importador.

Timeout proposto 5s; no máximo um retry com backoff em GET idempotente para falha transitória/429, respeitando Retry-After e orçamento total. Limitar concorrência de detalhes, cache curto de busca quando necessário. Sem API externa dentro de transação financeira. Se provider cair, busca mostra erro recuperável e lotes persistidos seguem com imagem local ou fallback acessível. Seed usa snapshots reais previamente obtidos com proveniência; não inventar item e dizer que veio da API.

## Segurança e operação

- Senha com hash adequado; sessão aleatória de 256 bits, somente hash no DB, cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, sem Domain e com prefixo `__Host-` quando aplicável. Proposta: duração absoluta 8h, revogação no logout. Segredos gerados fora do repositório.
- CSRF: token vinculado à sessão/pré-sessão e validação de origem exata nas mutações, inclusive login. SameSite não substitui proteção CSRF. Origin ausente não é autorização. Sem CORS wildcard com credenciais.
- Guards/policies centrais para sessão/papel; checar dono de cada lote no backend; entradas DTO explícitas, forbidNonWhitelisted, validação de parâmetros e limites. Projeções públicas independentes, sem email/nome completo/IP/hash/chave de sessão.
- Rate limits proporcionais: login/depósito/importação/lances/auditoria/SSE, com limites finais calibrados no ensaio. Nunca usar segredo de demonstração em produção real; contas de teste são fictícias e sem dados reais.
- CSP e headers de segurança compatíveis com imagens locais e SSE; evitar HTML remoto e `dangerouslySetInnerHTML`; TLS no deploy; DB não exposto publicamente; usuário runtime sem DDL e sem privilégio de owner.
- Logs estruturados e requestId sem senhas/cookies/chaves/PII; health/live não depende de Met. Readiness considera DB/armazenamento local obrigatório; falha de busca externa é degradação, não queda do núcleo.
- Backup/restauração: cópia consistente de DB + mídia + testemunha; chaves com política separada. Propor RPO de 24h e RTO de 2h para a demonstração, a confirmar com hospedagem; ensaiar restauração antes de alegar validade.
- Uma trilha de lint/format, typecheck separado, testes unitários + integração PostgreSQL + E2E, build e CI. Sem serviços de observabilidade duplicados; logs/health e alertas do provedor como baseline, error tracking a decidir conforme hosting.
- Sem promessa de segurança absoluta ou de escala ilimitada. Critério é evidência dos invariantes e ameaças definidos.

## Fontes técnicas consultadas

- [PostgreSQL — locks e deadlocks](https://www.postgresql.org/docs/18/explicit-locking.html) e [relógios transacionais/reais](https://www.postgresql.org/docs/18/functions-datetime.html): fundamentam a proposta de concorrência.
- [OWASP — sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) e [senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): fundamentam a proposta de autenticação.
- [Met Collection API — documentação oficial](https://metmuseum.github.io/): origem, Open Access e mudança de endpoint. Ainda falta smoke da API/imagem reais.

As técnicas de auditoria e a topologia são propostas deste plano; as fontes acima não atestam que a implementação exista ou seja segura.
