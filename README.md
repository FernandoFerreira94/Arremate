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

O seed cria 1 leiloeiro, 5 licitantes, 1 lote aberto sem lances e um catálogo de 24 obras com lotes **ao vivo com lances abertos**, lotes na reta final, agendados e encerrados com comprovante.

## Como rodar (local)

Pré-requisitos: Node 24.22.1 (`.nvmrc`), Docker com Compose e internet no primeiro seed.

1. `npm ci`
2. Copie `.env.example` para `.env`. Preencha as três senhas de banco com valores aleatórios (as mesmas dentro de `DATABASE_URL` e `TEST_DATABASE_URL`) e acrescente `AUDIT_HMAC_KEY`, gerada com
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. `npm run db:up` — PostgreSQL 18 de desenvolvimento em `127.0.0.1:5462` e de teste em `5463`.
4. Migrations, com o papel dono do banco (a API usa outro papel, sem DDL): em `back-end/`, com `DIRECT_URL=postgresql://auction_owner:<DB_OWNER_PASSWORD>@127.0.0.1:5462/casadeleilao` no `.env`, rode `npx prisma migrate deploy`. Para os testes de integração e E2E, repita com a URL do banco de teste (`5463/casadeleilao_test`).
5. `npm run dev:api` (API em 4300) e, em outro terminal, `npm run dev:web` (site em http://127.0.0.1:3300).
6. `npm run db:seed --workspace back-end` — dados de demonstração. Reexecutar não duplica nada; `npm run db:reset-demo --workspace back-end` seguido do seed volta a demo ao começo.

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
| Unit do front (Vitest) | `npm run test:unit --workspace front-end` | 127/127 |
| Integração com PostgreSQL real | `npm run test:integration` | 133/133 |
| E2E (Playwright, build de produção, banco e portas próprios) | `npx playwright test --workers=1` | 82/82 |
| Lint, tipos e build | `npm run lint`, `npm run typecheck`, `npm run build` | ok |

O CI (`.github/workflows/ci.yml`) migra um banco vazio, roda o seed duas vezes, audita dependências e roda todas as suítes.

## Comportamentos que podem surpreender

- **Anti-sniping relativo ao lance:** o lote passa a terminar 2 min depois do lance aceito, não 2 min depois do fim anterior.
- **Liquidação em até ~1 s:** ao zerar o cronômetro, o lote aparece como “apurando” por um instante antes do resultado.
- **Até 3 conexões ao vivo por IP:** a partir da 4ª aba aberta na mesma rede, a sala usa polling de 10 s em vez de SSE.
- **Limites de login e de mutação em memória** de uma instância; não são distribuídos.
- **Splash de entrada** só no primeiro acesso da sessão (3 s, pula com qualquer tecla ou clique; aba anônima para rever).
- **Licitantes automáticos** (`DEMO_BOTS=1`) cobrem lances de pessoas até um teto, pelas mesmas regras e com a mesma auditoria.
- **Seed sem internet:** obras do catálogo que falham geram só um aviso; o lote base continua sendo criado.
- **Login com Google** aparece desabilitado sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`.
- **Extras além do pedido:** cadastro, cartão de teste e Pix simulados na carteira, favoritos, “Avise-me”, notificações, zoom da obra e tour guiado.
- **Não verificado:** Safari/Firefox e aparelho físico.

## Uso de IA

- **Onde usei:** planejamento e quebra em tarefas, pranchas de UI (Grok), código do front e da API (Codex e Claude Code), testes, uma revisão de segurança independente e QA navegando como usuário.
- **Como usei:** a IA escreveu a maior parte do código dentro de um processo que eu defini: cada entrega com testes e evidência em `docs/evidence/`, e nenhuma dependência, push ou deploy sem a minha validação. As escolhas relevantes estão registradas, com alternativas, em `docs/decisoes.md`.
- **O que revisei e ajustei:** a revisão de segurança achou o login travado por um IP único atrás do proxy e cabeçalhos ausentes no front, corrigidos com teste. O QA achou a sala mostrando “superado” e “ganhando” ao mesmo tempo e recusas de regra exibidas como erro do sistema; corrigi e cobri com E2E. O cadastro, o Google e os pagamentos simulados foram começados pelo Codex e terminados com o Claude Code. Também corrigi o próprio README quando ele afirmava algo que o código não sustentava, como a chave de auditoria e a migration que faltavam no passo a passo.

Como o projeto foi construído, tarefa a tarefa: [diário de construção](docs/diario-construcao.md).
