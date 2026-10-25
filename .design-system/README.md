# Design system — índice do código existente

Extração em24/10/2026 antes da extensão de motion. Fonte visual aprovada: [HANDOFF-GROK](../docs/design/HANDOFF-GROK.md); mapa de implementação: [DESIGN.md](../DESIGN.md). Este diretório aponta padrões existentes; não é outra fonte de tokens ou outra direção visual.

- [Cores](colors.md), [tipografia](typography.md), [componentes](components.md), [layouts](layouts.md).
- [Ícones](icons.md), [animações](animations.md), [responsivo](responsive.md), [acessibilidade](accessibility.md), [exemplos](examples.md).

## Inconsistências observadas

O HANDOFF define toque44px; Button sm usa h-9 (36px): [front-end/src/components/ui/button.tsx:19](../front-end/src/components/ui/button.tsx). Apenas registrado; alterar dimensões não pertence à extensão de motion. O front AGENTS ainda contém frases históricas de espera por design, enquanto a raiz/DESIGN/HANDOFF registram o freeze já implementado; usar a decisão D12/D13 vigente.
