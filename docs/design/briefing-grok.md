# Briefing para o Grok — telas e design system

**Produto:** Casa de Leilões de obras de arte de acervo público, demonstração técnica com valores simulados. **Responsável pelo design:** Grok. **Aprovação:** Fernando. Este documento define conteúdo, comportamento e estados; cores, tipografia, composição, componentes e identidade visual pertencem ao design a produzir.

Fonte de escopo: [requisitos do PDF](../requisitos.md). Arquitetura ainda proposta; [Project Lifecycle](../lifecycle.md) controla aprovação. Pode explorar pranchas a partir deste briefing; Design Freeze exige reconciliar a arquitetura aprovada e todas as jornadas.

## Quantidade e navegação

**9 páginas funcionais propostas**, reutilizando a sala nos estados agendado, ao vivo e encerrado. Não criar uma página para cada estado ou modal. Não acrescentar cadastro, recuperação, checkout, pagamento real, frete, assinaturas, administração ou landing comercial.

| Nº | Página / rota proposta | Público | Conteúdo principal |
| --- | --- | --- | --- |
| 1 | Vitrine `/` | Todos | Lotes ao vivo, agendados e encerrados |
| 2 | Entrar `/entrar` | Sem sessão | Login das contas de demonstração |
| 3 | Sala `/lotes/:id` | Leitura pública; lance só licitante | Obra, disputa, histórico, posição e prazo |
| 4 | Meus lotes `/painel/lotes` | Leiloeiro | Lotes próprios, resultados e total recebido |
| 5 | Criar lote `/painel/lotes/novo` | Leiloeiro | Busca na API, seleção da obra e configuração |
| 6 | Carteira `/carteira` | Licitante | Total, comprometido, disponível e depósito simulado |
| 7 | Meus arremates `/meus-arremates` | Licitante | Participações e lotes vencidos com comprovante |
| 8 | Auditoria `/lotes/:id/auditoria` | Público, sem login | Histórico completo e verificação de integridade |
| 9 | Comprovante `/comprovantes/:token` | Público por link, sem login | Resultado do arremate sem dados pessoais |

Rotas e quantidade são organização proposta, não contagem imposta pela Verzel. Erro 404 e acesso negado são estados compartilhados, não páginas funcionais adicionais. Modal de depósito, confirmação de cancelamento e revisão do lance também não aumentam a contagem.

Entrega sugerida ao Grok: **18 pranchas base** (9 desktop + 9 mobile), mais **1 prancha de design system** e **1 prancha de estados/componentes**: 20 pranchas de referência. Variações de estado podem ser frames vinculados. Os números não autorizam features extras nem dark mode.

## 1 — Vitrine

- Objetivo: escolher um lote e entender seu estado sem precisar entrar.
- Conteúdo: imagem, título da obra/lote, autor ou atributo relevante, origem, estado, lance atual ou inicial, início/fim e ação de abrir sala. Abas/seções ao vivo/agendados/encerrados; paginação.
- Ações: abrir sala; entrar; acessar área correspondente ao papel quando autenticado. Cancelados não aparecem na vitrine.
- Estados: carregando/skeleton, lista vazia por seção, erro com tentar novamente, imagem indisponível com fallback, conectado/degradado quando pertinente. Queda do catálogo externo não bloqueia esses dados persistidos.
- Dados previstos: GET `/api/lots`; navega para sala/login/painel/carteira/arremates conforme permissão.

## 2 — Entrar

- Conteúdo: email, senha, ação de mostrar/ocultar senha, entrar e voltar à vitrine; acesso orientado a contas fictícias de demonstração fornecidas no README final.
- Estados: campo inválido, credenciais inválidas com mensagem genérica, enviando, limite temporário, sessão expirada e erro de rede recuperável. Preservar email após falha.
- Acesso pós-login: licitante volta ao lote de origem quando adequado; leiloeiro abre painel. `returnTo` só pode apontar rota local permitida.
- Sem cadastro/recuperação presumidos. Não desenhar botão sem capacidade implementável.
- Dados previstos: endpoints `/api/auth/*`; não exibir token, stack ou status técnico.

## 3 — Sala do lote

