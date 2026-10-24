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
