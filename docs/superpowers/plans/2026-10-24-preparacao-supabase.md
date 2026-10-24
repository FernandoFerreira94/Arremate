# Preparação do Supabase — plano de implementação

> Execução: superpowers:executing-plans, com TDD e revisão independente final.

**Objetivo:** preparar PostgreSQL Supabase como banco exclusivo da API, sem conexão ou alteração hospedada.
**Arquitetura:** Prisma CLI prefere DIRECT_URL; fallback DATABASE_URL preserva o ambiente local. A API mantém DATABASE_URL e o pool pg existente, sem SDK Supabase.
**Stack:** Next/Nest/Prisma 7/pg instalados; nenhuma dependência nova.
**Contrato:** pedido de Fernando de 24/10 (auth/pagamentos), etapa 7; retomada autoriza uma tarefa independente das pranchas. docs/decisoes.md D20 registrará a decisão.

## Restrições

- Trabalhar em casadeleilao/chore/bootstrap; preservar alterações paralelas, inclusive a proposta/pranchas do Fred.
- Sem migration, seed, conexão ou deploy hospedado; sem ler .env nem imprimir segredos.
- Não mudar schema, sessão, UI, cores ou pacotes. DIRECT_URL nova e vazia em .env.example.
- Supabase só PostgreSQL; autorização na API. Desabilitar Data API antes de criar tabelas hospedadas; não usar RLS como regra de negócio.

## Arquivos previstos

- back-end/prisma.config.ts: selecionar conexão exclusiva do CLI.
- back-end/test/prisma-config.spec.ts: isolamento entre runtime/CLI e fallback local.
- .env.example: somente DIRECT_URL vazia e comentário.
- docs/hospedagem.md: pooler, TLS, papéis mínimos, etapas dependentes de autorização.
- README.md, docs/decisoes.md, docs/lifecycle.md e docs/superpowers/plans/2026-10-23-casa-leiloes-PROGRESSO.md: acrescentar só esta etapa, sem incluir mudanças alheias no commit.
- docs/evidence/2026-10-24-auth-pagamentos.md: resultados reais e pendências.
- Este plano; duas páginas Notion indicadas pelo Fernando.

## Tarefa 1 — conexão do CLI e operação documentada

Interfaces: consome DATABASE_URL runtime existente; produz DIRECT_URL opcional somente no Prisma CLI. Nenhuma interface HTTP muda.
Pre-flight: nenhum consumidor runtime deve passar a ler DIRECT_URL. Supabase ainda não criado/verificado.

- [x] Testar config com DIRECT_URL definida, sem DATABASE_URL, vazia/ausente e ambas ausentes; observar RED por conexão incorreta.
- [x] Usar process.env.DIRECT_URL?.trim() || env("DATABASE_URL"); observar GREEN.
- [x] Documentar Session pooler 5432 para API persistente, conexão direta/Session para migration, TLS verify-full e papel runtime sem DDL; nenhuma execução remota.
- [x] Rodar lint, typecheck, unitários API, integração local 5463, unitários front, Playwright isolado web3310/API4310/DB5463 e Prisma validate.
- [x] Revisão independente do diff e guia; corrigir achados relevantes com teste.
- [x] Atualizar docs locais; conferir patch seletivo para preservar mudanças paralelas. Commit local via git commit -F UTF-8 sem BOM, identificado no relatório final.
- [ ] Sincronizar Notion: bloqueado por revisão automática, aguardando aprovação explícita do resumo/destinos. Rascunho em docs/evidence/2026-10-24-notion-supabase-rascunho.md.

## Review Focus

- DIRECT_URL administrativa não deve chegar à API ou ao front.
- Campo vazio não deve quebrar comandos locais existentes.
- A importação de config no teste usa mock de dotenv e URLs fictícias, sem conexões. O setup comum existente carrega o ambiente local internamente; não inspecionar/imprimir seus valores.
- Guia não pode deixar tabelas públicas acessíveis pela Data API ou runtime com DDL.
- Distinguir ensaios locais de TLS/roles/backup hospedados ainda não verificados.

## Progresso

Início: HEAD ed56c70; nenhum arquivo staged. D19 já pertence ao motion; usar D20. Nenhuma migration necessária para esta etapa.

Revisão independente: corrigida a ordem da revogação de privilégios da tabela Prisma para após migrate deploy. Ruling: manter setup Jest existente, que carrega o ambiente internamente para as suítes autorizadas; o teste novo usa apenas URLs fictícias e mocka o loader do config. Alterar o setup global não elimina uma exposição observável e ampliaria o escopo; risco residual: a suíte padrão continua dependendo do loader de ambiente preexistente, sem uso dos valores reais neste teste.

Gates finais: lint/typecheck exit0; API65; integração99; frontend51; E2E24 em3310/4310/5463 (build próprio); Prisma validate válido. Nenhum acesso hospedado. Parte local validada; não marcar a sincronização Notion como concluída.
