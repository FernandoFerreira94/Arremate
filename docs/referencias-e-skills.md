# Referências, recomendações herdadas e skills

Consulta realizada em 23/10/2026. Os projetos de referência foram somente lidos. Não foram alterados, inicializados ou usados como base para copiar código/segredos.

## AGENTS.md efetivamente consultados

| Projeto | Arquivo | Modificação observada |
| --- | --- | --- |
| Axion | `C:/Users/ferna/Desktop/WebCode/Projetos/Axion/AGENTS.md` | 21/10/2026 07:44 |
| Axion front | `C:/Users/ferna/Desktop/WebCode/Projetos/Axion/front-end/AGENTS.md` | 21/10/2026 07:44 |
| Axion back | `C:/Users/ferna/Desktop/WebCode/Projetos/Axion/back-end/AGENTS.md` | 21/10/2026 07:44 |
| Colinas raiz | `C:/Users/ferna/Desktop/Projetos/Projetos/Colinas-manutecao/AGENTS.md` | 11/10/2026 16:52 |
| Colinas front | `C:/Users/ferna/Desktop/Projetos/Projetos/Colinas-manutecao/front-end/AGENTS.md` | 22/09/2026 18:34 |
| Colinas back | `C:/Users/ferna/Desktop/Projetos/Projetos/Colinas-manutecao/back-end/AGENTS.md` | 12/10/2026 09:34 |

Estes são os AGENTS raiz/front/back das árvores principais atuais localizadas. Worktrees de Colinas foram encontrados, mas não tratados como fonte mais nova só pela data da pasta. A pasta homônima `Colinas-manutencao` não apresentou AGENTS raiz/back; não substituir a referência principal por ela. Datas são metadados do filesystem, não prova de aprovação de uma regra.

## Recomendações incorporadas

- TypeScript strict, sem `any`/casts gratuitos; validação de entradas e contratos; autorização por ação e dono no backend.
- Controller fino → service com domínio → repository como único acesso Prisma; sem camadas genéricas que só repassam chamadas.
- DTOs/campos permitidos e explícitos; nada de mass assignment; projeções que não expõem credenciais/PII; erros estáveis em pt-BR.
- Paginação, select explícito, queries parametrizadas, sem N+1; migrations revisadas, nunca reset/db push de produção.
- Transação com o cliente `tx`; revisão de concorrência; ordem consistente de locks; idempotência de mutações que podem repetir.
- Testes do caminho, typecheck independente e revisão de segurança antes de considerar concluído; evidência antes de afirmação.
- UI com feedback, loading/erro/vazio/sucesso e foco acessível; validação em formulários; componentes/tokens aprovados, sem design paralelo.
- Contexto curto e roteado; uma fonte de decisão, documentos atualizados quando regra muda; sem cópias divergentes para cada agente.

## Recomendações que exigem adaptação explícita

- Axion é multi-tenant com RLS por organização. Aqui o PDF define dois papéis e propriedade de lotes, não SaaS por organização. Não adicionar `organizacao_id`, RLS genérica ou infraestrutura multi-tenant sem novo requisito.
- Guards JWT do Axion/Colinas expressam a necessidade de autenticação/autorização. Sessão opaca é alternativa proposta para este projeto, ainda sujeita a aprovação; o nome JwtAuthGuard não é requisito do PDF.
- A instrução legada de Colinas de fazer reads fora da transação não pode valer para saldo/liderança/tempo que precisam de lock. Para este domínio, revalidar dentro da transação; registrar em Architecture Freeze.
- Next foi escolhido no bootstrap por Vercel/metadados; Server Components por padrão. Não copiar NextAuth/Server Actions ou domínio de outros projetos.
- Paleta, fonte, radius, logo, tema claro obrigatório, portas, seeds, tenant context e restrição de startup do servidor pertencem aos projetos originais. Não aplicar suas marcas/ports ao desafio. Grok define o design deste produto.
- “Swagger não instalado” é estado desses repositórios, não proibição universal. Para este teste, contrato Markdown inicial evita dependência só para documentação; reavaliar apenas por necessidade.
- Em conflito com Axion antigo (commit direto na main), o Lifecycle atual exige rastreabilidade e proteção de branch proporcionais a STANDARD. Antes de implementação, verificar a política real do repositório.

## Auditoria de skills do Claude Code

Inventário consultado: `C:/Users/ferna/.claude/skills/` e famílias em `C:/Users/ferna/.claude/plugins/cache/`, excluindo dependências/artefatos de execução. Avaliação por capacidade e descrições; leitura aprofundada só das relevantes. Não executar scripts de skills desconhecidas nem ler credenciais/configurações privadas para descobrir ferramentas.

