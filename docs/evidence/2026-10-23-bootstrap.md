# Evidência — bootstrap local e plano completo

Data: 23/10/2026. Pasta canônica `C:/Users/ferna/Desktop/WebCode/Projetos/casadeleilao`; branch local `chore/bootstrap`, sem commit/push/deploy. Escopo autorizado U12/U13: instalar fundação e planejar; aguardar design para produto. Nenhuma regra de negócio foi implementada/testada.

## Ambiente e versões

- Windows/PowerShell, Node24.22.1 LTS disponível no runtime local; npm11.19.0. Node global26 não foi alterado.
- Next16.4.2, React19.3.1, Nest12.2.0, Prisma7.10.1, PostgreSQL18, TypeScript5.9.3.
- Tailwind4.3.3, shadcnCLI4.22.1; sem components.json/tema/componentes de produto antes do Grok.
- ESLint9.39.5, Jest30.5.2/ts-jest29.4.15, Vitest5.0.5, Playwright1.64.1. Todas as dependências diretas fixadas; resolução completa no package-lock.json.
- PostgreSQL dev/teste próprios saudáveis em5462/5463, loopback; sem operações nos bancos de outros projetos.

Comandos de validação foram executados com Node24 no PATH. O shim npm.ps1 global usa o Node adjacente26; para conferir instalação usando24, o executor invocou explicitamente Node24 + npm-cli.js. O processo do Jest/Next usa Node24. Não mudar o runtime global como solução.

## Ciclo vermelho e correções

1. Health test inicialmente falhou por imports de app/repository ausentes: vermelho anterior à implementação. Não confundir com comportamento passando.
2. Nest12 ESM exigiu suporte do Jest a módulos VM. Teste reproduziu erro de require; execução com `node --experimental-vm-modules` passou. Scripts incluem a flag; aviso experimental é conhecido. Referência: [Jest ESM](https://jestjs.io/docs/ecmascript-modules).
3. Lint encontrou globals CJS ausentes em jest/setup; configuração limitada aos arquivos `.cjs` corrigida. ESLint10 foi rejeitado porque plugins do Next ainda declaram peer até9. Fixado9.39.5 compatível, sem force/legacy-peer-deps.
4. Reinstalação detectou peer Vite ausente do Vitest e peers opcionais ajv/ajv-formats mal resolvidos no root pelo npm. Vite foi adicionado somente ao runner frontend; ajv8/formats2 como peers de tooling na raiz, sem segundo framework web. Árvore de dependências revalidada após instalação.
5. Review identificou pool sem listener de erro ocioso. Nova regressão ficou vermelha (listener ausente), depois verde com handler/log seguro. O teste de readiness também cobre503→live200→ready200. Sem expor mensagens internas de conexão.
6. Review do plano encontrou teto acumulado que bloquearia crédito do vendedor. Plano/spec corrigidos: teto por entrada; saldo acumulado numeric(38,0) com bigint no domínio. Caso de dois arremates600000000000→1200000000000 incluído nos testes futuros; não foi executado como regra de produto.

## Resultados da fundação

| Comando/check | Resultado observado |
| --- | --- |
| Docker Compose do projeto | Dois PostgreSQL18 saudáveis, volumes próprios |
| `npm ci` / árvore `npm ls --all` | PASS: npm ci instalou1043pacotes; npm ls --all retornou sem problemas/exit0 |
| `npm test` | PASS:5testes health/erros/pool, incluindo regressão e recuperação |
| `npm run test:integration` | PASS:2testes com PostgreSQL real, readiness e runtime sem superuser/DDL |
| `npm run db:validate` | PASS: schema válido, ainda sem modelos de domínio |
| `npm run db:generate` | PASS: Prisma Client7.10.1 gerado; geração não prova migração/domínio |
| lint front/back | PASS usando npmCLI oficial diretamente |
| typecheck frontend/backend/tools | PASS |
| builds Next/Nest | PASS; frontend contém apenas placeholder e404 |
| `npm run test:e2e` | PASS:2testes Chromium, placeholder acessível e HTML inicial lang/title/noindex +404 |
| CI GitHub, nove páginas, provider real, finanças, concorrência, integridade, SSE, deploy | NOT RUN |

Rodada final após instalação limpa: PASS/exit0 em npm ci, árvore completa sem problemas, lint, typecheck, health5, integração2, Prisma validate/generate, builds e Chromium2. Sessão de execução97815 concluída exit0. CI remoto não foi executado. Relatórios completos de dependências: npm-audit-2026-10-23.json e npm-audit-runtime-2026-10-23.json nesta pasta.

O wrapper RTK deste host reescreveu `npm run lint` e procurou configuração na raiz, retornando erro sem executar workspaces. O comando equivalente `node <npm-cli.js> run lint` executou os dois pacotes e passou. Isso é fricção do wrapper local, não evidência de lint verde pelo comando reescrito.

## Segurança das dependências e limites

`npm audit --omit=dev`:0alertas no resultado observado. Auditoria completa:9High derivados da mesma raiz braces3.0.3 usada por ferramentas de lint/CLI shadcn. A [advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) informa ausência de versão corrigida na consulta de23/10/2026. Não aplicar downgrade arbitrário sugerido pelo npm nem `audit fix --force`.

O processo de produto não usa essa árvore de tooling; não executar lint/CLI com padrões ou registries externos não confiáveis. Acompanhamento de patch é pendência explícita antes do release; não suprimir o alerta nem declarar tudo sem vulnerabilidades. ESLint9 também informa fim de suporte; atualização para10 depende de peers oficiais compatíveis. CI/compilação não equivalem a aprovação desses riscos.

Segredos locais gerados aleatoriamente e ignorados; não registrados aqui. Credencial de runtime não é owner. PDF original permanece local/ignorado, não é anexo do repo público. Não houve implantação, contratação ou envio.

## Review e documentação

Review independente releu plano/spec/base; apontou os dois achados acima. Após correção, confirmou ausência de outra pendência material **nessas correções**, sem repetir as suítes. Executor é responsável pelos resultados registrados. Provas financeiras/auditoria/produção continuam futuras.

Plano completo: dez capacidades, nove páginas, contratos e casos de fronteira, TDD/review/evidência; cópia no [Notion](https://app.notion.com/p/402d66ddfe9381b683bade1789ac68ad). README fonte mantido no Notion; não copiar versão final antes de finalizar o projeto. Nome/logo/paletas/design aguardam Grok/Fernando; shadcn definido por U13.
