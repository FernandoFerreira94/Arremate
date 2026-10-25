# Motion existente

Baseline antes da extensão: Button transition-colors/duration150/ease-out em [front-end/src/components/ui/button.tsx:7](../front-end/src/components/ui/button.tsx); Skeleton animate-pulse em [front-end/src/components/ui/skeleton.tsx:4](../front-end/src/components/ui/skeleton.tsx); regra global reduced-motion em [front-end/src/app/globals.css:85](../front-end/src/app/globals.css). HANDOFF§2: movimentos120–200ms/ease-out, sem pulso/contagem animada com movimento reduzido.

Extensão aprovada por Fernando em24/10: [plano de entrada](../docs/superpowers/plans/2026-10-24-entrada-animada.md). Tempos iniciais800/200ms foram substituídos por D19: splash3000ms e entradas850ms; uma vez por sessão, cancelável por interação, omitido com movimento reduzido/storage indisponível. Entrada só em montagem/troca de rota; dados financeiros não animam. Código/evidência serão vinculados após implementação.

## Entrada animada — 24/10/2026

Implementado: BrandIntro em front-end/src/components/app/brand-intro.tsx; identificação de rota em page-entrance.tsx; keyframes/tokens em front-end/src/app/globals.css. --motion-entry-duration850ms, --motion-entry-ease cúbica ease-out e --layer-intro70. Gatilho visual usa apenas marcador de sessão “seen”, sem PII. Grupos animam só opacity; transform de até8px em títulos/itens termina em none, sem fill persistente. Fundo/cores/fontes continuam os tokens do HANDOFF.

Reduced-motion e print removem animações de entrada; sem JS a introdução fica oculta e o shell SSR existente permanece acessível. [Evidência](../docs/evidence/2026-10-24-entrada-animada.md); screenshots são quadros congelados para inspeção, enquanto o primeiro frame real é observado pelo E2E.

## D19 — Ritmo mais lento — 24/10/2026

Tempos atuais: splash3000ms; saída800ms com delay2200ms; desenho da moldura1200ms/delay250ms; nome900ms/delay600ms; entrada dos componentes850ms. Defasagens de cards100/200/300/400/500/600ms; blocos160/300/440ms. Cubic-bezier de desaceleração, deslocamento máximo8px preservado. Foco dentro da rota marca data-entry-interrupted e mantém as entradas desativadas até próxima rota, sem reanimar ao desfocar.

Teste isolado sem DB: node e2e/entry-motion-isolated.cjs. A suíte E2E integrada permanece dependente do Docker/PostgreSQL. Não interpretar seu timeout de ambiente como teste de motion aprovado.
