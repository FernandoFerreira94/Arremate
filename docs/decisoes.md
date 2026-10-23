# Decisões — índice de autoridade e pendências

Atualizado em 23/10/2026. Documento de consulta rápida; o detalhamento permanece nos arquivos vinculados. Decisão expressa de Fernando vence proposta técnica; mudança de regra do PDF precisa ser explicitada, nunca presumida.

## Definido por Fernando

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| U01 | React + Node.js + PostgreSQL | [Requisitos](requisitos.md) |
| U02 | Obras de arte de acervo público | [Requisitos](requisitos.md) |
| U03 | Lance na janela final renova fim para 120s após aceitação | [Regra e fronteiras](requisitos.md) |
| U04 | Grok cria pranchas e design system; Fernando aprova | [Briefing](design/briefing-grok.md) |
| U05 | Decisões/pontos importantes documentados; testes documentados e review obrigatório | [Qualidade](qualidade.md) |
| U06 | Seguir Project Lifecycle desde o início e registrar Boot no README | [Lifecycle](lifecycle.md) |
| U07 | Qualidade próxima de produção, clean code, manutenção simples e escopo fiel ao PDF | [Arquitetura](superpowers/specs/2026-10-23-casa-leiloes-design.md) |
| U08 | Foco também nos metadados do site | [Metadados](metadados.md) |
| U09 | Site na Vercel + API Node persistente separada | [Hospedagem](hospedagem.md); limite confirmado por Fernando |
| U10 | Manter README no Notion; copiar ao repositório no final | [README — em elaboração](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82) |
| U11 | Organizar pasta completa de decisões/detalhes e entregar instrução para Grok iniciar pranchas | [Índice](INICIO.md) e [prompt](design/PROMPT-GROK.md) |
| U12 | Criar casadeleilao e instalar base local, aguardando design | [Ambiente](ambiente.md); exceção de bootstrap antecipado, sem autorizar produto |
| U13 | Plano de toda a lógica; shadcn obrigatório; nome/logo/paletas com Grok | [Plano](superpowers/plans/2026-10-23-casa-leiloes.md) e [decisões visuais](design/DECISOES-VISUAIS.md) |

## Propostas técnicas, ainda não congeladas

Os IDs A01-A13 estão no [registro de arquitetura](superpowers/specs/2026-10-23-casa-leiloes-design.md), com recomendação, alternativa e trade-off. Bootstrap escolheu Next App Router, NestJS e Prisma, com versões fixadas no lockfile; motivos/alternativas permanecem na spec. Sessão, SSE, Met, HMAC/testemunha e operação ainda são propostas de implementação a provar. A09 agora incorpora a fronteira aprovada Vercel/web + API persistente separada. Provedores, custo e proxy de produção ainda precisam ser fechados; metadados usam a API nativa Next no servidor; a proposta anterior de um único servidor para todo o site foi substituída.

Nove páginas é a organização mínima proposta para cumprir o PDF. Cores, fontes, marca, raio, tema e layout foram produzidos pelo Grok e aprovados por Fernando (D01–D12, abaixo); não importar visual Axion/Colinas nem presumir dark mode. U13 tornou shadcn obrigatório. CLI e dependências base estão instalados; components.json/tema/componentes finais derivam do HANDOFF na Tarefa 8. Nome **Arremate**, logo e paleta aprovados; “Casa de Leilões” fica só como nome interno.

## Pendências que afetam implementação

- Architecture Freeze restante: sessão/CSRF, topologia real e prova de integridade. Frameworks do bootstrap: Next/Nest/Prisma; não reabrir por hábito.
- Onde executar API contínua, banco, mídia e testemunha; custo/backup e fronteira com Vercel.
- Política de indexação da demo e domínio real de produção.
- Design Freeze declarado; S6 aceito com HTML/PNG como fonte visual, sem Penpot (D13); itens abertos do S5 ficam como risco, decididos por tarefa; implementação autorizada a partir da Tarefa 1 (migration só local, commits locais, sem push).

Essas pendências não impedem explorar os fluxos e pranchas já especificados, mas impedem declarar o handoff de implementação aprovado. O Grok não deve resolver infraestrutura ou mudar regras de negócio por conta própria.

## Segurança e qualidade não negociáveis

Saldo e prazo pertencem ao backend; transação/locks/retry/idempotência; leiloeiro sem lance; propriedade de lote validada; liquidação única; aliases sem PII; detectar adulteração direta de DB com âncora adequada; não depender de API externa para ler lote já publicado. Cada capacidade exige teste e review com evidência. Detalhes e testes em arquitetura/qualidade, sem duplicar aqui.

## Design aprovado por Fernando em 23/10/2026 (adição)

