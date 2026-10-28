# Arremate — Casa de Leilões online (Desafio Verzel)

> **Aplicação publicada:** _pendente — o link entra aqui assim que o deploy for verificado._
> **Repositório:** https://github.com/FernandoFerreira94/Arremate

Leilões de obras de arte de acervo público (The Met). O leiloeiro busca obras na API do museu e cria lotes; o licitante deposita saldo simulado, dá lances ao vivo e recebe um comprovante quando arremata. Toda a regra de dinheiro fica no back-end, e uma página pública de auditoria detecta qualquer adulteração do histórico, inclusive feita direto no banco.

## Contas de demonstração

| Papel | E-mail | Observação |
| --- | --- | --- |
| Leiloeiro | `leiloeiro@arremate.demo` | Dono dos lotes do catálogo |
| Licitante | `licitante1@arremate.demo` | Começa com saldo e sem lances |
| Licitante | `licitante2@arremate.demo` | Tem lances abertos em lotes ao vivo |

Na tela **Entrar**, os botões “Entrar como licitante de teste” e “Entrar como leiloeiro de teste” dispensam a senha. A senha das contas é pública e está na constante `DEMO_PASSWORD_DEFAULT` de [`back-end/prisma/seed.ts`](back-end/prisma/seed.ts). Também existem `licitante3` a `licitante5`, usados no histórico do catálogo.

O seed cria 1 leiloeiro, 5 licitantes, 1 lote aberto sem lances e um catálogo de 36 obras com lotes **ao vivo com lances abertos**, lotes na reta final, agendados e encerrados com comprovante.

## Demonstração publicada (modo demo, sem servidor)

O link publicado é só o front-end na Vercel, com `NEXT_PUBLIC_DEMO_MODE=1`. Nesse modo não existe API nem banco: o código em [`front-end/src/demo/`](front-end/src/demo/) responde às mesmas rotas que o front chama, direto no navegador, e guarda o estado no `localStorage` (cada visitante tem a sua demo; o aviso no topo tem **Reiniciar demo**).

