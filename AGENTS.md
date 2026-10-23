# Casa de Leilões — instruções dos agentes

Fernando · WebCodeFF. Respostas e UI em pt-BR; identificadores em inglês.

## Estado e autorização

- Pasta canônica: `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao`.
- Fernando autorizou explicitamente criar a pasta, instalar a base e aguardar pranchas/design system (U12). Essa autorização permite bootstrap/configuração/testes locais antes do design, sem fingir S6/S7 aprovados.
- Não implementar telas finais, autenticação, lotes, carteira ou regras de leilão antes da retomada autorizada após design.
- Site na Vercel; API Node persistente separada. Nenhum deploy/contratação/push/envio autorizado.

## Base técnica

- Node 24 LTS; npm workspaces e um package-lock.json na raiz.
- Front: Next.js App Router + React + TS strict + Tailwind 4. Metadados no servidor; domínio continua na API.
- Back: NestJS + Prisma 7 + PostgreSQL 18. Controller → service/domínio → repository; ORM/SQL só no acesso a dados.
- Versões exatas e comandos: `docs/ambiente.md`. Não usar versões RC/beta automaticamente.
- Componentes shadcn obrigatórios por U13; nome **Arremate**, logo, paleta e fontes aprovados por Fernando em 23/10 (D01–D12); “Casa de Leilões” fica só como nome interno do repositório.
- Identidade visual congelada (Design Freeze D12, 23/10). Fonte: `docs/design/HANDOFF-GROK.md`; não gerar tema/componentes shadcn ou DESIGN.md concorrentes a ela. Design Freeze declarado; S6 aceito com HTML/PNG como fonte visual, sem Penpot (D13); itens abertos do S5 ficam como risco, decididos por tarefa; implementação autorizada a partir da Tarefa 1 (migration só local, commits locais, sem push).

## Roteamento

- Começar: `docs/INICIO.md` e `.ai/roadmap.md`.
- Produto/regra: `.ai/scope.md` → `docs/requisitos.md`.
- Arquitetura: `.ai/architecture.md` → spec em `docs/superpowers/specs/`.
- Telas: `.ai/page-map.md` → `docs/design/briefing-grok.md`.
- Design: `docs/design/PROMPT-GROK.md`; artefatos em `docs/design/pranchas/` e handoff do Grok.
- Qualidade: `docs/qualidade.md`; evidências reais em `docs/evidence/`.
- README completo: página própria no Notion; local é só ponteiro até a cópia final.

## Regras

- Escopo mínimo, clean code, sem abstrações/libraries para uso hipotético. Reutilizar framework/padrões.
- TS strict, sem any/casts gratuitos. DTO/validação + autorização por papel/dono no backend; sem mass assignment.
- Dinheiro inteiro, clocks do servidor, transações/locks e idempotência conforme spec. Nunca autoridade de saldo/tempo no cliente.
- Teste falhando → mínimo código → teste verde → review de código/segurança → evidência. Sem High/Critical pendente.
- Review independente de regras críticas e ao concluir capacidade; não alegar testes/produção não executados.
- Nunca registrar segredos, cookies, tokens ou valores de .env em saída, docs, Git ou Notion. Não ler .env para contexto.
- Runtime do banco sem superuser/DDL. Migrações futuras revisadas; nada de db push/reset de produção.
- Só operar Docker Compose `casadeleilao` e portas locais do projeto. Não parar/matar containers/processos de outros projetos.
- Commits convencionais e escopo explícito somente quando autorizados; nunca push/deploy implícito.
- Notion é fonte de decisões; .ai é cache curto. Atualizar somente contexto afetado; não duplicar manuais.

## Skills

- Superpowers: executing-plans/TDD/review/verification no caminho alterado; debugging quando houver falha.
- PostgreSQL best practices antes de schema/migrations/queries de risco.
- shadcn: registry/CLI e componente existente antes de primitive próprio, somente após design para UI.
- Graphify/Serena quando disponíveis e úteis; fallback em busca dirigida. Não instalar indexadores por cerimônia.

## Boas práticas adicionais (Axion/Colinas, 23/10/2026)

Acrescentado sem alterar as regras acima. Axion e Colinas são **referência somente leitura**: não copiar identidade, regras de negócio, dados nem URLs deles. CLAUDE.md contém só `@AGENTS.md`; não criar instruções concorrentes.

### Ordem de leitura e precedência

1. Este arquivo → 2. `docs/INICIO.md` e `docs/decisoes.md` → 3. **uma** fonte do roteamento, só a seção necessária → 4. código, só o trecho necessário (busca dirigida).
- Notion só no boot ou quando a tarefa pedir sincronização; não reconsultar por troca de task ou nova sessão. Não ler plano, spec ou skill inteiros sem precisar.
- Precedência: pedido do Fernando > PDF e decisões U/D (`docs/decisoes.md`, Notion) > spec e plano > HANDOFF do design > este arquivo > `.ai/` > skills > padrões. Proposta não é decisão LOCKED.

