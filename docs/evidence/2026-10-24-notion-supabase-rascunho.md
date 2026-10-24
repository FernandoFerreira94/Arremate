# Rascunho para sincronização no Notion — Supabase

**Status:** NÃO ENVIADO. A revisão automática recusou a gravação por não reconhecer autorização confiável para enviar conteúdo interno aos destinos. Aguardar aprovação expressa de Fernando para este resumo e estas duas páginas.

**Destinos:**

- Projeto: https://app.notion.com/p/402d66ddfe93818daba9d5db48b1d2a9
- README: https://app.notion.com/p/402d66ddfe9381b9bcdce16e186f8e82

**Operação pretendida:** acrescentar o resumo abaixo ao final de ambas, preservando todo o conteúdo existente. Não substituir página nem apagar material.

---

## D20 — Preparação do Supabase (24/10/2026)

Etapa 7 adiantada a pedido de Fernando enquanto Fred monta as pranchas. Supabase escolhido somente como PostgreSQL; regras e autorização permanecem na API Nest. Prisma CLI prefere DIRECT_URL não vazia, com fallback local DATABASE_URL; runtime conserva somente DATABASE_URL. .env.example ganhou DIRECT_URL vazia. Sem SDK Supabase ou mudança de UI/schema/dependências.

Guia em docs/hospedagem.md: Session pooler 5432, TLS e CA próprios de pg/Prisma, papel runtime sem DDL, credencial migradora separada e Data API desativada antes das tabelas. Revogação do acesso à tabela de controle Prisma foi posicionada após migrate deploy, conforme revisão independente.

Validação local: lint e typecheck aprovados; API 65 unitários (6 novos com RED→GREEN); integração 99; front 51; Prisma validate válido; Playwright isolado 24 aprovados em web3310/API4310/DB5463, com build frontend. Evidência: docs/evidence/2026-10-24-auth-pagamentos.md. Mantido setup Jest preexistente que carrega ambiente internamente, sem expor valores; config novo testado com URLs fictícias. Mudanças de motion e pranchas de outros agentes fora do commit desta etapa.

NÃO VERIFICADO: conexão/TLS/CA, papéis/Data API, migrations, seed e backup/restore hospedados. Fernando precisa fornecer projeto/credenciais Supabase e autorizar separadamente migration/seed/deploy. Google Cloud continua na etapa própria; etapas 1–6 de auth/pagamentos permanecem pendentes. Nenhum banco hospedado acessado, sem remote/push/deploy. Prazo operacional atual: 29/10/2026 às 18h, America/Sao_Paulo.