- **Mesmas regras do back:** lance mínimo, quem lidera não cobre o próprio lance, saldo reservado para quem está ganhando e liberado quando é superado, lance nos últimos 2 minutos estende o lote por mais 2, e no fim o vencedor é debitado, o leiloeiro creditado e o comprovante emitido. A ordem das recusas copia `back-end/src/lots/bid-rules.ts`, e os testes ficam em `front-end/src/demo/engine.test.ts`.
- **Mesmos dados do seed:** as 36 obras de `back-end/prisma/seed-catalog.ts`, com lances, agendados e encerrados. `node scripts/demo-snapshot.mjs` gera `artworks.json` e as imagens a partir da API do Met. A busca do leiloeiro chama a API do Met direto do navegador.
- **Ao vivo:** licitantes automáticos dão lances a cada 30 s com a aba aberta, e outras abas do mesmo navegador recebem o aviso pelo `BroadcastChannel`.
- **Auditoria:** cadeia SHA-256 dos lances com uma testemunha guardada à parte. Na página de auditoria, **Simular adulteração no banco** altera um lance sem refazer a cadeia, como um `UPDATE` manual faria, e a verificação passa a mostrar **Adulterado**. A garantia é mais fraca que a do back (não há chave HMAC nem testemunha fora do alcance de quem altera, porque tudo está no navegador). A versão completa é a do servidor, descrita em [Auditoria à prova de adulteração](#auditoria-à-prova-de-adulteração).

Para avaliar o sistema de verdade, com Postgres, SSE e a auditoria com HMAC, rode localmente pelos passos abaixo. A demo também roda local: `NEXT_PUBLIC_DEMO_MODE=1 npm run build --workspace front-end` e depois `npm run start --workspace front-end`.

## Como rodar (local)

Pré-requisitos: Node 24.22.1 (`.nvmrc`), Docker com Compose e internet no primeiro seed.

1. `npm ci`
2. Copie `.env.example` para `.env`. Preencha as três senhas de banco com valores aleatórios (as mesmas dentro de `DATABASE_URL` e `TEST_DATABASE_URL`) e acrescente `AUDIT_HMAC_KEY`, gerada com
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. `npm run db:up` — PostgreSQL 18 de desenvolvimento em `127.0.0.1:5462` e de teste em `5463`.
4. Migrations, com o papel dono do banco (a API usa outro papel, sem DDL): em `back-end/`, com `DIRECT_URL=postgresql://auction_owner:<DB_OWNER_PASSWORD>@127.0.0.1:5462/casadeleilao` no `.env`, rode `npx prisma migrate deploy`. Para os testes de integração e E2E, repita com a URL do banco de teste (`5463/casadeleilao_test`).
5. `npm run db:seed --workspace back-end` — dados de demonstração. Reexecutar não duplica nada; `npm run db:reset-demo --workspace back-end` seguido do seed volta a demo ao começo. O seed espera cerca de 2,5 min no fim para liquidar os lotes encerrados pelo fluxo normal. Rode o seed com a API parada: a fila da testemunha da auditoria é por processo, e seed e API escrevendo no mesmo lote ao mesmo tempo podem abortar o seed (o dinheiro não corre risco; basta rodar de novo).
6. `npm run dev:api` (API em 4300) e, em outro terminal, `npm run dev:web` (site em http://127.0.0.1:3300). Se a API parou no meio de uma confirmação da auditoria, ela tenta de novo ao subir; `npm run audit:retry` faz o mesmo manualmente.

Opcional: `DEMO_BOTS=1` no `.env` liga licitantes automáticos que cobrem o seu lance, para ver o tempo real sem abrir duas contas.

## Roteiro rápido de avaliação

1. Entre como licitante, abra **Carteira** e faça um depósito simulado. Veja total, comprometido e disponível.
2. Abra um lote ao vivo e dê um lance. Em outra janela anônima, entre com `licitante2` e cubra o lance: a primeira janela atualiza sozinha, avisa “Você foi superado” e o valor volta ao disponível.
3. Tente as recusas: lance abaixo do mínimo, sem saldo, cobrindo a si mesmo, lote agendado e lote encerrado. Cada uma tem mensagem própria.
4. Dê um lance nos últimos 2 minutos de um lote da reta final e veja o fim ser prorrogado.
5. Abra um lote encerrado: comprovante público, apelidos no lugar de nomes e a auditoria com o resultado “íntegro”.
6. Como leiloeiro: busque uma obra no The Met, crie um lote com lance inicial, incremento, início e fim, e cancele um lote sem lances. O painel mostra resultados e o total recebido.
7. Prove a detecção de adulteração (abaixo).

## Regras de negócio e onde são garantidas

| Regra | Como funciona |
| --- | --- |
| Janela do lance | Só entre início e fim, pelo relógio do PostgreSQL lido depois dos locks. |
| Valor mínimo | Primeiro lance ≥ inicial; os seguintes ≥ atual + incremento. Quem lidera não cobre o próprio lance. |
| Saldo reservado | Disponível = total − comprometido. O valor de quem lidera fica comprometido; quando é superado, volta ao disponível na mesma transação. Só aceita lance que caiba no disponível, mesmo com lances em vários lotes. |
| Anti-sniping | Lance aceito nos últimos 2 min faz o lote terminar **2 min depois desse lance** (`fim = aceite + 120 s`). Lance recusado não estende. |
| Liquidação | Um runner na API (a cada 1 s e no startup) debita o vencedor, credita o leiloeiro e emite o comprovante numa transação. Lote sem lance fecha sem vencedor. |
| Concorrência | Lote travado com `FOR UPDATE`, carteiras travadas sempre em ordem de ID (evita deadlock entre lotes), retry em deadlock e serialização. Testado com 20 licitantes simultâneos no PostgreSQL real. |
| Idempotência | `Idempotency-Key` em lance, depósito e publicação: repetir a requisição não duplica; outro corpo com a mesma chave dá conflito. |
| Dinheiro | Centavos em `BigInt`, ledger `wallet_entries` (depósito, reserva, liberação, débito, crédito). |
| Privacidade | Auditoria e comprovante mostram apelidos por lote (“Licitante 3”), nunca nome ou e-mail. |
| API externa fora | A obra vira snapshot com imagem local (sha256 conferido) ao publicar; vitrine, sala, auditoria e comprovante não dependem do The Met. |

## Auditoria à prova de adulteração

Cada evento do lote (abertura, lance, prorrogação, liquidação) é assinado com **HMAC-SHA-256**, e a assinatura inclui a do evento anterior, formando uma cadeia. A cadeia fica no PostgreSQL. A chave fica só no ambiente da API, e o último checkpoint (quantos eventos e qual a última assinatura) fica numa **testemunha em disco, fora do banco**. A página pública `/lotes/:id/auditoria` recalcula a cadeia inteira:

- alterar um lance muda o conteúdo assinado e quebra o HMAC (`CHAIN_MISMATCH`);
- inserir um lance sem a chave não gera assinatura válida;
- apagar lances, inclusive os últimos, deixa o histórico menor que a testemunha (`HISTORY_TRUNCATED`);
- apagar o lote com a testemunha restante dá `LOT_REMOVED`;
- mudar `lots.status` direto no banco (por exemplo `CANCELLED`) dá `STATUS_MISMATCH`: o cancelamento é selado no envelope da testemunha;
- sem chave ou sem testemunha, o resultado é “indeterminado”, nunca “íntegro”.

**Prove você mesmo (banco local):** abra a auditoria de um lote com lances e confira “íntegro”. Depois rode no banco de desenvolvimento

```sql
UPDATE bids SET amount_cents = amount_cents + 100
WHERE id = (SELECT id FROM bids ORDER BY created_at DESC LIMIT 1);
```

e recarregue a auditoria desse lote: o resultado passa a “adulterado”, e a API bloqueia novas mutações nele. Limite assumido: quem tiver a chave e a testemunha ao mesmo tempo consegue forjar. Detalhes em [operação da integridade](docs/operacao-integridade.md).

## Arquitetura

```
navegador ──> Next.js (App Router, 3300) ──/api──> NestJS (4300) ──> PostgreSQL
                 páginas SSR e áreas por papel        regras, sessão,       │
                 proxy same-origin com cookie         lances, liquidação    └─ testemunha da
                                                      SSE por lote              auditoria em disco
```

- **Front:** Next.js 16 + React 19 + TypeScript strict + Tailwind 4 + shadcn. O front nunca decide dinheiro nem estado; nada é atualizado de forma otimista.
- **API:** NestJS, monólito modular. Sessão opaca em cookie HttpOnly (só o hash no banco), CSRF com Origin exato, Argon2id, CSP com nonce.
- **Banco:** PostgreSQL 18 com Prisma 7 nas migrations e SQL parametrizado no caminho do lance. A API usa um papel sem DDL.
- **Tempo real:** SSE por lote, com polling de 10 s se o canal cair.
- **Por que assim:** um monólito com as regras num só lugar é mais simples de provar correto em 7 dias do que serviços separados ou regras no banco. O custo assumido é rodar uma instância só.

Decisões e alternativas descartadas: [docs/decisoes.md](docs/decisoes.md).

## Testes

| Suíte | Comando | Última rodada (26/10) |
| --- | --- | --- |
| Unit da API (Jest) | `npm test` | 93/93 |
| Unit do front (Vitest) | `npm run test:unit --workspace front-end` | 132/132 |
| Integração com PostgreSQL real | `npm run test:integration` | 134/134 |
| E2E (Playwright, build de produção, banco e portas próprios) | `npx playwright test --workers=1` | 87/87 |
| Lint, tipos e build | `npm run lint`, `npm run typecheck`, `npm run build` | ok |

O CI (`.github/workflows/ci.yml`) migra um banco vazio, roda o seed duas vezes, audita dependências e roda todas as suítes.

## Opcionais do PDF

| Opcional | Situação |
| --- | --- |
| Busca e filtro | Feito: abas ao vivo, agendados, encerrados e "encerrando hoje", mais busca por nome da obra ou do artista no header (`GET /api/lots?q=`). |
| Estorno no cancelamento | Não se aplica por regra: o leiloeiro só cancela lote **sem lances**, então não há saldo reservado para devolver. Permitir cancelar com lances mexeria nas regras de lance a dias da entrega; ficou de fora de propósito. |
| Docker Compose | Feito: `compose.yaml` sobe os bancos para desenvolvimento; `compose.deploy.yaml` sobe PostgreSQL + site + API + Caddy com HTTPS ([docs/deploy.md](docs/deploy.md)). |
| Testes | Feito: unit, integração em PostgreSQL real, E2E com Playwright e CI (seção acima). |
| Dark mode | Feito: segue o sistema e tem alternador no header; a escolha fica salva no navegador. |

## Comportamentos que podem surpreender

- **Anti-sniping relativo ao lance:** o lote passa a terminar 2 min depois do lance aceito, não 2 min depois do fim anterior.
- **Liquidação em até ~1 s:** ao zerar o cronômetro, o lote aparece como “apurando” por um instante antes do resultado.
- **Até 3 conexões ao vivo por IP:** a partir da 4ª aba aberta na mesma rede, a sala usa polling de 10 s em vez de SSE.
- **Limites de login e de mutação em memória** de uma instância; não são distribuídos.
- **Splash de entrada** só no primeiro acesso da sessão (3 s, pula com qualquer tecla ou clique; aba anônima para rever).
- **Licitantes automáticos** (`DEMO_BOTS=1`) cobrem lances de pessoas até um teto, pelas mesmas regras e com a mesma auditoria.
- **Seed sem internet:** obras do catálogo que falham geram só um aviso; o lote base continua sendo criado.
- **Login com Google** aparece desabilitado sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`.
- **Tema:** sem escolha salva, o site segue o tema claro/escuro do sistema operacional.
- **Busca:** procura no título e no artista, sem diferenciar maiúsculas; `%` e `_` digitados contam como texto, não como curinga.
- **Extras além do pedido:** cadastro, cartão de teste e Pix simulados na carteira, favoritos, “Avise-me”, notificações, zoom da obra e tour guiado.
- **Não verificado:** Safari/Firefox e aparelho físico.

## Como o projeto foi construído

_Na voz dos agentes que construíram o Arremate. Texto completo em [docs/narrativa-agentes.md](docs/narrativa-agentes.md) e, tarefa a tarefa, no [diário de construção](docs/diario-construcao.md)._

Nós somos os agentes de IA que construíram o Arremate, dentro de uma arquitetura que o Fernando projetou. Antes da primeira linha de código ele já tinha desenhado o caminho: um ciclo de vida em treze estágios (S0 a S12) que funciona como máquina de estados. Nenhum de nós escolhe a próxima etapa pela memória da conversa; lemos o Lifecycle Control e avançamos pelo primeiro gate ainda não cumprido ([docs/lifecycle.md](docs/lifecycle.md)).

**Quem fez o quê**

- **Orquestrador:** leu o enunciado, quebrou o trabalho em tarefas pequenas e conduziu os gates. Nenhuma etapa avançou sem a saída exigida pelo gate anterior.
- **Fred, designer de UI/UX:** desenhou as pranchas e o design system antes de qualquer componente novo. Hero, header e footer foram escolhidos entre três variações dele; a interface saiu das pranchas congeladas (Design Freeze D12, adendo D21), não o contrário.
- **Executores (Codex e Cursor/Claude Code):** implementaram cada tarefa com testes e deixaram a evidência em `docs/evidence/`.
- **QA/E2E:** rodou os testes ponta a ponta num mundo à parte, com build, portas e banco próprios, navegando como usuário.

**Passo a passo**

1. **Ideia, validação e produto (S0 a S2):** o desafio virou um intake sem negócio inventado; o escopo técnico passou com condições (dinheiro simulado, qualidade) e o produto foi descrito a partir do PDF.
2. **Pesquisa e prontidão (S3 e S4):** a lacuna do anti-sniping foi levada ao Fernando e resolvida por ele; as escolhas técnicas ficaram registradas como abertas.
3. **Arquitetura e design (S5 e S6):** propusemos a arquitetura; o Fernando aceitou os riscos em aberto e aprovou as pranchas HTML/PNG como fonte visual (D09 a D13).
4. **Boot do repositório:** pasta, dependências, bancos isolados, health check e placeholder técnico, sem nenhuma tela final antes do design.
5. **Desenvolvimento, tarefa a tarefa:** núcleo de dinheiro e schema (Tarefa 1), cadeia HMAC com testemunha fora do banco para a auditoria (Tarefa 2), sessão, CSRF e papéis (Tarefa 3), e depois lances ao vivo, liquidação, carteira, entrada animada, cadastro, Google e pagamentos simulados. Cada tarefa fechou com teste e evidência.
6. **Saúde e release:** revisão de segurança independente, rodadas de QA e correções cobertas por E2E antes de qualquer publicação.

**Onde paramos para o Fernando decidir:** troca de decisão já congelada, direção visual com mais de uma opção válida, credencial, produção, gasto real ou ação destrutiva. Nesses pontos levamos as alternativas e o trade-off, e ele decidiu pelo critério. Foi assim que entraram `@node-rs/argon2` (D15) e `radix-ui` (D16), cada uma com motivo em `docs/decisoes.md`.

**O que aprendemos a respeitar:** planejado não é executado, e o que não verificamos fica marcado como **não verificado**. Commits pequenos com diff conferido, migration só no banco local e nada hospedado sem validação humana. O Fernando projetou a arquitetura; nós executamos dentro dela, e cada entrega passou pelo olhar dele antes de virar produto.

## Uso de IA

- **Onde usei:** planejamento e quebra em tarefas, pranchas de UI (Grok), código do front e da API (Codex e Claude Code), testes, uma revisão de segurança independente e QA navegando como usuário.
- **Como usei:** a IA escreveu a maior parte do código dentro de um processo que eu defini: cada entrega com testes e evidência em `docs/evidence/`, e nenhuma dependência, push ou deploy sem a minha validação. As escolhas relevantes estão registradas, com alternativas, em `docs/decisoes.md`.
- **O que revisei e ajustei:** a revisão de segurança achou o login travado por um IP único atrás do proxy e cabeçalhos ausentes no front, corrigidos com teste. O QA achou a sala mostrando “superado” e “ganhando” ao mesmo tempo e recusas de regra exibidas como erro do sistema; corrigi e cobri com E2E. O cadastro, o Google e os pagamentos simulados foram começados pelo Codex e terminados com o Claude Code. Também corrigi o próprio README quando ele afirmava algo que o código não sustentava, como a chave de auditoria e a migration que faltavam no passo a passo.
- **Modo demo da Vercel:** o simulador de `front-end/src/demo/` foi escrito com o Claude Code a partir das regras do back, com testes próprios e verificado no navegador (lance, reserva, anti-sniping, liquidação, comprovante e adulteração detectada). A decisão de publicar só o front com o back simulado foi minha, para manter custo zero; o back real segue no repositório.

Roteiro para explicar as decisões em voz alta: [como explicar o projeto](docs/entrevista.md).
