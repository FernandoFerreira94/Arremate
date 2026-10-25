# Arremate — splash e montagem das telas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executar somente esta extensão visual; preservar o plano principal e trabalho de outras janelas.

**Goal:** splash temático de3s na primeira visita da sessão e entrada sequencial nas trocas de rota, sem reanimar lances/saldos.
**Architecture:** CSS nativo; script estático pequeno antes do conteúdo para decidir a sessão sem flash; wrapper cliente só para identificar pathname. Nenhuma dependência ou configuração nova, nenhum backend alterado.
**Tech Stack:** Next/React existentes, CSS, sessionStorage e Playwright.
**Spec:** direção aprovada por Fernando em24/10/2026: “Aprovar e implementar”; identidade D01–D12/HANDOFF-GROK preservada.

## Global Constraints

- Fundo papel, monograma A bordô/Fraunces, moldura latão, sem som, sem nova marca/cores.
- Splash apenas no primeiro acesso da sessão da aba; troca de rota/paginação não repete. Se storage falhar ou movimento reduzido estiver ativo, omitir splash.
- Entrada com fade e deslocamento até8px; cada movimento850ms conforme D19, defasagem curta entre blocos/cards. Camada temporária acima do shell, sem mudar z-index de diálogos.
- Interação por ponteiro/teclado/foco cancela a introdução imediatamente. Sem bloquear dados/API, sem fake progress, sem esperar imagens/consulta para liberar tela.
- HTML continua legível sem JS; animações desativadas com movimento reduzido/impressão; nada de esconder conteúdo permanentemente.
- Atualização de preço/cronômetro/saldo não remonta a árvore nem reinicia animações. Sem dados pessoais ou autenticação em sessionStorage.
- Tokens/guia existentes são autoridade. .design-system será índice documentado do código/HANDOFF, sem uma direção visual concorrente.

## Review Focus

1. SSR aparece antes de hidratar: cobertura precisa ser decidida antes do body, não após carregar React.
2. Storage bloqueado/JS desativado: página segue utilizável, sem splash infinito.
3. Movimento reduzido e teclado durante splash: acesso imediato e sem foco invisível.
4. Atualização ao vivo e navegação: nenhuma repetição do splash nem animação de preço/saldo.
5. Barras fixas mobile, diálogos e impressão: não ganhar ancestor transform persistente.

## Files / interfaces

- Criar `front-end/src/components/app/brand-intro.tsx`: script estático e markup decorativo de marca, sem dado externo interpolado.
- Criar `front-end/src/components/app/page-entrance.tsx`: `PageEntrance({children})`, chave somente pathname; dados atualizados não alteram chave.
- Modificar `front-end/src/app/layout.tsx`: script antes do conteúdo e integração dos dois componentes.
- Modificar `front-end/src/app/globals.css`: tokens de motion, sequência, reduced-motion e impressão.
- Criar `e2e/entry-motion.spec.ts`: SSR, sessão, navegação, live rerender, reduced-motion, storage indisponível, teclado e no-JS.
- Documentar extração em `.design-system/{README,colors,typography,components,layouts,icons,animations,responsive,accessibility,examples}.md`; links para fontes reais, sem duplicar o design congelado.
- Atualizar DESIGN.md, HANDOFF-GROK (somente adição de motion aprovada), decisões, plano principal, Lifecycle, README/Notion e evidência desta extensão.

## Tarefa 1 — Comportamento e implementação

- [x] Registrar baseline, fontes e bootstrap documental do design existente.
- [x] Escrever E2E que exige markup/script antes do body, splash por sessão e entrada; executar e observar vermelho pela capacidade ausente.
- [x] Implementar os quatro arquivos de produto listados, sem alterar dados/regras/componentes financeiros.
- [x] Rodar E2E: splash termina; reload/navegação não repetem; contador atualiza sem novo animationstart; reduced-motion/no-JS/storage bloqueado não escondem conteúdo; teclado cancela; layout mobile e impressão permanecem utilizáveis.
- [x] Rodar unitários frontend, tipos, lint e build; validar screenshot desktop/mobile. Publicar nenhuma URL externa.
- [x] Review independente do diff e correções; registrar comandos/saídas/limites e sincronizar documentação/Notion. Commit/push não fazem parte deste pedido.

## Auto-revisão

Escopo é somente a dinâmica de entrada aprovada, sem efeitos contínuos, novas libs ou mudança de identidade. Critérios de sessão/acessibilidade/falhas estão nos testes. A escrita de storage contém apenas “seen”; não toca cookies, credenciais ou saldo. Plano escrito antes do produto; checkboxes são atualizados somente após evidência.

## D19 — Ritmo mais lento — 24/10/2026

- [x] A pedido de Fernando, substituir tempos iniciais por splash3000ms e entradas850ms, saída800ms e defasagens100–600ms.
- [x] Preservar foco visível/interrupção persistente até próxima rota, sem nova dependência.
- [x] Validar6checks isolados em navegador com API mockada; tempo observado3006ms. Tipos/lint/build frontend conferidos.
- [x] Repetir suíte integrada com Docker ativo:20E2E passaram no build próprio e PostgreSQL isolado de teste; exit0. Bloqueio de readiness anterior resolvido.
