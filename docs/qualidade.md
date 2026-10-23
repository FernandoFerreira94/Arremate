# Qualidade, testes e revisão

## Regra permanente solicitada por Fernando

Cada capacidade percorre requisito → teste que falha pelo motivo correto → implementação mínima → teste passando → refatoração sem quebrar → revisão de código/segurança → evidência registrada. Sem revisão não há tarefa concluída. Documento/infra sem lógica não precisa de teste artificial que só confira texto; exige validação adequada ao artefato.

Uma capacidade não pode passar com achado BLOCKER ou falha High/Critical. Warning tem impacto/dono/ação explícitos; recomendação não vira bloqueio. O autor reconcilia o review com código e contrato, sem aceitar correções cegamente.

## Matriz de testes planejados

| ID | Nível | O que deve ser provado | Requisitos |
| --- | --- | --- | --- |
| T01 | API/integrado | Sessão válida/expirada/revogada; logout; papel errado; ownership; CSRF; mass assignment; nenhum token/PII público | R02,R03,R27 |
| T02 | Unitário/integrado | Primeiro lance abaixo/igual/acima; seguintes no mínimo; líder repetido; cancelado/agendado/vencido | R15,R17-R19 |
| T03 | PostgreSQL real | Lance reserva saldo; superação libera imediatamente; reserva em vários lotes não excede total | R20-R22 |
| T04 | Concorrência DB | Dois lances simultâneos no mesmo lote respeitam sequência/mínimo; uma carteira com saldo 150 disputando dois lotes de 100 só lidera um | R18,R20-R22 |
| T05 | Tempo unitário/integrado | Fronteiras do início/fim; faltando 120s/119s/1s; recusa não prorroga; lance aguardando lock até após fim é rejeitado | R17,R23,U03 |
| T06 | Concorrência DB | Cancelamento × primeiro lance; dois liquidadores; lance × encerramento/prorrogação; depósito × lance | R08,R17,R23-R25 |
| T07 | DB/restart | Débito/crédito/recibo uma vez; sem vencedor sem movimento; queda antes/depois de commit; recuperar lotes vencidos no startup | R24,R25 |
| T08 | DB/HTTP | Mesma chave/corpo retorna mesmo resultado; corpo diferente 409; duas requisições simultâneas não duplicam depósito/lance/liquidação | R03,R20,R24 |
| T09 | DB adversarial | Alterar valor/alias/horário/usuário interno preservando alias, inserir, excluir início/meio/fim/tudo, reordenar, reescrever cadeia e restaurar prefixo antigo: nunca retornar íntegro | R14,R26 |
| T10 | Falhas/auditoria | Falta de chave/testemunha, disco cheio, falha de sync, DB commit sem checkpoint, restart e auditoria concorrente: resultado indeterminado/bloqueio seguro | R26 |
| T11 | Provider/DB | Timeout, 429, resposta inválida, imagem ausente e URL para IP privado; queda total do provider não afeta lote/sala/recibo/auditoria existentes | R01,R07,R16 |
| T12 | E2E 2 sessões | Dois licitantes disputam sem refresh; status/ranking/fim/carteira sincronizam; SSE desconecta/reconecta e expira sessão sem vazar saldo | R10-R12,R27 |
| T13 | E2E | Login seed → depósito → lance → superação → arremate → comprovante público → auditoria sem login | R03,R12-R14,R24,R30 |
| T14 | UI/a11y | Teclado, foco de diálogo, label/erro, contraste, toque, zoom, estados responsivos e reduced motion conforme design aprovado | R06-R15 |
| T15 | Release | Instalação limpa, migrations, seed não destrutivo, lint/typecheck/build/CI; URL pública; dados demo; restore de DB+mídia+testemunha | R05,R28-R33 |
| T16 | HTTP/E2E/segurança | Head no HTML inicial sem JS, títulos/OG por rota, assets sociais, canonical confiável, noindex/robots/sitemap, 404 e ausência de PII/injeção; navegação/logout restaura head | U08; [contrato e casos](metadados.md) |

Integração deve usar PostgreSQL da versão escolhida, conexões independentes e barreiras para corridas; SQLite/mock de repository não prova lock. Testes temporais do domínio usam relógio controlável; teste após lock usa relógio real do DB. Não dormir dois minutos nos testes: preparar datas/injetar clock onde cabível.

Teste de adulteração utiliza apenas banco isolado descartável e credencial de teste autorizada. Não adulterar demonstração publicada nem desligar controles reais para fazer teste.

## Gate de cada tarefa

