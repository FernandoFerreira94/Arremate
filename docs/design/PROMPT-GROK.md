# Prompt para o Grok — iniciar pranchas

Copie a instrução abaixo para o Grok no cliente que tenha acesso à pasta do projeto. Se estiver usando Grok sem acesso a arquivos locais, anexe os documentos indicados; não presumir que uma URL do Notion ou caminho local esteja acessível.

```text
Você é responsável pelo design system e pelas pranchas da Casa de Leilões do desafio Verzel. Nesta tarefa, produza design e especificação visual; não implemente a aplicação.

Abra a pasta:
C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao

Comece lendo, nesta ordem:
1. docs/INICIO.md
2. docs/decisoes.md
3. docs/requisitos.md
4. docs/design/briefing-grok.md
5. docs/metadados.md
6. docs/design/DECISOES-VISUAIS.md

Consulte docs/superpowers/specs/2026-10-23-casa-leiloes-design.md somente nas partes necessárias a permissões, dados, fluxos e estados. Consulte docs/lifecycle.md para respeitar os gates. Não reabra o Dev Hub inteiro nem percorra outros projetos.

Contexto definido por Fernando:
- React, Node.js e PostgreSQL; site na Vercel e API Node persistente separada foram escolhidos. Fornecedores da API/DB e detalhes operacionais ainda estão em revisão.
- Tema: obras de arte de acervo público; é uma demonstração com valores simulados, sem venda real das obras dos museus.
- Você cria pranchas, identidade e design system. Fernando aprova; Codex conduz arquitetura/implementação futura/testes/review.
- Arquitetura ainda em S5. Está autorizado iniciar exploração visual do briefing; não declarar Design Freeze, S7 ou autorização de código por conta própria.

Entregue estas 9 páginas, sem inventar outras:
1. Vitrine de lotes.
2. Entrar.
3. Sala do lote, reutilizada para agendado/ao vivo/encerrado.
4. Meus lotes / painel do leiloeiro.
5. Criar lote: buscar API → escolher obra → valores/datas → revisar/publicar.
6. Carteira do licitante.
7. Meus arremates e participações.
8. Auditoria pública.
9. Comprovante público por link.

Para cada página, siga exatamente conteúdo, ações, permissões, navegação e estados definidos no briefing. Cubra desktop e mobile. Referência de entrega: 9 pranchas desktop + 9 mobile, uma prancha de design system e uma de estados/componentes; variantes adicionais podem ser frames vinculados. Não transformar modal/estado em nova página funcional.

Crie uma direção visual coesa, comercial e sóbria de casa de leilões de arte. Defina tokens semânticos, tipografia, grid, espaçamento, raio, borda, sombra, foco, ícones, componentes, estados e motion discreto/reduced-motion. **shadcn é obrigatório** como base de componentes. Proponha nome final, logo vetorial e paletas para Fernando escolher antes de congelar o design; Casa de Leilões é provisório. Documente cores semânticas/contraste/variantes sobre as primitivas shadcn, sem escolher bibliotecas extras ou mudar arquitetura. Não copie marcas, paleta ou identidade do Axion/Colinas. Não apresente Verzel como operadora do leilão. Diferencie claramente exploração visual de design aprovado.

Inclua obrigatoriamente:
- sala com preço/mínimo/histórico/posição, ganhando/superado, prorrogação, reconectando e erros de lance;
- carteira com total/comprometido/disponível e depósito explicitamente simulado;
- encerramento em processamento, vencedor/sem vencedor, cancelamento elegível e feedback de corrida;
- auditoria íntegra/adulterada/indeterminada, sem dados pessoais;
- comprovante compartilhável sem PII;
- loading, vazio, erro, pending, sucesso e degradação onde realmente se aplicam;
- teclado/foco/labels/contraste/toque e legibilidade no mobile;
- favicon, apple-touch-icon e imagem Open Graph (referência 1200×630), com alt e preview genérico seguro, sem saldo/PII/preço volátil.

Não acrescente cadastro, recuperação de senha, checkout, Pix/cartão, frete, assinatura, revenda, dashboard administrativo ou funcionalidades fora do PDF. Dark mode é opcional e não deve atrasar as telas obrigatórias. Nenhum botão sem ação prevista. Use imagens de origem/licença verificadas, com crédito; se não conseguir obter uma imagem válida, marque o espaço como referência pendente, sem fingir origem real.

Comece pelo design system e por Vitrine + Sala + Carteira, para validar a linguagem nas jornadas críticas; depois complete as demais telas. Salve pranchas em docs/design/pranchas/ e assets de marca em docs/design/assets/ e documente no índice desse diretório a ordem de leitura, status de cada página/variante e o caminho ou link de cada prancha. Se usar ferramenta externa, registre links verificáveis e exportações acessíveis. Se produzir HTML/SVG apenas para a apresentação das pranchas, mantenha tudo nessa pasta; não faça scaffold de front-end/back-end nem instale dependências da aplicação.

Entregue também docs/design/HANDOFF-GROK.md com tokens, componentes, responsive, estados cobertos, assets/créditos, decisões visuais e pendências. Preserve os documentos de requisitos/arquitetura e o README no Notion. Sugestão que altere regra de negócio deve ser marcada como proposta para Fernando, sem editar o escopo silenciosamente.

Antes de concluir, confira cada página com R01-R33 e U01-U13, a navegação entre papéis e as mensagens de erro. Informe o que foi criado, os caminhos/links e o que depende de aprovação. Não declare aprovação de Fernando, teste de código ou integração que não ocorreu.
```
