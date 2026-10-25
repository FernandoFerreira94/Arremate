# Evidência — entrada animada do Arremate

24/10/2026, Windows/Node24, build Next16.4.2 local em http://127.0.0.1:3300. Escopo: quatro arquivos de produto (BrandIntro, PageEntrance, layout e globals.css), um arquivo E2E e documentação. Backend/credenciais/dependências/configuração não alterados por esta extensão. Há mudanças de outras janelas no checkout; preservadas.

## Autorização e comportamento

Fernando aprovou “Aprovar e implementar” para splash~800ms por sessão e montagem com fade/até8px. CSS nativo, bordô/latão/papel e A/Fraunces existentes, sem som ou nova dependência. O script estático decide antes do body; não interpola dados de request, PII ou HTML externo. sessionStorage guarda apenas `arremate:intro:v1=seen`. Falha do storage/reduced-motion omite splash. Teclado/ponteiro/foco cancelam imediatamente, sem captura de foco/bloqueio da API. Sem JS a introdução não aparece.

PageEntrance identifica apenas pathname; mesma rota/dados atualizados preservam os nós e não reiniciam animações. Grupos usam opacity para preservar CTAs fixos; títulos/itens usam até8px e terminam sem transform persistente. Estado financeiro continua no backend.

## Testes e verificações executados

| Check | Resultado |
| --- | --- |
| E2E inicial antes de implementar | FAIL esperado: script/splash inexistentes,1teste |
| `npm run test:unit --workspace front-end` | PASS49testes/14arquivos, exit0 |
| `npm run typecheck` | PASS front/back/tools, exit0 |
| `npm run lint` | PASS front/back, exit0 |
| `npm run build --workspace front-end` | PASS build de produção, exit0 |
| E2E final: entry-motion, bootstrap, public-pages, metadata, private-journeys; workers1 | PASS20testes no next start, exit0 |
| Inspeção Playwright/screenshot1440×1000 e390×844 | Sem overflow horizontal; composição revista |
| Review independente | Sem bug concreto de produto; lacunas de evidência complementadas |

Comando E2E: `npm run test:e2e -- entry-motion.spec.ts bootstrap.spec.ts public-pages.spec.ts metadata.spec.ts private-journeys.spec.ts --workers=1`. O executor invocou npm pelo npm-cli.js oficial com Node24 para evitar o rewrite de comandos do RTK deste host.

### O que os testes de motion comprovam

- Primeiro frame observado por requestAnimationFrame: splash ativo/visível, viewport coberto e fundo papel; script no head antes do body; nenhum warning de hidratação observado; checagem também captura pageerror e erro React minificado (teste focado repetido e aprovado).
- Fim da introdução, flag por sessão, reload/navegação sem repetição; montagem acompanha pathname.
- Relógio renderiza novamente sem reentradas. Outro licitante dá lance via API real; preço atualiza pelo canal ao vivo e não há novo animationstart `entry-*`.
- Depósito simulado confirmado pela UI muda saldo sem reiniciar montagem. CTA inferior mobile permanece na base do viewport. Impressão não contém splash.
- Movimento reduzido, storage bloqueado, teclado/foco e contexto sem JS deixam o shell acessível.

### Falhas investigadas durante a execução

- Seletor de teste usava “E-mail”, enquanto o produto tem label “Email”; corrigido o teste, sem mudar o formulário.
- Tab era pressionado antes de existir o body: teste agora aguarda o skip link anexado.
- Contador de reentrada era iniciado enquanto a montagem inicial estava pausada pelo splash; passou a aguardar fim da introdução e de animações running/paused antes de medir atualizações.
- No-JS no build de produção não possui h1 da vitrine porque o componente preexistente usa useSearchParams/Suspense. O teste verifica logo/footer SSR acessíveis e splash oculto; não declara que o produto inteiro funcione sem JS.

## Review, segurança e limites

