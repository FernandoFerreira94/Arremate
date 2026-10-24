# Ambiente local — bootstrap autorizado

Pasta: `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao`. Node 24.22.1 LTS e npm 11.19.0; não alterar o Node global de outros projetos. Use `nvm use 24.22.1` em seu terminal quando essa versão estiver instalada ou o executável Node 24 já disponível no host. O executor usou o runtime disponível, sem instalar/mudar a versão global.

Decisão U12: Fernando autorizou criar a pasta, instalar a base e aguardar as pranchas/design system. Isso autoriza a fundação técnica antes do design; não representa aprovação de telas, regras financeiras ou release.

## Comandos da base

Da raiz do projeto, com Node 24 no PATH:

```powershell
npm ci
npm run db:up
npm run dev:api
# Outro terminal:
npm run dev:web
```

Web: `http://127.0.0.1:3300`; health: `http://127.0.0.1:4300/api/health/live` e `/api/health/ready`.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run db:validate
npm run db:generate
npm run build
```

Os resultados executados ficam na evidência do bootstrap; comando listado não significa resultado aprovado. `npm run test:unit --workspace front-end` está reservado ao Vitest e não deve ser contado como suíte existente antes de haver lógica de UI a testar.

## Banco e segredos locais

Docker Compose `casadeleilao`, PostgreSQL 18 em duas instâncias/volumes próprios: dev 5462 e teste 5463. Só loopback, sem tocar bancos de Axion/Colinas ou porta 5452 já ocupada. Runtime `auction_app` sem superuser/criação de schema; owner apenas bootstrap/migrations locais.

`.env` local não versionado contém senhas aleatórias geradas; nunca copiar valores para logs/docs/Notion. `.env.example` documenta somente nomes/placeholders. Para reinstalar em outra máquina, gerar segredos locais e URLs adequadas antes de `db:up`. Não reutilizar credenciais locais em produção. `npm run db:stop` para apenas estes dois bancos; não usar down -v/reset sem aprovação.

A Tarefa 1 criou o schema do núcleo e a migration `20261023104706_auction_core`, aplicada só nos Postgres locais 5462 e 5463. O papel da API continua `auction_app`. Seed de demo: `npm run db:seed --workspace back-end` (Tarefa 10), só em banco local; ver abaixo.

## Design e implantação

Next/React/Tailwind instalados; biblioteca/CLI shadcn e ferramentas de formulário/cache prontas. Nenhum preset/tema/componentes de produto gerados antes do Grok. Favicon/OG/identidade aguardam design. Placeholder atual é aviso técnico.

Destino: site Vercel + API persistente externa. Fornecedores e segredos de produção não foram escolhidos/configurados; não houve push/deploy. README completo continua na página Notion, não neste guia operacional.

Shadcn é obrigatório por U13. Vite é peer do Vitest somente, não outro app web. Ajv8/formats2 na raiz satisfazem peers opcionais das ferramentas; Zod segue como validador planejado do formulário. Instalação com scripts de terceiros tem allowlist versionada no package.json. Limitações de dependências e resultados em docs/evidence/2026-10-23-bootstrap.md.


## Seed de demonstração (Tarefa 10)

- `npm run db:seed --workspace back-end`: cria `leiloeiro@arremate.demo`, `licitante1@arremate.demo` e `licitante2@arremate.demo` (fictícios), senha de demo `arremate-demo-2026` ou `SEED_DEMO_PASSWORD`; R$ 10.000 simulados por licitante; obra 437329 do snapshot local; 1 lote aberto por 7 dias.
- D18 (24/10): o seed também cria `licitante3@arremate.demo` e `licitante4@arremate.demo`, deposita valores simulados com chaves estáveis e publica o catálogo de 24 obras CC0 (abertos, encerrando, agendados, liquidados e sem lances), com estimativa e laudo marcados como simulados. Reexecutar cria 0 lotes; `--preparar-lote` só recria lotes vencidos do catálogo; `-- --sem-catalogo` pula o catálogo.
- Reexecutar não troca senha, não zera saldo, não apaga lance e não reabre lote. `npm run db:seed --workspace back-end -- --preparar-lote` cria um lote NOVO.
- Exige `AUDIT_HMAC_KEY` (hex) e banco em 127.0.0.1/localhost. Usa `AUDIT_WITNESS_DIR` e `MEDIA_DIR` (padrão `.data/`), os mesmos da API.

## E2E isolado (24/10/2026)

`npm run test:e2e` sobe API própria em 4310 (`DATABASE_URL` = `TEST_DATABASE_URL`, banco 5463) e web própria em 3310 (build em `front-end/.next-e2e`), e zera os dados de domínio do banco de teste no início (mantém usuários e snapshots). A vitrine de desenvolvimento (3300/4300/5462) não recebe mais lotes de E2E.