Design Freeze declarado depois em 23/10 (D12, abaixo); S6/S7 continuam pendentes. Detalhe no [HANDOFF-GROK](design/HANDOFF-GROK.md) e no [plano, seção PD (complementa as Tarefas 8 e 9)](superpowers/plans/2026-10-23-casa-leiloes.md).

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D01 | Nome do site: **Arremate** | [HANDOFF §1](design/HANDOFF-GROK.md) |
| D02 | Paleta Bordô #6E1E2B, Latão #A9823A, papel #F6F3EC | [HANDOFF §2](design/HANDOFF-GROK.md) |
| D03 | Fontes Fraunces (títulos/valores) + Inter (UI) | [HANDOFF §2](design/HANDOFF-GROK.md) |
| D04 | Atalhos de lance: mínimo, +1 e +2 incrementos | [Pranchas 04/05](design/pranchas/INDICE.md) |
| D05 | Depósito simulado de R$ 1 a R$ 100 mil | [Pranchas 06/07](design/pranchas/INDICE.md) |
| D06 | Vitrine ordenada pelo término mais próximo | [Pranchas 02/03](design/pranchas/INDICE.md) |
| D07 | Sem aviso ao visitante quando o The Met cair (só registro interno) | [HANDOFF §8 R16](design/HANDOFF-GROK.md) |
| D08 | Sem dark mode | [HANDOFF §1](design/HANDOFF-GROK.md) |

**Pendências de design não aprovadas:** paginação da vitrine com 8 itens; atalhos de depósito 1k/5k/10k; textos e códigos de erro a alinhar com o back-end. **Design Freeze não declarado.** _(Superado em 23/10/2026 por D09–D12 abaixo.)_

Supera os itens ABERTO de nome, paleta, tipografia e tema em [decisões visuais](design/DECISOES-VISUAIS.md); logo e raio/grid/sombra/motion foram aprovados no Design Freeze (D09/D12).

## Design Freeze — aprovação de Fernando em 23/10/2026 (adição)

Fernando: “aprovo tudo”. S6/S7 e a autorização de código **não** foram declarados.

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D09 | Logo: “A” em Fraunces em moldura de latão sobre quadrado bordô, como proposto no HANDOFF | [HANDOFF §1/§8](design/HANDOFF-GROK.md) |
| D10 | Paginação da vitrine com 8 itens | [Pranchas 02/03](design/pranchas/INDICE.md) |
| D11 | Atalhos de depósito R$ 1 mil, 5 mil e 10 mil | [Pranchas 06/07](design/pranchas/INDICE.md) |
| D12 | **Design Freeze** declarado por Fernando em 23/10/2026 | [Decisões visuais](design/DECISOES-VISUAIS.md) |

Pendentes para a implementação: validar a11y (teclado, leitor de tela, 320px, zoom 200%) e alinhar textos/códigos de erro com o back-end.

## Liberação da implementação — Fernando, 23/10/2026 10:26 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D13 | Fernando: “Libero: aceito HTML/PNG sem Penpot, arquitetura em aberto como risco, e Tarefa 1 com migration local e commits locais”. S6 aceito com as pranchas HTML/PNG como fonte visual; itens abertos do S5 (sessão/CSRF, topologia, testemunha, fornecedor/custo de API/DB, proxy/SSE Vercel, indexação) viram risco, decididos na tarefa que os usa; implementação autorizada a partir da Tarefa 1, migration só no banco local, commits locais, **sem push**/deploy | [Pranchas](design/pranchas/INDICE.md), [plano](superpowers/plans/2026-10-23-casa-leiloes.md) |

## README e Notion sempre atualizados — Fernando, 23/10/2026 10:27 (adição)

| ID | Decisão | Fonte / detalhe |
| --- | --- | --- |
| D14 | Fernando: “e não esquece de ir atualizando o arquivo do Notion, o README do projeto, isso é importante”. `README.md` e a página Notion “README — em elaboração” têm o mesmo conteúdo e são atualizados a cada tarefa concluída, refletindo o estado atual. **Supera a regra U10** (“README completo só no Notion, copiar no encerramento”) | [README](../README.md), [AGENTS.md](../AGENTS.md) — “Documentação viva” |

## Handoff registrado na Tarefa 1 (23/10/2026)

Artefatos congelados, sem Penpot (D13). Fonte visual: [HANDOFF-GROK](design/HANDOFF-GROK.md) (Design Freeze, etapas 1–3, 23/10) e [pranchas 00–13](design/pranchas/INDICE.md) (HTML em `src/`, PNG exportado). Identidade D01–D12. S6 aceito com esse HTML/PNG. S5 não está PASSED: sessão/CSRF, topologia, testemunha, fornecedor/custo de API/DB, proxy/SSE na Vercel e indexação permanecem risco, decididos na tarefa que os usa. S7 não foi declarado. A Tarefa 1 foi autorizada mesmo assim (D13): migration só local, commits locais, sem push/deploy.

Pendências que seguem abertas: validação de a11y; textos/códigos de erro alinhados ao back; escolha concreta de topologia antes do release. Nada é contratado automaticamente.

Contrato de dinheiro e tabelas desta tarefa: [api.md](api.md) e `back-end/prisma/schema.prisma` (migration `20261023104706_auction_core`).

## Integridade provada na Tarefa 2 (23/10/2026)

A08, no recorte local: HMAC-SHA-256 encadeado e testemunha em disco fora do PostgreSQL. A ordem é assinar, gravar `pending`, commit no banco, promover o checkpoint e só então responder. Gap de confirmação fica INDETERMINATE e bloqueia mutação; o banco suspeito não é reassinado. Detalhe: [operacao-integridade.md](operacao-integridade.md).

Continua risco do S5, sem contratação: diretório de produção da testemunha, fsync de diretório no Linux (neste Windows o ensaio devolve EPERM) e a topologia da API. A rota HTTP de auditoria não existe ainda.
