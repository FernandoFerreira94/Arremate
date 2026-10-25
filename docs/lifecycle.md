# Lifecycle e aplicação do Boot

Data de consulta/registro: 23/10/2026. [Projeto no Notion — privado](https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9). Controlador: [Project Lifecycle — Autonomous Workflow](https://app.notion.com/p/3c3d66ddfe93816e8b7cef1c8bc7c766).

## Lifecycle Control — pré-desenvolvimento

```text
Lifecycle version: 1.0
Current stage: S9 — Tarefa 3 concluída localmente; S5 continua aberto como risco aceito (D13)
Stage status: IN_PROGRESS — sessão, CSRF e proxy `/api` aplicados. Tarefas 1 e 2 permanecem. S6 aceito com HTML/PNG, sem Penpot (D13). S7 não declarado. S5 não marcado PASSED
Execution profile: STANDARD proposto; gates reforçados de saldo/auth/integridade
Last gate: S4 — PRE-DEVELOPMENT ALIGNED; S6 aceito por D13 sem fechar S5/S7
Last validation: 2026-10-23
Canonical project page: https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9
Current source: plano superpowers, Tarefa 3 concluída
Next action: Tarefa 4 (catálogo), somente quando Fernando pedir; topologia concreta antes do release, sem contratar
Next source: plano superpowers, Tarefa 4
Blockers: nenhum da Tarefa 1; riscos aceitos (D13): Architecture Freeze não aprovado; fornecedor/custo de API/DB e integração Vercel não definidos
User decision required: só para push/deploy/gasto e escolhas do S5 quando a tarefa exigir
Implementation authorized: yes, a partir da Tarefa 1 (D13): migration só local, commits locais, sem push/deploy
```

U12 autorizou explicitamente criar casadeleilao, instalar a base e aguardar design. Essa instrução do usuário permite bootstrap antecipado sem fingir S5/S6/S7 aprovados. AGENTS/.ai/tooling/health/placeholder foram criados; produto não foi implementado. U13 pede plano completo e fixa shadcn; nome/logo/paletas ficam com Grok/Fernando. Não marcar IMPLEMENTATION READY pela instalação.

## S0 — Intake: PASSED

- Problema/resultado: cumprir desafio de codificação da Verzel, demonstrando fluxo de leilões confiável e explicável.
- Público: avaliadores e usuários fictícios nos papéis leiloeiro/licitante; visitante público para consulta/auditoria/comprovante.
- Contexto: avaliação técnica com prazo, deploy público obrigatório e declaração de IA. Não há hipótese de abrir negócio de leilão real.
- Restrições explícitas: PDF integral; React/Node/PostgreSQL; Grok no design; baixa complexidade; decisões e testes documentados; revisão obrigatória.
- Evidência: e-mail de codificação, leitura visual integral de 7 páginas, respostas de Fernando para arte e anti-sniping.

## S1 — Validação: PASSED, GO WITH CONDITIONS

O projeto é um exercício prescrito pela seleção, não uma aposta comercial. Mercado/pricing/ICP pagante/faturamento são N/A nesta entrega. A evidência de demanda é o próprio desafio fornecido, não validação de mercado inventada. O pedido explícito de Fernando para preparar esse projeto fundamenta avançar sua definição.

Condições: simulação explícita sem venda/pagamento real, nenhuma alegação de propriedade de obras do museu, respeitar origem/licença de imagens; priorizar obrigatório e riscos do backend; publicar só após testes/review/autorização. Alternativas de processo: entregar apenas obrigatório com qualidade; extras da página 6 só depois. Referências de mercado citadas pelo PDF servem de inspiração visual ao Grok, não de justificativa para ampliar produto.

Riscos: pouco prazo, concorrência/saldo, recuperação da auditoria, persistência da hospedagem, falhas do provider e sincronização ao vivo. Conhecimento cross-project foi obtido nos AGENTS de Axion/Colinas pedidos por Fernando. Consulta Obsidian adicional: N/A nesta rodada; não há lacuna histórica que a justifique e sua indisponibilidade não bloqueia este gate.

## S2 — Template Master: PASSED

| Gate | Estado / evidência |
| --- | --- |
| G0 Discovery | DEFINED — desafio, público, resultado e não objetivos registrados |
| G1 Product Model | DEFINED — R01-R33, papéis, lote/carteira/lance/resultado/auditoria e 9 páginas propostas |
| G2 Domain/Legal | DEFINED no recorte de simulação; licenças de imagens são condição de importação; nenhuma alegação de conformidade jurídica comercial |
| G3 Identity/Permissions | DEFINED conceitualmente — dois papéis, dono do lote, carteira privada e consulta pública; mecanismo técnico vai para S5 |
| G4 Data/Privacy | DEFINED — PII/credenciais privadas; aliases públicos; valores simulados; retenção durante avaliação e descarte controlado após decisão do responsável |
| G5 Integrations/Operations | DEFINED conceitualmente — API só origina item; snapshot é autoridade local; logs/health/backup/restore necessários; provider/hosting técnico em S5 |
| G6 Commercial | N/A — sem receita, planos, pagamentos ou negócio comercial nesta avaliação; custo de hospedagem permanece decisão de S5 |
| G7 UX Requirements | DEFINED — briefing com conteúdo, papéis, fluxos, estados e mobile; sem visual congelado |
| G8 Ready for Pre-Dev | DEFINED — questões técnicas roteadas explicitamente para S5 |

Dados conceituais: usuários/credenciais (pessoal/secret), sessões (secret), snapshots e aliases (públicos), lotes/lances/valores simulados (públicos por projeção), carteira individual/idempotência (internos), chave/testemunha (restritos). Não coletar documentos, endereço ou dados bancários. Não emitir lei/prazo legal inventado; retenção pública real antes de uso comercial exige reavaliação.

Módulos e authorities: identidade, catálogo importado, lotes, carteira, lances, encerramento/recibos, integridade. Valores/estado/prazos pertencem ao backend; catálogo não é autoridade de dinheiro; Grok não define novas regras de negócio. SaaS, billing, email, IA no produto, mobile nativo e uploads de usuários são N/A.

## S3 — Pesquisa de lacunas: PASSED

- Fórmula de prorrogação ambígua resolvida por Fernando: renovar para 120s após lance aceito na janela final.
- Obras públicas escolhidas por Fernando; documentação oficial do Met confirma possibilidade de metadados/imagens Open Access e mudança para busca v1.1. Licença de cada item e smoke real ainda exigidos em execução, sem declarar já validados.
- PostgreSQL: locks/ordem e diferença entre clock real/transacional consultados em fonte oficial. OWASP: sessão/CSRF/senhas consultados para alimentar S5.
- Identificada limitação de hash somente no DB; a proposta de testemunha independente está em S5, não tratada como solução já testada.
- Regras de Axion/Colinas reconciliadas por aplicabilidade; sem copiar tenancy, marcas, portas ou reads decisórios fora do lock.

Nenhum blocker pesquisável de definição de produto ficou escondido. Testes técnicos futuros, escolha de mecanismo/provedor e aceite da topologia são tratados nos gates correspondentes, não como evidência já existente.

## S4 — Pre-Development: PASSED / PRE-DEVELOPMENT ALIGNED

Cross-check: atores ↔ permissões; estados ↔ lances/prazo; carteira ↔ concorrência; comprovante/auditoria ↔ privacidade; API ↔ persistência/falha; telas ↔ ações/estados; operação ↔ armazenamento/restore; testes ↔ invariantes. Produto e design pendente estão separados. Roadmap é por capacidade, não por quantidade de arquivos/telas.

Findings: WARNING — prazo e hospedagem ainda dependem de escolhas/aprovação; INFO — design não fornecido e não é gate de S4; RECOMMENDATION — usar baseline STANDARD com rigor específico nos módulos críticos. Decisões técnicas abertas foram encaminhadas a S5, sem fingir freeze.

## S5 — Proposta e decisão necessária

[A01-A13 e arquitetura](superpowers/specs/2026-10-23-casa-leiloes-design.md). Fernando confirmou **site na Vercel + API Node persistente separada**. A hipótese anterior de único servidor para todo o site foi substituída; [hospedagem](hospedagem.md) detalha a compatibilidade. Ainda fechar fornecedor/custo de API/DB, persistência/backup, proxy/cookies/SSE e proxy/SSE; A01/head agora usa Next nativo. Não escolher plano pago, expor servidor ou armazenar chave por inferência.

Next/Nest/Prisma foram selecionados tecnicamente no bootstrap; auth/realtime/integridade de domínio ainda são propostas a provar. React/Node/PostgreSQL e decisões U01-U13 permanecem conforme [registro de decisões](decisoes.md). A técnica de integridade deve ser demonstrada na primeira capacidade S9; se falhar, voltar ao menor gate S5 afetado, sem recomeçar todo o projeto.

## S6 em diante — ainda não executados

- S6: Grok produz pranchas/design system; Fernando aprova; cruzar com arquitetura congelada.
- S7: reconciliar produto/arquitetura/design, fechar stop-ship e obter autorização explícita de implementação.
- S8: bootstrap local antecipado por autorização U12: contexto/tooling/scaffold mínimo, sem DESIGN.md final. Registrar essa exceção; reconciliar o restante do Boot no handoff. Skills já disponíveis KEEP; não instalar duplicatas.
- S9: executar plano com red/green/review/evidência; primeira prova é integridade, depois autenticação, catálogo, disputa e liquidação.
- S10/S11/S12: saúde, release, deploy autorizado e operação verificados. Nenhum desses gates foi declarado aprovado.

## Stage History — 23/10/2026

| Transição | Gate / fundamento |
| --- | --- |
| Inicialização → S0 | Projeto de análise criado como rascunho privado no Notion; não havia projeto Verzel localizado |
| S0 → S1 | Intake do desafio normalizado, sem inventar negócio |
| S1 → S2 | GO WITH CONDITIONS no escopo técnico já solicitado; condições de simulação e qualidade preservadas |
| S2 → S3 | Produto conceitual preenchido a partir do PDF |
| S3 → S4 | Lacuna de anti-sniping resolvida pelo usuário; pesquisa técnica/origem registrada |
| S4 → S5 | PRE-DEVELOPMENT ALIGNED; escolhas técnicas explicitamente abertas |
| S5 → WAITING_USER | Proposta para revisão; freeze material depende de Fernando; implementação continua não autorizada |

## Diagnóstico inicial de tooling — histórico anterior a U12

Cliente: Codex desktop/PowerShell. Pasta nova, sem aplicação, manifest, lockfile, Git ou CI observados. Stack parcialmente definida pelo usuário. Git/branches/proteções, lint/format, testes, CI/CD e observabilidade: MISSING no projeto; decidir baseline, não instalar nesta etapa. UI/motion: N/A para instalação agora, aguardando Grok; bibliotecas candidatas só após aprovação. Graphify executável existe no host, mas não há código/indexação útil ainda. Serena não está exposta entre ferramentas desta sessão; fallback futuro = Graphify + buscas dirigidas; não fingir navegação semântica disponível.

## Manutenção do contexto

Complemento U08 de 23/10/2026: Fernando pediu foco nos metadados. [Especificação](metadados.md) adicionada ao plano e ao briefing do Grok, com T16. A política de indexação/head permanece proposta em S5; não constitui aprovação da arquitetura, instalação ou início de implementação.

A página Notion do projeto guarda estado/decisões canônicos de pré-desenvolvimento; docs locais são sua documentação solicitada e devem ser reconciliados com ela. No S8, `.ai/` será cache compacto aprovado. Não atualizar memórias globais nem copiar histórico de sessão em todos os arquivos. Registrar teste executado em evidence; decisão durável na fonte apropriada. Se mudar produto, arquitetura ou fluxo, verificar fonte ↔ docs ↔ código e invalidar apenas gates dependentes.

Registro histórico U09-U11 de 23/10/2026, anterior a U12: fronteira Vercel/site + API persistente confirmada; README completo migrado para [página própria no Notion](https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82); pasta docs organizada com [índice](INICIO.md) e [prompt Grok](design/PROMPT-GROK.md). A exploração visual está solicitada, mas S5/S6/S7 não foram declarados aprovados. Boot completo permanece no README fonte Notion.

## Atualização U12/U13 — bootstrap antecipado e plano completo

Pasta canônica casadeleilao criada sem apagar a pasta anterior. Base npm/Next/Nest/Prisma/PostgreSQL instalada; testes de infraestrutura e limites em docs/evidence/2026-10-23-bootstrap.md. Shadcn obrigatório; tema/componentes finais aguardam artefatos. Plano de dez capacidades substitui a sequência P0–P8 inicial. S5 segue parcialmente aberto; S6/S7, release e deploy não aprovados. README fonte Notion atualizado com Boot e esta exceção explícita.

Design e AGENTS de 23/10/2026: pasta oficial confirmada por Fernando = `casadeleilao`; a pasta `casa de leilao` (com espaço) fica como cópia antiga, sem apagar. Pranchas 00–13, assets (incluindo `assets/meta`), `INDICE.md` e [HANDOFF-GROK](design/HANDOFF-GROK.md) salvos em `docs/design/pranchas/` e `docs/design/`. Fernando aprovou D01–D08 ([decisões](decisoes.md)); seção PD adicionada ao [plano](superpowers/plans/2026-10-23-casa-leiloes.md). AGENTS.md raiz/front-end/back-end ganharam boas práticas genéricas de Axion/Colinas, sem regras de negócio deles; CLAUDE.md aponta para AGENTS.md. Pendentes: paginação de 8 itens, atalhos de depósito 1k/5k/10k e textos/códigos de erro. Design Freeze, S6 e S7 não declarados; implementação continua não autorizada.

Design Freeze de 23/10/2026: Fernando aprovou tudo (“aprovo tudo”): logo, paginação de 8 itens, atalhos de depósito 1k/5k/10k e Design Freeze ([D09–D12](decisoes.md)). Checklist do gate de design, conforme registrado aqui: identidade (nome, logo, paleta, tipografia, tema) LOCKED ✅; pranchas 00–13 desktop+mobile com estados ✅; tokens mapeados para shadcn e assets licenciados (Met CC0, lucide ISC) ✅; metadados (favicon, apple-touch, OG+alt) ✅; cobertura R/U no HANDOFF §8/§8b ✅; [decisões visuais](design/DECISOES-VISUAIS.md) atualizadas ✅. Pendentes: validação de a11y (teclado, leitor de tela, 320px, zoom 200%) e textos/códigos de erro com o back, ambos para a implementação; DESIGN.md e `.design-system/` ainda não derivados (Tarefa 8). O checklist completo do Design Gate no Notion não foi reconferido. S5 (Architecture Freeze) continua aberto; S6, S7 e a autorização de implementação **não** foram declarados.

Liberação D13 (23/10/2026 10:26): Fernando: “Libero: aceito HTML/PNG sem Penpot, arquitetura em aberto como risco, e Tarefa 1 com migration local e commits locais”. S6 aceito com HTML/PNG como fonte visual; itens abertos do S5 ficam como risco, decididos por tarefa (S5 não marcado PASSED); implementação autorizada a partir da Tarefa 1, migration só local, sem push.

Tarefa 1 concluída em 23/10/2026: handoff D01–D14 registrado, `parseMoney`/`formatMoney`/`parsePositiveMoney`, schema do núcleo e migration `20261023104706_auction_core` aplicada só em 127.0.0.1:5462 (`casadeleilao`) e 127.0.0.1:5463 (`casadeleilao_test`). Evidência em [docs/evidence/2026-10-23-tarefa-1.md](evidence/2026-10-23-tarefa-1.md).

Tarefa 2 concluída em 23/10/2026: cadeia HMAC e testemunha fora do banco, com falha de checkpoint INDETERMINATE. Evidência em [docs/evidence/2026-10-23-tarefa-2.md](evidence/2026-10-23-tarefa-2.md). S7 e release continuam não declarados. Topologia de produção e fsync de diretório no Linux seguem em aberto; nada foi contratado.

Tarefa 3 concluída em 23/10/2026: sessão opaca, CSRF, papéis e proxy same-origin. Evidência em [docs/evidence/2026-10-23-tarefa-3.md](evidence/2026-10-23-tarefa-3.md). O rewrite externo do Next não encaminhou o cookie; o caminho `/api` ficou no Route Handler. Produção da API continua sem fornecedor. Nada foi contratado.

## Entrada animada — 24/10/2026

D17: Fernando aprovou e autorizou implementar a direção visual proposta. Extensão localizada ao shell/frontend, sem dependência/schema/config de negócio novos; identidade D01–D12 preservada. Plano e evidência próprios em docs/superpowers/plans/2026-10-24-entrada-animada.md e docs/evidence/2026-10-24-entrada-animada.md. Motion validado em build local de produção; nenhum deploy/push efetuado. Demais riscos/gates do projeto permanecem conforme suas fontes.

## D19 — Ritmo mais lento — 24/10/2026

Calibragem visual solicitada: splash3s, componentes850ms e saída800ms. Mesma identidade/sem dependências novas; foco permanece visível. Browser isolado6checks e tipos/lint/build frontend; suíte integrada bloqueada por Docker desligado. Não altera status de release ou decisões de infraestrutura. Registro completo em docs/evidence/2026-10-24-entrada-animada.md.

Revalidação D19 com Docker ativo (24/10/2026):20E2E aprovados, exit0, em build próprio web3310/API4310 e PostgreSQL de teste5463. Bloqueio de ambiente resolvido; nenhuma alteração de código/migration/config ou status de release/deploy.


## D20 — Preparação do Supabase — 24/10/2026

Executada a preparação local da etapa 7, independente das pranchas solicitadas ao Fred: seleção de DIRECT_URL no Prisma CLI, exemplo vazio, guia de pooler/TLS/permissões e Data API desligada. Sem acesso/migration/seed/deploy hospedado e sem mudança de UI/schema/dependências. S5/S7/release permanecem conforme os gates existentes. Evidência: docs/evidence/2026-10-24-auth-pagamentos.md. Etapas 1–6 de auth/pagamentos seguem abertas; uso real do Supabase aguarda projeto/credenciais/OK de Fernando.


## D21 — Auth/pagamentos, etapa 1 — 24/10/2026

Aplicada A7 com faixa/rodapé e recursos Next previstos no pedido: imagens otimizadas com fallback, estados por rota e OG por lote. Evidência consolidada em docs/evidence/2026-10-24-auth-pagamentos.md. Tokens, next/font e alterações paralelas preservados. Sem concluir etapas2–6 ou release. Supabase arremate-verzel provisionado com autorização direta; Custelo já inativo. Schema/seed/deploy hospedados seguem sem autorização. Notion continua pendente do bloqueio automático informado.
