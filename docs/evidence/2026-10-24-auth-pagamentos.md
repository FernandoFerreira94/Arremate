# Auth e pagamentos — evidência de 24/10/2026

## Recorte executado: etapa 7 — preparação do Supabase

Fernando pediu adiantar uma tarefa independente das pranchas do Fred. Esta evidência cobre somente a etapa 7; faixa/imagens/estados, cadastro, Pix, histórico/extrato, cartão e Google continuam pendentes. Código na pasta canônica casadeleilao, branch chore/bootstrap, base ed56c70. Sem UI, schema/migration, dependência nova ou alteração de .env.

D20 registra Supabase somente PostgreSQL. D19 já pertence à entrada animada e foi preservada. Novos arquivos de proposta/pranchas e alterações de motion/config do outro agente permanecerão fora do commit desta etapa. Prazo operacional do pedido atual: 29/10/2026 às 18h, America/Sao_Paulo.

## Implementação

- Prisma CLI prefere DIRECT_URL não vazia; DATABASE_URL é o fallback local. API continua usando apenas DATABASE_URL e o pool pg existente.
- DIRECT_URL vazia em .env.example. Nenhuma URL/credencial hospedada preenchida ou consultada.
- Guia em docs/hospedagem.md: Session pooler 5432 para API persistente; conexão direta ou Session para migrations; TLS/CA com opções próprias de pg e Prisma; papéis runtime/migrador separados; Data API desligada antes das tabelas; ordem de permissões revisada após migrate deploy.
- Passos hospedados são documentação condicionada a OK explícito. Nenhuma operação hospedada executada.

## TDD observado

Comando no diretório back-end: `node --experimental-vm-modules ../node_modules/jest/bin/jest.js --runInBand --runTestsByPath test/prisma-config.spec.ts`.

- RED: 2 falhas reais/6 casos — CLI devolvia runtime em vez de DIRECT_URL; runner sem DATABASE_URL falhava mesmo com DIRECT_URL.
- GREEN após alterar uma linha no config: 6/6 passaram, exit 0.
- Casos: preferência e preservação do runtime; runner sem DATABASE_URL; DIRECT_URL ausente, vazia e espaços; erro com ambas ausentes.
- O teste mocka o carregador dotenv do config e usa URLs fictícias sem senha, sem instanciar clientes/conectar. O setup comum preexistente do Jest carrega o ambiente local internamente; não foi lido como contexto nem teve valores impressos.

## Verificações desta execução

| Comando | Resultado |
| --- | --- |
| `npm run lint` via `& (Get-Command npm.cmd).Source run lint` | Front/back aprovados, exit 0 |
| `npm run typecheck` | Workspaces e tsconfig.tools aprovados, exit 0 |
| `npm test` | 12 suítes, 65 testes aprovados (inclui os 6 novos), exit 0 |
| `npm run test:integration` | 18 suítes, 99 testes aprovados; PostgreSQL local de teste 5463, exit 0 |
| `npm run test:unit --workspace front-end` | 15 arquivos, 51 testes aprovados, exit 0 |
| `npm run db:validate` | Schema Prisma válido; sem migration, exit 0 |
| `npm run test:e2e` | 24 aprovados em 2,8 min, exit 0 — build de produção próprio, web 3310/API 4310/DB 5463 |

A primeira invocação de lint foi reescrita pelo launcher RTK como ESLint na raiz (sem config); o script npm nativo foi então executado corretamente nos dois workspaces e passou. Uma tentativa inicial do Jest fora do diretório backend não encontrou tsconfig; corrigido o diretório sem alterar configuração. Essas falhas de invocação não foram contadas como RED funcional nem como validação aprovada.

Logs locais ignorados pelo Git: .data/supabase-preparacao/. Nenhum valor de segredo incluído nesta evidência.

## Revisão independente e decisões

Revisor isolado, somente leitura; sem acesso a banco hospedado/segredos.

