# Requisitos — fonte e rastreabilidade

Análise de 23/10/2026. Fonte primária: PDF `Teste tecnico Elite Dev - Verzel.pdf`, 7 páginas, recebido no e-mail de codificação de 22/10. Leitura visual de todas as páginas: o arquivo não contém camada de texto extraível. Cópia local: `sources/verzel-teste-tecnico.pdf`, 1.971.714 bytes, SHA-256 `0A6546E325D090F8A27BACD8C32249A98FAD2BC0A232C038CD681D1DD95E659C`.

O PDF manda no escopo. Decisões do usuário complementam suas lacunas. Propostas técnicas não são requisitos da Verzel nem decisões aprovadas. A cópia original e imagens de leitura permanecem locais, ignoradas pelo Git.

## Obrigatórios do PDF

| ID | Página | Regra / critério de aceite | Entrega / teste planejado |
| --- | --- | --- | --- |
| R01 | 2 | Casa de leilões; itens originados em API pública escolhida pelo candidato | Catálogo externo + snapshot; integração |
| R02 | 2 | Leiloeiro cria e gerencia somente os próprios lotes; não dá lances | Autorização e testes negativos |
| R03 | 2 | Licitante deposita saldo simulado, dá lances e arremata | Carteira, lances e liquidação |
| R04 | 2 | Lote configura lance inicial, incremento mínimo, início, fim e dados do item | DTO, formulário e testes de fronteira |
| R05 | 2,7 | Deploy público funcionando é obrigatório | Smoke em URL pública |
| R06 | 3 | Vitrine separa ao vivo, agendados e encerrados; cancelados ficam fora | Vitrine e teste de listagem |
| R07 | 3 | Painel busca API e cria lote com imagem, título, atributos, datas e valor mínimo | Painel/criação e integração |
| R08 | 3 | Cancelamento base só para lote sem nenhum lance | Corrida cancelamento × primeiro lance |
| R09 | 3 | Leiloeiro vê resultado dos lotes encerrados, valor arrematado e total recebido | Painel e total de liquidações efetivas |
| R10 | 3 | Sala mostra lance atual, histórico, posição do usuário, contagem regressiva e ganhando/superado | Sala e dois navegadores |
| R11 | 3 | Atualização ocorre sem recarregar página | Tempo real e reconexão |
| R12 | 3 | Carteira mostra total, comprometido, disponível e depósito simulado | Carteira e invariantes |
| R13 | 3 | Meus arremates mostra itens com participação, lotes vencidos, comprovante e link | Listagem privada + comprovante |
| R14 | 3 | Auditoria pública sem login; histórico completo e resultado íntegro/adulterado | Auditoria, paginação completa e ataque direto ao DB |
| R15 | 3 | Recusas explícitas: abaixo do mínimo, saldo insuficiente, já lidera, não iniciado, encerrado | Erros estáveis em pt-BR e testes |
| R16 | 4 | Queda da API externa não inutiliza vitrine, sala, auditoria e comprovante | Snapshot persistido; desligar provider |
| R17 | 4 | Só aceitar lances entre início e fim | Relógio do servidor, fronteiras e espera por lock |
| R18 | 4 | Primeiro lance >= inicial; demais >= atual + incremento | Abaixo/igual/acima |
| R19 | 4 | Líder não cobre o próprio lance | Teste inclusive com retry e concorrência |
| R20 | 4 | Disponível = total - comprometido; liderança compromete valor integral | Reserva atômica e saldo não negativo |
| R21 | 4 | Ao ser superado, saldo comprometido volta imediatamente ao disponível | Liberação na mesma transação |
| R22 | 4 | Aceitar lance somente se couber no disponível | Uma carteira disputando lotes diferentes |
| R23 | 4 | Lance nos últimos 2 minutos prorroga fim para +2 minutos | Fórmula decidida pelo usuário abaixo |
| R24 | 4 | Encerrar debitando vencedor, creditando leiloeiro e gerando comprovante | Liquidação única, atômica e recuperável |
| R25 | 4 | Sem lances, encerra sem vencedor | Sem débito, crédito ou comprovante de vencedor |
| R26 | 4 | Auditoria detecta alteração, remoção e inserção posterior no histórico, inclusive direto no banco; explicar técnica | HMAC + âncora independente; testes destrutivos só em cópia de teste |
| R27 | 4 | Auditoria e comprovante identificam licitantes sem expor dados pessoais | Aliases; nenhuma identificação pessoal pública |
| R28 | 5 | Front React; back Node.js ou Python; DB permitido conforme lista | Escolhas do usuário: React + Node + PostgreSQL |
| R29 | 5 | Prazo de 7 dias corridos após recebimento | Janela calculada no README |
| R30 | 5 | Seed: um leiloeiro, dois clientes e ao menos um lote publicado com lances abertos | Seed repetível e smoke real |
| R31 | 5 | README detalha configuração/execução/DB e comportamentos inesperados | Reproduzir em ambiente limpo |
| R32 | 7 | Repositório público; informar ambos se separados; link de deploy | Checklist de entrega |
| R33 | 7 | Declarar onde/como usou IA e o que revisou/ajustou, ou declarar que não usou | Registro factual durante trabalho |

