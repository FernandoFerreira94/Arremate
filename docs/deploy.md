# Deploy da demo

O site (Next) e a API (Nest) rodam **no mesmo container**: o site encaminha `/api` para a API em `127.0.0.1:4300`, a mesma topologia do E2E. Assim a API continua confiando só no salto local para saber o IP do cliente (D26). Com o site na Vercel e a API em outro host, todos os visitantes chegariam com o IP da Vercel e dividiriam o limite de 3 conexões ao vivo e o de login.

Arquivos: [`Dockerfile`](../Dockerfile), [`infra/deploy/start.sh`](../infra/deploy/start.sh), [`infra/deploy/bootstrap-db.cjs`](../infra/deploy/bootstrap-db.cjs), [`compose.deploy.yaml`](../compose.deploy.yaml) e [`infra/deploy/deploy.env.example`](../infra/deploy/deploy.env.example).

Ao subir, o container: cria o papel `auction_app` (sem DDL) com a URL do owner, aplica as migrations, tira de `auction_app` o acesso a `_prisma_migrations`, sobe a API, espera o `/api/health/ready` e sobe o site na porta `PORT`. A testemunha da auditoria e as imagens ficam em `/data`, que precisa ser um volume persistente: sem ele, um restart apagaria a testemunha e a auditoria passaria a acusar todos os lotes.

**Verificado localmente em 26/10/2026:** contra um Postgres zerado, bootstrap, migrations, seed (35 lotes), auditoria íntegra antes e depois de reiniciar o container, e login com cookie e CSRF por HTTPS via Caddy. Uso de memória em repouso: cerca de 175 MB (app) + 50 MB (Postgres).

## Caminho A — VM grátis (Oracle Cloud Always Free), custo zero

Mesma topologia, com disco persistente de verdade. O `compose.deploy.yaml` sobe Postgres, o app e o Caddy (HTTPS automático pelo Let's Encrypt). Sem domínio próprio, use `<ip-com-hifens>.sslip.io`.

**Ações de conta (só você pode fazer):**

1. Criar a conta em https://www.oracle.com/cloud/free/ . A Oracle pede cartão só para verificar a identidade; o Always Free não cobra. A região inicial não muda depois: escolha São Paulo ou Vinhedo.
2. Criar uma instância **Ampere A1 (ARM)** com 2 OCPU e 12 GB, imagem Ubuntu 24.04, e colar a chave SSH pública que eu gerar. A forma de 1 GB (AMD micro) não aguenta o build do Next. Se aparecer “Out of host capacity”, tente outro domínio de disponibilidade ou mais tarde.
3. Na VCN da instância, liberar a entrada TCP 80 e 443 (Security List → Ingress Rules).
4. Me passar o IP público. O resto eu faço por SSH.

**O que eu faço na VM:** instalo o Docker; libero 80/443 no iptables (a imagem Ubuntu da Oracle bloqueia por padrão); clono o repositório; gero o `.env.deploy` lá mesmo (nunca no Git); rodo `docker compose -f compose.deploy.yaml --env-file .env.deploy up -d --build`; rodo o seed com `docker compose -f compose.deploy.yaml --env-file .env.deploy exec -e SEED_ALLOW_HOSTED=1 app npm run db:seed --workspace back-end`; e repito o roteiro de avaliação na URL pública.

**Riscos:** a Oracle pode recuperar instâncias Always Free ociosas, mas uma demo com tráfego e um runner a cada 1 s não fica ociosa. A capacidade ARM às vezes falta na criação. O backup fica por nossa conta (`pg_dump` + cópia do volume `data`).

## Caminho B — Railway (plano Hobby, cerca de US$ 5/mês)

Mesmo `Dockerfile`, sem VM para administrar.

1. Você cria a conta e um projeto, adiciona um banco **PostgreSQL** e um serviço a partir deste repositório (usa o `Dockerfile` da raiz).
2. No serviço, monte um **Volume** em `/data` e gere um domínio público.
3. Variáveis do serviço: `DATABASE_URL` (`auction_app` no host privado do Postgres), `DIRECT_URL` (a URL do usuário `postgres` que o Railway mostra), `APP_DATABASE_PASSWORD`, `AUDIT_HMAC_KEY`, `WEB_ORIGIN` e `SITE_URL` (`https://<domínio>`). Deixe `DEMO_BOTS` vazio.
4. Seed, uma vez: `railway ssh` no serviço e `SEED_ALLOW_HOSTED=1 npm run db:seed --workspace back-end`.

Para eu fazer os passos 1 a 4, basta um token de conta do Railway.

## Por que não Render grátis, Vercel só ou similares

O plano grátis do Render não tem disco persistente e dorme após 15 minutos: a testemunha sumiria a cada despertar e a auditoria acusaria adulteração em todos os lotes. A Vercel Functions não mantém SSE, o runner de liquidação a cada 1 s nem disco. Contornar isso exigiria mover a testemunha para outro armazenamento, ou seja, mudar o modelo de segurança da auditoria a três dias do prazo.

## Depois do deploy

- Colocar a URL no topo do README e no Notion.
- Repetir o roteiro de avaliação na URL pública com duas contas, inclusive o tempo real.
- Conferir que um lote ao vivo com lances continua aberto até a avaliação; se o catálogo envelhecer, `--preparar-lote` cria lotes novos com datas relativas a agora.
