# Como o Arremate foi construído — versão narrativa

Versão narrativa da seção “Processo” do [diário de construção](diario-construcao.md), preservada aqui quando o texto passou a usar a versão objetiva (revisão de 26/10/2026). O README da raiz virou o guia de uma página para o avaliador.

Nós somos os agentes que construíram o Arremate. Antes de qualquer linha de código, o Fernando já tinha desenhado o caminho que íamos seguir: um ciclo de vida em treze estágios, do S0 ao S12, que transforma uma ideia numa máquina de estados verificável. Ideia, validação, definição de produto, pesquisa de lacunas, prontidão, Architecture Freeze, Design Freeze, handoff, boot do repositório, desenvolvimento, saúde, release e produção. Nenhum de nós escolhe a próxima etapa pela memória da conversa: lemos o Lifecycle Control do projeto e avançamos pelo primeiro gate ainda não cumprido.

Cada um tem seu papel. O orquestrador lê o enunciado, quebra o trabalho em tarefas e roda os gates. O Fred, nosso designer, desenha as pranchas antes de existir qualquer componente novo; hero, header e footer nasceram de três variações dele. Os executores, Codex e Cursor/Claude Code, escrevem o código com testes e deixam a evidência em `docs/evidence/`. O QA roda o E2E num mundo à parte, com build, portas e banco próprios.

Podemos pesquisar, comparar alternativas e repetir um gate quantas vezes for preciso. Mas o Fernando definiu onde paramos: troca de decisão já congelada, escolha de design com mais de uma direção válida, credencial, produção, gasto real ou qualquer ação destrutiva. Nesses pontos levamos a ele as alternativas e o trade-off, e ele decide pelo critério, não pela pressa. Foi assim que dependências como `@node-rs/argon2` e `radix-ui` entraram, cada uma com motivo registrado em `docs/decisoes.md`.

Aprendemos a ser honestos com o que sabemos. Planejado não é executado; o que não verificamos fica marcado como não verificado. Commits pequenos, diff conferido, migration só no banco local e nada hospedado sem validação humana. O Fernando projetou a arquitetura, nós executamos dentro dela, e cada entrega passou pelo olhar dele antes de virar parte do produto.

## Detalhes do Lifecycle (histórico)

**Exceção U12.** Fernando pediu criar a pasta casadeleilao, instalar tudo e aguardar pranchas/design system. Isso autorizou o bootstrap local antes do design/handoff final (manifests/lockfile, AGENTS raiz/front/back, cache `.ai`, tooling, bancos isolados, health e placeholder técnico), mas não funcionalidades financeiras, telas finais, `DESIGN.md` inventado, deploy ou contratação.

**D13 (23/10/2026).** S6 aceito com pranchas HTML/PNG como fonte visual, sem Penpot; S5 com riscos aceitos (não PASSED); implementação liberada a partir da Tarefa 1 (migration só local, commits locais, sem push/deploy).

## Instruções para IAs que forem editar o README

1. **Voz:** a seção “Processo” fica na voz dos agentes; a declaração de uso de IA fica na voz do Fernando, porque é ele quem declara.
2. **Critério, não diálogo:** mostre o critério e a validação do Fernando. Nunca transcreva respostas dele.
3. **Só fatos com fonte:** use apenas o que está no Notion do projeto, em `docs/decisoes.md` ou no código. O que não foi verificado fica marcado como **não verificado**.
4. **Sem senhas:** nunca escreva senhas ou segredos; aponte para o seed e para o `.env.example`.
5. **Espelhamento (D14):** o README do repositório e a página do Notion “README — em elaboração” têm o mesmo conteúdo; atualize os dois. O README é o guia de uma página; o histórico detalhado vai para `docs/diario-construcao.md`.
6. **Tom:** pt-BR técnico e humano, frases curtas.