- Conteúdo: imagem e atributos persistidos, origem/crédito, valor inicial, incremento mínimo, lance atual, mínimo para próximo lance, início/fim, contagem regressiva, histórico com aliases e horário, posição própria (1º/2º etc.) e link para auditoria.
- Licitante: campo/ação com valor explícito e confirmação contextual; saldo disponível e compromisso relacionados à decisão; pending impede duplo clique. O backend confirma o lance antes do estado de sucesso.
- Visitante: leitura e convite para entrar. Leiloeiro: leitura sem ação de lance. Líder: “Você está ganhando”, lance indisponível. Superado: “Você foi superado”, próximo mínimo atualizado.
- Estados de lote: agendado; ao vivo; prorrogado; encerrado com resultado em processamento; encerrado com vencedor; encerrado sem lances; cancelado acessado por link.
- Recusas próximas da ação: abaixo do mínimo; saldo insuficiente com link para carteira; já está liderando; ainda não iniciado; encerrado. Atualizar preço/prazo em caso de disputa concorrente.
- Conectividade: reconectando/degradada; não afirmar preço atual com dado antigo. Erro de confirmação: informar que resultado precisa ser consultado antes de nova tentativa, sem afirmar que houve ou não lance.
- Prorrogação aprovada por Fernando: lance nos últimos 2min renova o fim para 2min após a aceitação. Cronômetro muda com indicação compreensível e não depende do relógio local para decidir lance.
- Dados: GET lote/histórico; POST lance; SSE; snapshot após reconexão. Compartilhar o link da sala é permitido; saldo e identificação pessoal não entram no payload público.

## 4 — Meus lotes / painel do leiloeiro

- Conteúdo: lotes próprios por estado, imagem/título, lance inicial/atual/final, datas, número de lances, resultado arrematado/não arrematado e **total efetivamente recebido**, sem somar disputa ainda aberta.
- Ações: criar lote, abrir sala, ver auditoria/comprovante público e cancelar lote elegível.
- Cancelamento: confirmação informa consequência; só sem lances e antes do encerramento. Se primeiro lance vencer a corrida, mostrar recusa e atualizar dados; nunca aparentar cancelamento concluído antes do servidor.
- Estados: vazio com CTA criar, carregando, erro, cancelando, cancelado, resultado em processamento. Lotes cancelados seguem no painel do dono, embora fora da vitrine.
- Dados: GET `/api/seller/lots`, `/seller/summary`; POST cancelamento.

## 5 — Criar lote

- Um fluxo na mesma página, em etapas ou seções: **buscar obra → selecionar → configurar → revisar/publicar**.
- Busca: termo, resultados com imagem/título/autor/origem, paginação e seleção. Apenas item obtido da API pública, sem upload ou URL arbitrária.
- Configuração: obra selecionada e atributos; lance inicial, incremento mínimo, data/hora de início e fim. Exibir moeda e fuso. Dados do item não podem ser falsificados pelo navegador.
- Revisão: obra, valores e período completos antes de publicar; indicar que o item será usado numa simulação. Não sugerir compra real da obra original.
- Estados: buscando, sem resultados, provider indisponível/limite com tentar novamente, imagem/licença não apta, importando, erro de campo, publicando e sucesso com link para sala/painel. Nunca apagar os campos preenchidos após erro recuperável.
- Dados: GET catálogo; POST lotes. Publicação só termina quando snapshot e imagem estiverem persistidos corretamente.

## 6 — Carteira do licitante

- Exibir **saldo total**, **saldo comprometido**, **saldo disponível**, com explicação curta do compromisso e ligação aos lotes em que lidera.
- Ação: adicionar saldo **simulado**, valor claro e confirmação/pending; nada de Pix/cartão/dados bancários. Repetir request não pode duplicar depósito.
- Estados: saldo zero, depósito inválido, pendente, sucesso, erro e confirmação indeterminada; saldo atualizado ao ser superado ou na liquidação. Não animar crédito antes da confirmação real.
- Dados: GET wallet, POST deposits, evento privado da sessão. A página não é carteira do leiloeiro; recebimento dele está no painel.

## 7 — Meus arremates

