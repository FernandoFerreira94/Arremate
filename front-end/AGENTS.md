# Frontend

Seguir AGENTS.md raiz e o guia da versão Next instalada em `node_modules/next/dist/docs/` antes de APIs específicas.

- Server Component por padrão; menor client boundary possível.
- Metadados nativos Next no servidor. Nada de renderizador de head concorrente no Nest.
- API dedicada é autoridade de domínio; não duplicar carteira/lances em Server Actions.
- TanStack Query só para estado remoto interativo; queries/mutations e invalidação dirigidas.
- Visual/rotas funcionais aguardam Grok. Placeholder técnico sem identidade não é tela do produto.
- Não criar tokens, tema, logo ou componentes shadcn definitivos antes do design aprovado.
- Formulários futuros com validação, feedback/pending, teclado/foco/erro acessíveis.
- Verificar `npm run lint`, `npm run typecheck` e `npm run build`; E2E na raiz. Vitest instalado, mas não alegar suíte unitária de UI enquanto não existir.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Boas práticas adicionais (Axion/Colinas, 23/10/2026)

- Feedback obrigatório: loading (skeleton ou botão pending, sem duplo clique), sucesso e erro com a mensagem pt-BR do back. Nenhuma ação termina em silêncio; nunca stack ou texto em inglês ao usuário.
- Ação no desktop em Dialog, no mobile em Sheet; ação destrutiva em AlertDialog, conforme as pranchas.
- Antes de criar componente, procure em `src/components/ui` e nas features; não duplique. Sem cor, fonte, raio, sombra ou z-index fora dos tokens do HANDOFF; ícones só lucide.
- Acessibilidade: label em todo campo, foco visível, contraste AA, toque ≥ 44px, `prefers-reduced-motion`; imagem com `next/image` e alt/crédito.
- Fetch e hooks centralizados por feature; tipos de API compartilhados, sem `any`/`as` gratuito.
- Não matar o `next dev` de outros projetos.