- Corrigido: migration auction_core concede DML em todas as tabelas. Guia agora revoga/verifica acesso runtime à _prisma_migrations **após** migrate deploy e antes de liberar a API, com nova conferência a cada migration.
- Ruling: preservar setup Jest comum, que carrega o ambiente internamente para as suítes autorizadas. O config testado recebe URLs fictícias e mock do seu loader; não há vazamento/conexão real nesse teste. Não alterar o setup global fora deste escopo. Limite residual: o runner padrão mantém o loader preexistente, sem uso dos valores reais neste teste.
- Runtime/CLI separados, fallback, Session pooler, TLS distinto, Data API desativada e variável vazia conferidos. Nenhum High/Critical identificado neste recorte após a correção documental.

## NÃO VERIFICADO / depende de Fernando

Projeto/região/plano e credenciais Supabase; versão do PostgreSQL hospedado; CA/TLS reais; grants e Data API efetivos; aplicação/rollback das migrations hospedadas; seed; backup/restore de banco+mídia+testemunha; custo; deploy. Google Cloud/fluxo real do Google continuam para a etapa própria.

Necessário OK explícito separado para migration, seed e deploy hospedados; não houve push/remote. Nenhuma declaração de release pronto.

## Documentação e commit

Docs locais atualizados por acréscimos restritos à etapa; staging seletivo preserva alterações paralelas. Commit local será identificado no relatório final. Sincronização das duas páginas Notion BLOQUEADA pela revisão automática: ela não reconheceu autorização confiável para enviar este resumo interno aos destinos informados. Nenhum conteúdo foi gravado no Notion. Rascunho concreto para aprovação em [resumo Notion](2026-10-24-notion-supabase-rascunho.md). A preparação está validada localmente; sincronização documental externa permanece pendente.


# Etapa 1 — faixa, imagens e recursos Next (D21)

Retomada após Fernando informar que as pranchas estavam no projeto. A7 conferida visualmente; arquivos A1–A7 e fontes HTML mantidos como material paralelo, sem incluí-los no commit. Base07422af. Código usando o Node24.22.1 do runtime isolado; nenhum Node global alterado.

## Entrega deste recorte

Faixa fixa no header e rodapé com páginas funcionais; next/image com sizes/dimensões e fallback em8usos/7arquivos; origens públicas restritas, sem redirects ou IPprivado. Somente imagem principal da Sala com preload (priority obsoleta no Next16). Loading/error em12segmentos, sem renderizar erros técnicos;404 locais de lote/comprovante criados; o status HTTP real após introduzir loading continua NÃO VERIFICADO. OG individual1200×630 com snapshot público/título/Fraunces600, sem saldo/preço/e-mail. Fonte estática oficial Google Fonts, SILOFL1.1,71.632bytes, SHA256 ff7cf63717c27756df857ca12045a83522569f7b561bedaff813a25274eb263f; origem/licença em front-end/public/fonts/.

## TDD e verificações

- RED unitário:8falhas/14casos em config, OG individual e imagem sanitizada do snapshot; URLs privadas e conteúdo financeiro cobertos.
- RED de navegador: teste da faixa falhou pela ausência de demo-banner, com build/API/banco isolados.
- GREEN focado:14/14 após implementação.
- Lint: aprovado, exit0. Typecheck workspaces/tools: aprovado, exit0.
- Unitários API:65/12suítes, exit0. Front:60/16arquivos, exit0.
- Integração PostgreSQL 5463: 99 testes/18 suítes aprovados, exit0, 236,066s com Node24.22.1.
- Playwright final: BLOQUEADO antes de iniciar os testes. Erro: http://127.0.0.1:4310/api/health/ready is already used. Leitura posterior confirmou 4310/PID29720 e3310/PID17624; nenhum processo foi encerrado. Não reutilizei servidores existentes nem alterei reuseExistingServer:false. Imagem otimizada, OG real, screenshots e status404 seguem NÃO VERIFICADOS nesta implementação.
- Invocação de edição interrompida por proteção contra diferença LF/CRLF; retomada somente na parte não aplicada, sem descartar arquivo. Node global foi identificado como26; gates desta etapa usam explicitamente24.22.1, sem trocar o global.