Revisor independente leu código e consumidores sem alterar arquivos nem executar servidores. Não encontrou bug concreto; apontou falta de observação do primeiro frame e de preço/saldo nos testes, suprida pelos casos acima. Script é constante, sem eval/HTML remoto/token; handlers da introdução removidos ao encerrar e em pagehide. Nenhuma mudança em cookies/auth/guard/DTO/money/DB foi feita nesta extensão.

Screenshots em `screenshots/entrada-2026-10-24/`: vitrine-desktop/mobile e splash-desktop/mobile. Os frames do splash foram congelados aos350ms **somente para inspeção visual**; o timing/cobertura real é observado separadamente no E2E. Não é vídeo de performance nem ensaio em celular físico.

Limites: não executada a suíte financeira inteira/2min de liquidação, nem deploy/CI remoto, navegador Safari/Firefox ou aparelho físico. A UI dinâmica preexistente requer JS. A produção futura com CSP baseada em nonce/hash deve autorizar o bootstrap estático assim como os scripts Next; nenhuma política CSP foi relaxada. Sem promessa de readiness de produção.

Sem commit/push/deploy nesta extensão. Plano/checkpoints, decisão D17, HANDOFF, DESIGN, .design-system e README/Notion atualizados no mesmo trabalho. Release geral do desafio não é concluído por estes checks visuais.

Plano sincronizado no Notion: [Entrada animada](https://app.notion.com/p/403d66ddfe9381ab8741d208e8617e55).

## D19 — Ritmo mais lento — 24/10/2026

Pedido de Fernando:3s e entradas mais lentas. Implementado timer3000ms/saída2200+800; componentes850ms; moldura1200ms; nome900ms; cards espaçados100–600ms. A fase intermediária2s/450ms foi substituída antes desta validação.

Teste de duração inicialmente comprovou vermelho no código antigo:799,5ms observado contra mínimo1500ms. A versão final exige mínimo2500ms/timeout6s no E2E. Browser isolado (node e2e/entry-motion-isolated.cjs):PASS6checks, splash3006ms, entrada850ms. API mockada apenas no harness; nenhum dado de negócio foi alterado para essa prova. Casos: duração/entrada, sessão, foco+blur, reduced-motion, storage bloqueado e shell sem JS.

Typecheck/lint frontend passaram. Build frontend validado após a calibragem. Review independente confirmou sincronismo e proteção de foco. A ressalva de foco em bloco ainda transparente foi corrigida com data-entry-interrupted persistente no wrapper keyed por pathname; não reanima ao desfocar.

E2E integrado desta revisão:BLOCKED pelo ambiente, Docker Desktop engine indisponível; readiness da API de teste4310 não confirmou e o Playwright terminou após120s antes dos testes. Não executar migrações, mudar configuração ou iniciar containers de outros projetos para contornar um teste visual. Os20E2E/49unitários anteriores acima pertencem à versão inicial e não foram repetidos integralmente nesta calibragem. Teste isolado não substitui teste financeiro integrado.

## Revalidação integrada D19 — Docker ativo — 24/10/2026

Docker confirmado: db e db-test running/healthy. A suíte foi repetida com splash3000ms e componentes850ms, em build de produção próprio do E2E (web3310/API4310) e PostgreSQL real isolado de teste5463.

Comando: npm run test:e2e -- entry-motion.spec.ts bootstrap.spec.ts public-pages.spec.ts metadata.spec.ts private-journeys.spec.ts --workers=1.

Resultado observado:20passed em1,2min, exit0. Inclui duração do splash, sessão/navegação, reduced-motion, teclado, storage bloqueado, shell sem JS, atualização real de preço por SSE e depósito sem novas entradas, metadados/privacidade, jornadas dos papéis e menu/depósito mobile. O bloqueio anterior do Docker foi resolvido. Não foi repetida a suíte financeira completa de liquidação; isso não declara release/deploy pronto. Sem alteração de código, migration ou configuração nesta revalidação.
