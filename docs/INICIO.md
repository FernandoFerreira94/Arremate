# Comece aqui — Casa de Leilões

Pasta de trabalho: `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao/docs`.

**Estado:** Tarefa 1 concluída em 23/10/2026 (dinheiro inteiro, schema e migration local `20261023104706_auction_core`). Design Freeze D01–D12; S6 aceito com HTML/PNG, sem Penpot (D13); S5 aberto como risco; S7 não declarado. Sem push/deploy. Next/Nest/Prisma; shadcn obrigatório por U13; nome **Arremate**.

## Fontes e responsáveis

- PDF do desafio + decisões explícitas de Fernando definem produto.
- [Projeto no Notion](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9): registro canônico de estado e decisões.
- [README em elaboração no Notion](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82): atualizar durante o trabalho; copiar o bloco Markdown ao README do repositório apenas ao finalizar e validar.
- Grok: pranchas, identidade e design system. Fernando aprova. Codex: análise, arquitetura/plano, implementação futura, testes e revisão.

## Índice da pasta

| Documento | Conteúdo / quando ler |
| --- | --- |
| [Decisões e situação atual](decisoes.md) | O que Fernando definiu, propostas e pendências |
| [Requisitos](requisitos.md) | 33 obrigatórios do PDF, opcionais, exclusões e complementos U01+ |
| [Briefing Grok](design/briefing-grok.md) | 9 páginas, conteúdo, ações, papéis, estados e entrega visual |
| [Prompt de execução para o Grok](design/PROMPT-GROK.md) | Instrução pronta para localizar fontes e iniciar pranchas |
| [Metadados](metadados.md) | Títulos, OG, favicon, indexação e testes T16 |
| [Hospedagem Vercel](hospedagem.md) | Compatibilidade, alternativas e decisões ainda abertas |
| [Arquitetura proposta](superpowers/specs/2026-10-23-casa-leiloes-design.md) | A01-A13, módulos, dados, API, concorrência, segurança e integridade |
| [Contratos da API](api.md) | Dinheiro, tipos de fronteira, tabelas e endpoints previstos |
| [Plano Superpowers completo](superpowers/plans/2026-10-23-casa-leiloes.md) | Dez tarefas: dados, integridade, sessão, catálogo, carteira, lance, liquidação, UI, tempo real e release |
| [Decisões visuais](design/DECISOES-VISUAIS.md) | shadcn definido; nome, logo, paleta, tipografia e tema LOCKED (D01–D12) |
| [Ambiente](ambiente.md) | Base, comandos, portas e limites |
| [Evidência do bootstrap](evidence/2026-10-23-bootstrap.md) | Resultados reais separados dos testes futuros |
| [Qualidade](qualidade.md) | Testes T01-T16, review, evidências e release gate |
| [Referências e skills](referencias-e-skills.md) | Recomendações de Axion/Colinas, adaptações e capacidades úteis |
| [Lifecycle](lifecycle.md) | Boot oficial, estado, gates e histórico |

O PDF original fica em `docs/sources/verzel-teste-tecnico.pdf`, local e ignorado pelo Git; as regras rastreadas estão em requisitos. Não republicar e-mail ou links assinados de download.

## Ordem mínima para o Grok

1. Este índice e decisões.
2. Requisitos e briefing das páginas.
3. Metadados, para os assets sociais.
4. Só as seções de arquitetura/qualidade que afetarem fluxo, segurança ou estados visuais.

São **9 páginas funcionais**, com 18 pranchas base sugeridas (9 desktop + 9 mobile), mais design system e estados. Não criar cadastro, checkout/pagamento real, administração, recuperação de senha ou páginas extras por iniciativa própria. O detalhe está no briefing.

## Como manter esta documentação

Não duplicar regras em novos arquivos. Decisão nova vai à fonte responsável e seus consumidores; teste executado vai à evidência da capacidade; README evolui no Notion. No encerramento, validar todos os links e comandos e só então copiar o README para o repositório. Não registrar teste planejado como aprovado nem marcar S6/S7 pela simples existência das pranchas.