## Supabase: provisionamento, sem schema da aplicação

Usuário autorizou criar o projeto e confirmou a organização. Lista retornou apenas Custelo INACTIVE. Custo cotadoUS$0/mês; criado arremate-verzel/hrqqppepnmzxrrxxqnsf, sa-east-1, confirmado ACTIVE_HEALTHY, PostgreSQL17.11.0.003. Nenhuma pausa desnecessária ou operação SQL/migration/seed/deploy hospedada. Não foram consultadas/exibidas chaves, senhas ou cookies.

## Conflitos e limites

DECISOES-VISUAIS.md permanece intacto. Cadastro/Pix/cartão eram excluídos por documentos históricos; o pedido atual autoriza o adendo, sem mudar identidade. A7 traz Criar conta, que será conectado só quando a etapa2 criar a rota. A4 traz cartão apenas por botão, enquanto a proposta textual anterior cita campos; conflito registrado para a etapa5, sem decidir UI de cartão neste recorte.

API/credentials/TLS/grants/DataAPI, migrations/seed/backup/deploy no Supabase seguem NÃO VERIFICADOS e dependem de autorização própria; Google depende das credenciais do Fernando. Notion não foi atualizado: bloqueio automático anterior continua pendente de aprovação explícita do resumo/destinos.

Revisão independente concluída, somente leitura, sem High/Critical identificado no recorte. Achado P3 confirmado: após imagem A falhar, trocar paraB e voltar aA mantém fallback até remontagem; reprodução em harness em memória. Minor diferido, sem alegar correção. Revisão pediu verificar HTTP404 com navegador/Twitterbot após loading; teste adicional criado, mas não executado devido à porta ocupada.

Conforme ordem de Fernando para parar em falha, execução interrompida. Nenhum commit desta etapa: HEAD permanece07422af. Index vazio; código/docs/pranchas/motion locais preservados. Não houve push, migration, seed ou deploy hospedado. Próximo passo: identificar/liberar os servidores isolados de teste de forma autorizada, executar a regressão e o E2E, revisar screenshots/OG e só então commitar. A criação do Supabase foi concluída e verificada independentemente deste bloqueio local.


## Retomada e correções de25/10/2026

Ambiente: Docker desligado causava readiness503/time-out; iniciado sem parar outros projetos, db/db-test healthy. Só a API de teste desta execução (PID confirmado) foi encerrada após timeout.

Reproduzidos em E2E os dois problemas: HTTP200 no404 e preview A→B→A sem nova tentativa. ArtworkImage agora remonta seu estado por src. O PNG mockado de1px também produzia naturalWidth0 por correção de densidade do srcset; substituído pelo asset PNG180px existente, sem alterar o comportamento esperado.

A preparação antiga de E2E preservava snapshots de integração que apontavam para mídia ausente. Novo helper prepara5obras/arquivos CC0 no banco5463, depois do reset e antes dos lotes; API usa .data/media-e2e, sem tocar mídia dev. Snapshots são inseridos com campos explícitos e parâmetros SQL; nenhuma alteração de lote já assinado. O teste provider-outage mantém a exigência de imagem carregada, agora pelo optimizer.

A revisão da nova superfície apontou rewrite potencialmente externo e perda dos404 específicos. Ambos foram eliminados da implementação: não há rewrite, redirecionamento ou transporte de cookies/Authorization; NextResponse.next carrega apenas status404/headers públicos. Os seis unitários cobrem ID inválido, origens diferentes, cookies não enviados, inexistência, snapshot semPII, falha temporária e formato do token. Confirmação HTTP real no E2E final ainda pendente.

25/10: lint/typecheck exit0, API65 e frontend66 passaram. Integração/E2E final pendentes. Nenhuma operação nova no Supabase. Notion segue sem gravação externa.