| Capacidade encontrada | Relevância | Ação |
| --- | --- | --- |
| Superpowers brainstorming / writing-plans | Descoberta, spec e plano antes de implementação | KEEP: já disponíveis no Codex; usados nesta análise |
| Superpowers test-driven-development | TDD de regras e regressões | KEEP: rotear no S8/S9; exigência do usuário |
| Superpowers requesting/receiving-code-review | Review independente e reconciliação | KEEP: gate por capacidade, principalmente saldo/auth/auditoria |
| Superpowers verification-before-completion | Evidência antes de done | KEEP: já disponível; aplicar em cada entrega |
| Superpowers systematic-debugging | Causa-raiz quando houver falha | KEEP: sob demanda, sem carregar por rotina |
| Superpowers executing-plans / subagent-driven-development | Execução do plano após autorização | KEEP: escolher abordagem na passagem S8/S9 |
| Ponytail | Menor solução completa, clean code, sem abstração especulativa | KEEP: já disponível; nunca cortar validação/testes/review |
| Doubt-driven-development | Revisão adversária de decisões arriscadas | KEEP sob demanda: auditoria/auth/migration; não toda edição |
| Performance-optimization | Investigar gargalo medido | KEEP sob demanda; não inventar caches/queues |
| Frontend-design / UI-UX Pro Max / design-system | Auxílio ao designer e review | N/A como autoridade agora: Grok + aprovação de Fernando; no máximo um auxílio primário e review delimitado |
| Chrome a11y/cookie/LCP/memory debugging | QA específico de navegador | Condicional: algumas dependem de Chrome DevTools MCP; não presumir ferramenta ausente como instalada |
| Hyperframes, mídia/vídeo, GSAP, 3D | Produção audiovisual/motion avançado | N/A; fora do desafio |
| Claude-mem, runtime Codex/Claude, caveman | Memória/runtime/compressão específicos | N/A para arquitetura do produto; não importar hooks do Claude para Codex |
| Skills Axion/Colinas de OS, estoque, rondas etc. | Domínio de manutenção | N/A; não copiar regras de negócio |

Claude consultado contém Superpowers **6.3.0** e Ponytail **4.8.4**; Codex já disponibiliza Superpowers **7.0.0** e Ponytail **5.3.2**. Manter as capacidades já disponíveis, sem downgrade ou instalação duplicada. “Mais nova no cache” não comprova última versão upstream; verificar manutenção/compatibilidade somente quando for instalar no S8.

Complemento já disponível no Codex: `supabase-postgres-best-practices` aplica também a PostgreSQL fora do Supabase; relevante para schema, índices, menor privilégio e locks. Usá-la não significa contratar Supabase. A documentação PostgreSQL oficial segue sendo autoridade de API.

## Adicionar ao agente sem duplicar infraestrutura

As capacidades úteis já estão disponíveis nesta sessão. O plano registra seu uso e o roteamento futuro, sem copiar versões antigas para o projeto ou instalar pacote que já existe. **Nenhuma skill nova foi instalada nesta etapa.** O Project Init manda decidir candidatos no S5 e instalar somente faltantes no S8.

No S8, o AGENTS.md vai apontar para o workflow TDD → review → evidência e contexto canônico. Se faltar uma capacidade no cliente usado, instalar apenas essa skill de fonte verificada, com versão/origem/licença, dependências reais e teste de descoberta/uso. Adaptador não redefine o produto. A decisão “KEEP” evita instalação desnecessária e atende ao pedido de incorporar as recomendações úteis.

## Fontes Dev Hub efetivamente lidas

- [Project Lifecycle](https://app.notion.com/p/3c3d66ddfe93816e8b7cef1c8bc7c766), última edição exposta 30/08/2026.
- [Boot Protocol](https://app.notion.com/p/34dd66ddfe93816aae0fc4e6b03654ed) e [Boot Assets](https://app.notion.com/p/37dd66ddfe93811caa62d4d3ff2c0828).
- [Idea Validation](https://app.notion.com/p/3c3d66ddfe9381e48ee6d77825c81225), [Template Master canônico](https://app.notion.com/p/3c3d66ddfe9381da8bafd8657eff4f4b), [Pre-Development](https://app.notion.com/p/3c3d66ddfe9381beb328f14575cb9434).
- [Project Init](https://app.notion.com/p/37dd66ddfe9381638313f39ccae2154a), [Design Gate](https://app.notion.com/p/3c3d66ddfe9381de940ed872bd0b4934), [New Project Handoff](https://app.notion.com/p/382d66ddfe938123a978c3740d386767).
- [Arquitetura](https://app.notion.com/p/328d66ddfe9381049b94c277d9886a84), [Padrões de Código](https://app.notion.com/p/328d66ddfe9381faa075ef4ac7e7ec95) e [Quality Gates](https://app.notion.com/p/37dd66ddfe93811b80d1fc498eda296d).

Busca revelou “Template Master” antigo marcado como Legacy; utilizado o canônico apontado pelo Lifecycle. As fontes foram consultadas ao vivo, não apenas inferidas da memória local. Atualizações futuras do projeto devem usar contexto local compacto; não reler todo o Dev Hub a cada task.