## Opcionais e exclusões do PDF — página 6

| Item | Tratamento proposto |
| --- | --- |
| Busca e filtro de lotes | Após o obrigatório; abas por status são base, não esse extra |
| Cancelamento com estorno automático | Fora da primeira entrega; não confundir com R08 |
| Docker Compose | Recomendado para reprodução; base local autorizada antecipadamente em U12; release continua sujeito aos gates |
| Testes automatizados | Obrigatórios por pedido de Fernando |
| Modo claro e escuro | Não presumido; Grok define design inicial; dark só se aprovado e houver prazo |
| Nota fiscal, revenda, aplicativo nativo, recuperação de senha | Expressamente dispensados; fora do escopo |

## Decisões de Fernando

| ID | Data | Decisão | Status |
| --- | --- | --- | --- |
| U01 | 23/10/2026 | React, Node.js e PostgreSQL | DEFINIDA |
| U02 | 23/10/2026 | Tema: obras de arte de acervo público | DEFINIDA |
| U03 | 23/10/2026 | Lance aceito nos últimos 2 minutos renova fim para 2 minutos após o lance | DEFINIDA; `endsAt = acceptedAt + 120s` na janela final |
| U04 | 23/10/2026 | Grok cria pranchas e design system; Fernando aprova | DEFINIDA |
| U05 | 23/10/2026 | Documentar decisões/pontos importantes, testar sempre e registrar evidências; revisão de código obrigatória | DEFINIDA |
| U06 | 23/10/2026 | Seguir Project Lifecycle desde o início e registrar Boot no README | DEFINIDA |
| U07 | 23/10/2026 | Qualidade próxima de produção, clean code e baixa complexidade dentro do PDF | DEFINIDA |
| U08 | 23/10/2026 | Dar atenção aos metadados do site, com especificação, implementação futura e testes | DEFINIDA; critérios em [Metadados](metadados.md) |
| U09 | 23/10/2026 | Site na Vercel; API Node em serviço persistente separado | DEFINIDA; fornecedores/custo de API/DB ainda em aberto; [hospedagem](hospedagem.md) |
| U10 | 23/10/2026 | Manter README no Notion e copiar ao README do repositório ao finalizar | DEFINIDA; [fonte Markdown](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82) |
| U11 | 23/10/2026 | Pasta completa de decisões/detalhes e prompt para Grok localizar e iniciar pranchas | DEFINIDA; [índice](INICIO.md) e [prompt](design/PROMPT-GROK.md) |
| U12 | 23/10/2026 | Criar pasta casadeleilao, instalar a base e aguardar pranchas/design system | DEFINIDA; exceção explícita de bootstrap local antecipado, sem aprovar S6/S7 ou funcionalidades |
| U13 | 23/10/2026 | Plano Superpowers com toda a lógica; componentes sempre shadcn; definir paletas, logo e nome junto ao Grok | DEFINIDA; identidade visual ainda aberta, [registro visual](design/DECISOES-VISUAIS.md) |

Detalhe de fronteira proposto para U03: janela `0 < endsAt - acceptedAt <= 120s`; em exatamente 120s a renovação mantém o mesmo fim. Em `acceptedAt >= endsAt`, recusar. Datas enviadas pelo cliente nunca decidem aceitação.

## Modelagem de produto para revisão

- Duas funções separadas por conta. Visitante consulta vitrine, sala, auditoria e comprovante. Sessão é exigida para ações privadas.
- Nove páginas propostas; login com contas semeadas cobre autenticação. Cadastro público não é exigido e não entra por padrão. Não há página de recuperação.
- Cancelamento somente de lote próprio, ainda não encerrado, sem qualquer lance. Não editar regras do lote após publicação; o PDF exige criação/gerenciamento, não edição de valores em disputa.
- Dinheiro exclusivamente simulado, BRL na interface por proposta de localização. Nenhum Pix, cartão, saque, frete, comissão ou pagamento real.
- Posição do licitante: ranking pelo maior lance aceito de cada participante, com posição própria explícita; todos os lances permanecem no histórico.
- Comprovante compartilhável em página HTML, com opção de impressão do navegador; gerar PDF não é obrigação do desafio.
- Arte do acervo serve para demonstração fictícia; não alegar propriedade/venda real de obra do museu. Exibir origem e créditos. Escolher apenas imagens com licença pública verificada.
- Sem organizações/tenancy, planos, assinatura, IA no produto ou papel de administrador genérico. Uso de IA no desenvolvimento é uma declaração da entrega, não uma feature.

Esses recortes são propostas mínimas de produto, não frases atribuídas ao PDF. Devem ser reconciliados no gate de produto/arquitetura antes de implementação.