### Design aprovado (23/10; Design Freeze declarado)

- D01–D08: nome **Arremate**; Bordô #6E1E2B, Latão #A9823A, papel #F6F3EC; Fraunces + Inter; atalhos de lance mínimo/+1/+2; depósito simulado R$ 1–R$ 100 mil; vitrine por término mais próximo; sem aviso ao visitante se o Met cair; sem dark mode.
- D09–D12: logo “A” em Fraunces (moldura latão, quadrado bordô); paginação da vitrine com 8 itens; atalhos de depósito 1k/5k/10k; Design Freeze.
- Pendentes na implementação: validação de a11y; textos/códigos de erro (alinhar com o back).
- Fonte: `docs/design/HANDOFF-GROK.md` e `docs/design/pranchas/INDICE.md`. Tokens só pelo tema shadcn; ícones lucide; imagens CC0 do Met com crédito. Não inventar visual; dúvida vai ao Grok/Fred e Fernando aprova.

### Fluxo de task

1. Classifique: trivial (1 arquivo, sem regra nova) · capacidade (Tarefas 1–10 / PD) · fase.
2. Mais de 3 arquivos ou regra nova → plano em `docs/superpowers/plans/`.
3. Dependência nova, schema/migration, auth/sessão, config (`tsconfig`, `next.config`, Compose, lockfile) ou decisão LOCK → **PARE e peça OK**.
4. TDD → review de código/segurança → evidência em `docs/evidence/`.
5. Atualize a fonte da decisão (doc + Notion) no mesmo trabalho e registre em `docs/lifecycle.md`.
6. Reporte com evidência (comando + saída). Subagente só para back+front juntos ou review isolado; MCP só quando a tarefa exigir.

### Gate (Definition of Done)

- `npm run typecheck` sem erro no pacote tocado; testes do caminho alterado; `npm run lint`; `npm run build` nas tasks de fechamento; E2E quando a jornada mudar.
- Revisão de segurança ao fim de **toda** task (guard/ownership, DTO, IDOR, PII, segredo em log). High/Critical impede done. Sem `console.log`.
- Antes de migration, auth/sessão, integridade ou decisão irreversível: revisão adversária em contexto limpo (só código + contrato, nunca a conclusão do autor). Máx. 3 ciclos; persistindo achado → Fernando.

| Desculpa proibida | Resposta |
|---|---|
| "Mudança pequena, não precisa teste" | Teste do caminho alterado é obrigatório. |
| "Testo depois" | Sem teste, não há done. |
| "Não mexe em segurança" | Toda task termina com revisão de segurança. |
| "Estou confiante" | Confiança não é evidência. |

### Agir direto × perguntar

**Direto:** ler código/docs, analisar, editar no escopo, rodar typecheck/lint/testes, rascunho de mensagem.
**Precisa OK do Fernando:** commit (enquanto não autorizado), push, PR, merge, deploy; migration; `.env`/segredos; comando destrutivo ou deleção; dependência nova; config/lockfile; auth/sessão; decisão LOCK; mais de 5 arquivos não previstos; gasto; mensagem a terceiros (só rascunho); mover/renomear pasta.

### Git e ambiente

- Commits convencionais (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), um contexto por commit, `git add <caminhos explícitos>`. Branch `feat/<nome>`.
- Nunca commitar `.env`; nunca pular hooks de commit (pre-commit/commit-msg); nunca alterar `git config`, reset destrutivo ou push forçado. **Sem Prettier no arquivo inteiro.**
- Windows/PowerShell: `>` grava UTF-16; use ferramenta de edição e salve em UTF-8.
- A pasta `C:/Users/ferna/Desktop/WebCode/Projetos/casa de leilao` (com espaço) é cópia antiga de documentação: não editar como fonte nem apagar.

### Roteamento de design

| Pedido | Abrir |
| --- | --- |
| Visual, tokens, componentes, assets | `docs/design/HANDOFF-GROK.md`, `docs/design/pranchas/INDICE.md` |
| Estado de nome/logo/paleta | `docs/design/DECISOES-VISUAIS.md` + D01–D08 em `docs/decisoes.md` |
| Implementação do design por página | plano, seção "PD — Design (Grok/Fred)" |

### Memória

`.ai/` com no máximo 20 entradas; sem diário de sessão. Decisão durável vai à fonte responsável e aos consumidores; teste executado vai à evidência.

### Documentação viva

- Ao concluir cada tarefa, atualizar `README.md` (estado e como rodar), o plano em `docs/superpowers/plans/` (checkboxes e notas) e a cópia na página do projeto no Notion, no mesmo trabalho.
