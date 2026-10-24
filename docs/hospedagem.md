# Hospedagem — Vercel

Escolha confirmada de Fernando em 23/10/2026: **site na Vercel + API Node em serviço persistente separado**. Essa fronteira está definida; fornecedores/custo da API, PostgreSQL, armazenamento e backup ainda devem ser fechados, sem contratar serviços ou publicar por inferência.

## Compatibilidade com a proposta anterior

A09 previa um Node/Nest de longa duração com volumes de mídia/testemunha, executor periódico e SSE em memória. Não mover essa topologia intacta para Vercel Functions. A documentação de runtimes informa filesystem somente leitura com `/tmp` de trabalho; esse espaço não é a testemunha durável independente definida na auditoria. O Cron Hobby atualmente permite execução diária, insuficiente para assumir encerramentos de lotes em poucos segundos. Isso não significa que Vercel não suporte backend: significa que Functions exigem uma arquitetura diferente para esses recursos.

Fontes oficiais consultadas: [runtimes](https://vercel.com/docs/functions/runtimes), [cron e planos](https://vercel.com/docs/cron-jobs/usage-and-pricing), [rewrites externos](https://vercel.com/docs/routing/rewrites). Recursos novos/beta não entram por padrão para contornar uma exigência de persistência.

## Alternativas para Architecture Freeze

| Caminho | Benefício | Trade-off / decisões necessárias |
| --- | --- | --- |
| Escolhido por Fernando: web na Vercel + API Node persistente separada + PostgreSQL e armazenamento durável | Preserva a implementação simples de lock, liquidação, SSE e testemunha local independente do DB | Escolher serviço/custo/backup da API e banco; validar cookies/proxy/streaming/metadados entre serviços |
| Web e API em Vercel Functions + PostgreSQL + armazenamento/execução agendada externos | Concentra deploy web/API na plataforma escolhida | Redesenhar testemunha/coordenação, fan-out e encerramento durável; não usar mutex/memória/disco de uma instância como garantia global |

Nenhum fornecedor adicional, plano pago ou integração está contratado. O caminho híbrido está aprovado; a alternativa totalmente Functions não foi escolhida. Não adicionar Redis, filas ou serviços de realtime só para parecer escalável; incluir somente o necessário ao caminho aprovado.

## Fronteiras a validar no caminho recomendado

- Preferir `/api` no domínio web via proxy/rewrite adequado, se o ensaio provar cookies/CSRF/SSE corretos. Vercel documenta proxy de origem externa; isso não comprova automaticamente comportamento desta aplicação.
- Cookies/Set-Cookie, origem confiável e autenticação continuam no backend; não confiar em `userId`/Host/forwarded headers fornecidos pelo cliente. Se houver domínios separados, definir CORS/cookies conscientemente, sem depender de cookies de terceiros.
- Desabilitar cache público de sessão, saldo, mutações e eventos. Validar headers de cache também no proxy; Vercel pode respeitar cache do upstream.
- SSE precisa de teste de tempo, buffering, reconexão e sessão; snapshot/polling recuperam eventos perdidos. Não escrever no design “conexão permanente garantida”.
- Metadados por rota no HTML inicial: Next App Router selecionado no bootstrap, com Metadata/generateMetadata nativos. Nenhum renderer de head no Nest. Placeholder noindex local já tem teste próprio; metadados das nove páginas e domínio real serão testados na implementação/release.
- DB, mídia e testemunha sobrevivem a restart/deploy; chave fora do DB; backup/restore coerente e teste de truncamento/replay da auditoria.
- Confirmar período de avaliação sem lote indisponível ou worker dormindo. Gratuidade, disponibilidade e custo não foram presumidos.

## Consequência para o plano e para o Grok

O plano atualizado tem dez tarefas: 1 fecha handoff/dados; 2/6/7 provam integridade/durabilidade/concorrência; 3 valida proxy/cookies; 9/10 validam SSE/cache/metadados e a fronteira publicada. Sem esses testes não há declaração de release pronto.

As 9 páginas e seus comportamentos permanecem os mesmos. Grok pode iniciar exploração visual lendo o briefing; essas opções não autorizam novas telas ou mudanças no produto. S5 segue WAITING_USER até reconciliação/aprovação.

## Checklist de deploy (Tarefa 10, parte local feita em 23/10)

CI agora migra um Postgres vazio, roda o seed duas vezes, audita dependências e sobe a API antes do E2E (NÃO VERIFICADO no GitHub). Evidência: `docs/evidence/2026-10-23-tarefa-10.md`.

**Falta para o deploy (precisa de OK, conta ou segredo do Fernando):**

1. Decidir a vulnerabilidade High do `multer` 2.4.0 (fixado por `@nestjs/platform-express` 12.2.0; a API não tem rota de upload). Opções: `overrides` para `multer` 2.5.0 (mudança de dependência, precisa de OK) ou aceitar o risco registrado. Até lá o passo `npm audit --audit-level=high` do CI falha.
2. Escolher fornecedor e custo da API Node persistente, do PostgreSQL gerenciado e do disco durável para mídia e testemunha (`MEDIA_DIR`, `AUDIT_WITNESS_DIR`). Nada contratado.
3. Criar conta/projeto na Vercel e no fornecedor da API e do banco (só o Fernando).
4. Segredos de produção, gerados no painel do fornecedor e nunca no repo: `AUDIT_HMAC_KEY` nova (hex, 32+ bytes), senha do owner (só migração) e do `auction_app` (runtime), `DATABASE_URL`, `API_PROXY_TARGET`, `WEB_ORIGIN`/`SITE_URL` com o domínio real, `SEED_DEMO_PASSWORD` se não quiser a senha padrão de demo.
5. Criar repositório remoto e autorizar push (o CI só roda no GitHub; ainda NÃO VERIFICADO).
6. OK explícito para migração no banco hospedado, seed de demo e deploy.
7. Depois do deploy: repetir anônimo/login/duas contas, SSE pelo proxy, metadados no HTML, Met fora, restart do worker, backup/restore de banco + mídia + testemunha; conferir lote aberto antes do envio de 29/10 ~18h17.
## Supabase somente PostgreSQL — D20, preparação local (24/10/2026)

Banco escolhido por Fernando: Supabase PostgreSQL. NestJS continua responsável por login, sessão, autorização, carteira, lances e auditoria. Prisma mantém schema/migrations; os repositórios e o pool `pg` atuais da API permanecem. Não instalar SDK Supabase nem usar Supabase Auth, PostgREST, Storage ou RLS como regra de negócio.

### Conexões separadas

| Variável | Processo | Conexão / papel |
| --- | --- | --- |
| `DATABASE_URL` | API Nest persistente | Session pooler Supavisor, porta 5432, usuário `auction_app.<PROJECT_REF>` sem DDL |
| `DIRECT_URL` | Runner do Prisma CLI | Direta `db.<PROJECT_REF>.supabase.co:5432` com papel de migração; se o host só tiver IPv4, Session pooler 5432 com esse papel |
| `TEST_DATABASE_URL` | Integração e E2E | Exclusivamente loopback:5463/casadeleilao_test |

O host/região e a sintaxe do usuário vêm de **Connect** no projeto real; nada foi criado/copied do painel. Session pooler foi escolhido porque a API é um processo persistente, com pool de no máximo 5 conexões já implementado. Não substituir por Transaction pooler 6543 sem ensaio próprio de compatibilidade. [Conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) e [Prisma no Supabase](https://supabase.com/docs/guides/database/prisma).

`back-end/prisma.config.ts` prefere `DIRECT_URL` não vazia; ausente/vazia usa `DATABASE_URL`, preservando o local. Na hospedagem, o runner deve receber `DIRECT_URL` explicitamente e parar se ela estiver ausente; não usar o fallback runtime para DDL. A API não lê `DIRECT_URL`. Guardar a URL de migração só no runner, nunca no ambiente do site/API nem no `.env` local de desenvolvimento. [Prisma 7](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

### TLS e credenciais

Para a API (`pg`), exigir validação de certificado e hostname: URL com `sslmode=verify-full` e `sslrootcert` apontando para o certificado raiz fornecido no painel. Para o CLI Prisma, usar os parâmetros suportados pelo conector de migração: `sslmode=require`, `sslcert` com o caminho da CA e `sslaccept=strict`. Os formatos diferem; não copiar opções de `pg` para o CLI indiscriminadamente. Certificado/host precisam de ensaio no projeto real antes da liberação.

Montar a CA fora do repositório, em caminho absoluto legível pelo processo. Não usar `rejectUnauthorized:false`, `sslaccept=accept_invalid_certs` ou `NODE_TLS_REJECT_UNAUTHORIZED=0`. Não combinar parâmetros TLS da URL com outro objeto `ssl` em `pg`, pois a URL pode sobrescrevê-lo. Habilitar a exigência de SSL no painel. Credenciais devem ser URL-encoded e ficar somente no gerenciador de segredos; nenhuma chave `anon`/`service_role` ou variável `NEXT_PUBLIC_*` é necessária. [TLS Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl), [TLS pg](https://node-postgres.com/features/ssl) e [parâmetros Prisma](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql#configuring-an-ssl-connection).

### Passos no projeto hospedado — NÃO EXECUTADOS; exigem OK específico

1. Fernando cria/escolhe um projeto dedicado, região/plano/custo e versão PostgreSQL; validar compatibilidade das migrations com essa versão (local usa PostgreSQL 18). Não presumir disponibilidade, backup ou retenção de plano gratuito.
2. **Antes de qualquer tabela**, em Data API integration overview, desligar **Enable Data API**; confirmar endpoints REST/GraphQL indisponíveis. Não basta deixar de instalar o SDK: tabelas em `public` podem ter grants automáticos. Manter essa API desativada durante toda a operação. [Procedimento oficial](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).
3. Com autorização própria, provisionar um papel dono/migração separado e o papel `auction_app` (nome esperado pelas migrations existentes). Runtime: LOGIN sem SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, sem pertencer ao dono, sem propriedade de objetos e sem CREATE no schema. Conceder CONNECT/USAGE e apenas SELECT/INSERT/UPDATE/DELETE nas tabelas de domínio; USAGE/SELECT nas sequências e USAGE nos enums necessários. Configurar privilégios padrão do papel migrador para objetos futuros. Não conceder TRUNCATE. A revogação efetiva de `_prisma_migrations` será feita após as migrations (passo 5), que podem conceder privilégios novamente. Configurar senhas por canal seguro, sem SQL com senha em documentação/logs. [Papéis PostgreSQL](https://supabase.com/docs/guides/database/postgres/roles).
4. Após revisar migrations, fazer backup/snapshot e validar CA/TLS com conexão autorizada. Confirmar que runtime não pode DDL/TRUNCATE e que nenhum papel da Data API tem acesso ao domínio. Toda autorização por usuário continua no Nest; RLS não é usada para aplicar essas regras.
5. **Somente com OK explícito para migration hospedada**, o runner com `DIRECT_URL` e CA provisionadas executará, da raiz, `npm exec --workspace back-end -- prisma migrate deploy`. Não usar `migrate dev`, `db push`, reset ou seed automático. Conferir status das migrations. **Depois do deploy e antes de liberar o runtime**, executar como dono `REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM auction_app` e verificar as permissões efetivas, inclusive herdadas. A migration inicial concede DML em todas as tabelas e pode restaurar esse acesso; repetir essa conferência/revogação após cada migration futura. Retirar a credencial administrativa do runtime.
6. Seed hospedado depende de outro OK. Quando autorizado, usar o serviço normal/idempotente com conexão runtime e conferir saldo/ledger/testemunha. Nunca apontar `TEST_DATABASE_URL`, integração ou Playwright para Supabase.
7. Deploy requer novo OK, API persistente escolhida e volumes duráveis para mídia e testemunha HMAC fora do banco. Validar login, CSRF, SSE/proxy, concorrência, liquidação, restart e restauração conjunta de PostgreSQL + mídia + testemunha. Backup só do banco não comprova integridade recuperável.

**NÃO VERIFICADO:** conexão/TLS/CA reais, configuração Data API, papéis/grants, versão e migrations no Supabase, seed, backup/restore, custo e deploy. Esta etapa prepara código/documentação; nenhum recurso hospedado foi consultado ou alterado. Prazo de trabalho vigente: **29/10/2026 às 18h (America/Sao_Paulo)**, conforme pedido atual de Fernando.