- Seções/abas na mesma página: participações e vitórias. Participações incluem lotes em disputa e encerrados, mesmo perdidos; mostrar próprio maior lance/posição e estado.
- Arrematados: obra, valor final, encerramento, comprovante e copiar link de compartilhamento. Comprovante só depois de liquidação confirmada.
- Estados: sem participação, sem vitórias, carregando, falha, disputa encerrada/processando resultado, link copiado/erro ao copiar.
- Dados: GET `/api/me/bids` e `/me/awards`. Não misturar lista de todos os usuários.

## 8 — Auditoria pública

- Identidade do lote, origem, histórico **completo**, sequência, alias do licitante, valor e horário. Navegação paginada acessível; verificação considera todo o histórico, não só página visível.
- Resultado destacado com texto/ícone: íntegro; adulterado; temporariamente não foi possível verificar. Data/versão da verificação, contagem e explicação curta da técnica e seus limites.
- Falta de dados/testemunha não pode parecer “íntegro”. Não usar nome/email/IP, IDs internos de usuário ou credenciais. Integridade de DB não é certificação de propriedade/autenticidade física da obra.
- Estados: verificando, sem lances íntegro se gênese válida, adulterado, indeterminado/erro recuperável e lote removido com evidência remanescente. Link para sala e comprovante se existente.
- Dados: GET `/api/lots/:id/audit`; histórico paginado associado à mesma revisão.

## 9 — Comprovante público

- Obra/lote, identificador de comprovante, alias vencedor, identificação pública não pessoal do leiloeiro, valor final, datas e link para auditoria. Aviso de simulação.
- Copiar link e imprimir pelo navegador; sem botão “baixar PDF” até existir tal capacidade aprovada. Layout imprimível deve preservar a informação principal.
- Estados: carregando, válido, token inexistente, resultado ainda indisponível e integridade não verificável/adulterada. Não apresentar confiança visual positiva quando auditoria falhar.
- Dados: GET `/api/receipts/:token`; sem login ou PII. Token aleatório não é promessa de que o documento seja privado: ele é compartilhável e deve conter somente informação pública.

## Design system e acessibilidade

Incluir os assets de [metadados/compartilhamento](../metadados.md): favicon, apple-touch-icon e imagem Open Graph (referência 1200 × 630), com versão genérica da simulação e composição reutilizável de obra/lote. Prever título/descrição por página e alt da imagem social; não exibir saldo, dados pessoais ou preços/prazos voláteis no preview. São assets complementares, não páginas extras.

Grok entrega tokens de cor/semântica, tipografia, espaçamento, raio, sombra, camada, foco e motion; componentes/variantes; grid e comportamento de desktop/mobile; formulários/valores monetários/datas; status de lote e integridade; skeletons, alertas e mensagens; diálogo de confirmação e navegação por papel.

**shadcn é obrigatório por U13.** Grok define o visual sobre essas primitivas; nome final, logo e paletas serão decididos com Fernando e registrados em [decisões visuais](DECISOES-VISUAIS.md). Casa de Leilões é provisório. Nenhuma skill externa pode substituir o design aprovado. Uma fonte canônica visual; DESIGN.md e `.design-system/` serão derivados dela na implementação, sem criar uma segunda direção.

Metas de aceite propostas: WCAG 2.2 AA nas jornadas; labels e erros associados; teclado e foco visível; diálogo com foco contido/retorno; não depender só de cor; alvo de toque confortável; zoom de 200%; reduced motion. Atualização de lances usa anúncio acessível moderado, não leitura de cronômetro a cada segundo.

Referências de viewport para pranchas: desktop 1440px e mobile 390px, validando posteriormente 320px e tamanhos intermediários. Escolha dos breakpoints faz parte do design; nenhuma ação obrigatória pode desaparecer no mobile. Lista/histórico longo deve continuar legível sem overflow horizontal acidental.

## Critérios para aceitar as pranchas

- Cada R06-R15 aparece em pelo menos uma página/estado.
- Cada botão tem ação prevista e permissão correspondente.
- Dados exibidos têm fonte; nenhuma avaliação, estatística, preço, depoimento ou funcionalidade comercial inventada.
- Valores sempre simulados; imagens com origem e licença verificadas.
- Jornadas completas nos dois tamanhos, inclusive erro/reconexão/encerramento.
- Fernando aprova o design system e pranchas; registrar a versão/link no projeto. Só então avaliar S6 PASSED.