1. Requisito e critério de aceite identificados; diff restrito ao escopo.
2. Lint e TypeScript strict do pacote afetado; tipos de specs também verificados.
3. Testes do caminho e riscos alterados. Financeiro/auth/integridade exigem positivos, negativos e falha/retry/concorrência aplicáveis.
4. Review independente para regras críticas e revisão de segurança de todo diff, conforme pedido de Fernando. Review inclui consumidores, DTOs, persistência e contratos, não apenas linhas novas.
5. Corrigir findings relevantes e repetir apenas as verificações atingidas; registrar o limite de validação.
6. Atualizar decisões, contratos, mapa de telas e status somente quando alterados; registrar evidências abaixo. Commit só quando autorizado, com caminhos explícitos e diff revisado; nunca push/deploy implícito.

## Registro obrigatório de execução

Um registro por capacidade, em `docs/evidence/<data>-<capacidade>.md`, quando o trabalho ocorrer:

```text
Capacidade / requisito / tarefa:
Data, commit ou estado do código, ambiente e versões:
Teste de regressão/red: comando, motivo da falha, saída e exit code:
Green e verificações: comando exato, resultado, saída resumida, duração:
Banco/provider: real, mock ou fixture; o que cada um prova:
Review: revisor/contexto, arquivos, findings, severidade, correção e reteste:
UI: fluxo, viewport, evidência quando aplicável:
Limites/falhas abertas/riscos:
Decisões e documentos atualizados:
Resultado: PASS / FAIL / BLOCKED / NOT RUN
```

Não guardar credenciais, cookies, tokens, links assinados de download ou PII nas evidências. Não preencher saída esperada como resultado real. Contagem de testes e percentual de cobertura isolados não demonstram corretude.

## Registro histórico de pré-desenvolvimento — até U11

- **Executado:** Gmail conectado verificado; e-mail de codificação e anexo obtidos; PDF de 1.971.714 bytes e 7 páginas preservado; extração textual constatada vazia; todas as 7 páginas renderizadas e lidas visualmente; SHA-256 registrado em requisitos.
- **Executado:** leitura dos AGENTS.md raiz/front/back de Axion e Colinas; consulta ao Dev Hub atual, Lifecycle, Boot, Boot Assets, Idea Validation, Template Master, Pre-Development, Project Init, Design Gate, Handoff e Quality Gates.
- **Decisões do usuário:** arte pública e fórmula de prorrogação confirmadas por respostas explícitas.
- **Executado — review independente em contexto separado:** P1 encontrado na proposta (assinatura não protegia usuário interno do lance); contrato corrigido incluindo `bidderUserId` e teste T09. Revisor confirmou a correção. Uma referência ao Lifecycle ainda em escrita foi apontada e, após o arquivo existir, revalidada; nenhum outro finding material de cobertura/contratos/gates identificado. Review de documentação, não de código inexistente.
- **Executado — validação documental:** Python verificou 8 documentos, presença dos 33 IDs R01-R33, nenhum link Markdown local quebrado e SHA-256 do PDF igual ao registrado; exit code 0. Verificação não executa links HTTP nem comprova comportamento da aplicação.
- **NOT RUN:** testes de aplicação, lint, typecheck, build, migrations, teste real do provider, concorrência, auditoria, E2E e deploy. Não existe aplicação nesta etapa.
- **Complemento U08 — executado:** especificação de metadados vinculada ao plano/spec/Grok/README; T16 planejado. Nova checagem documental: 9 documentos, zero links locais quebrados, exit code 0. Testes HTTP/E2E dos metadados permanecem NOT RUN.
- **Complemento U09-U11 — executado:** README completo migrado para página própria no Notion e lido de volta; local virou ponteiro. Fronteira Vercel/web + API persistente confirmada; índice, decisões, hospedagem e prompt do Grok criados. Checagem Python: 13 documentos, R01-R33 presentes, zero links locais quebrados, exit code 0. Nenhum manifest/aplicação criado; testes de aplicação seguem NOT RUN.
- **Review do handoff U09-U11 — executado:** revisor independente não encontrou conflito material entre prompt, 9 páginas, permissões, fronteira Vercel/API, README no Notion e gates. Exploração visual solicitada foi distinguida de implementação/Design Freeze aprovado.

## Release Review separado de conclusão de tarefa

Checklist obrigatório antes de publicação: todos os R01-R33 verificados; nenhum High/Critical aberto; build/CI e testes críticos verdes; DB/volumes/chaves configurados; ensaio de backup/restore; TLS/cookies/CSRF; seed disponível; fluxo em duas sessões; comportamento com provider indisponível; migrações/rollback; logs/health e monitoramento; README reproduzível; declaração de IA factual. Resultado READY / READY WITH WARNINGS / BLOCKED com motivos. Publicação e formulário exigem autorização específica de Fernando.

## Estado atual U12/U13

Bootstrap antecipado autorizado, plano completo e correções de review registrados em [evidência](evidence/2026-10-23-bootstrap.md). Os NOT RUN acima descrevem a etapa anterior. Apenas testes da fundação foram executados; domínio e release continuam pendentes. Consulte também docs/design/DECISOES-VISUAIS.md: shadcn obrigatório e marca/paleta aguardando aprovação.

