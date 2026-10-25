# Auth/pagamentos — etapa 1: demonstração e Next

> Execução: superpowers:executing-plans, TDD e revisão independente final.

**Objetivo:** implementar etapa 1 do pedido de Fernando após entrega das pranchas A1–A7; preservar Freeze D12, tokens e alterações paralelas.
**Contrato:** PROPOSTA-AUTH-PAGAMENTOS.md §2/§3 e pranchas/auth-pagamentos/INDICE.md, A7. Cadastro/Pix/cartão/Google ficam nas etapas próprias.
**Arquitetura:** reutilizar header/footer/PageShell/LoadingRows/ErrorState; um ArtworkImage compartilhado com next/image e fallback em oito usos de sete arquivos. Prisma/API não mudam.
**Pre-flight:** HEAD 07422af; index vazio. Layout/globals/motion e pranchas são alterações paralelas: preservar e excluir do commit. Config Next autorizada pelo pedido; nenhuma dependência nova. Supabase arremate-verzel criado em sa-east-1, estado ACTIVE_HEALTHY, custo cotado US$0/mês, sem schema/seed da aplicação; Custelo já INACTIVE.

## Arquivos e interfaces

- front-end/next.config.ts + next.config.test.ts: imagens locais /api/media/** e Met HTTPS/CRDImages, sem query/redirect arbitrário.
- components/app/artwork-image.tsx: next/image + alt/sizes/dimensões e fallback; consumers nos sete arquivos lots/{lot-card,lot-room-page,receipt-page}, awards/my-awards-page, wallet/wallet-page, seller/{my-lots-page,new-lot-page}.
- components/app/site-header.tsx, site-footer.tsx: faixa A7, remoção do chip, links funcionais.
- app/{termos,privacidade,como-funciona}/page.tsx: textos curtos da demo, metadata noindex.
- components/app/route-states.tsx; loading.tsx/error.tsx em todas as rotas existentes e novas; not-found local de lote/comprovante; raiz not-found e next/font preservados.
- lib/public-lot.ts/test: dados públicos e imagem local validada para OG; lib/page-metadata.ts/test: imagem social por lote válido.
- app/lotes/[id]/opengraph-image.tsx: PNG1200x630 com obra/título e Fraunces local oficial/OFL; public/fonts/ + proveniência.
- src/proxy.ts/test: decide status404 antes do streaming, sem rewrite ou envio de credenciais; a própria rota mantém seu404 específico.
- playwright.config.ts e e2e/support/{global-setup,demo-artwork}.ts: mídia isolada e5snapshots CC0 do teste preparados antes dos lotes; provider-outage atualizado para next/image.
- e2e/demo-next.spec.ts: faixa/rodapé desktop+mobile, otimização e fallback, OG individual e privacidade de metadata.
- README, decisões D21, lifecycle, PROGRESSO, evidence/auth-pagamentos e hospedagem (estado projeto criado). Somente hunks desta etapa.

## Tarefa 1 — base de demonstração

- [x] RED dos testes de config/metadata e faixa por E2E antes da implementação.
- [x] Faixa A7 e rodapé; termos/privacidade/como funciona sem links mortos. Criar conta fica para etapa 2.
- [x] Oito imagens em sete arquivos usam next/image com sizes e fallback; só Sala preloaded.
- [x] Loading/error por rota e 404 específicos; erro técnico nunca renderizado.
- [x] OG por lote, origem pública validada e fonte com proveniência.
- [ ] Lint/typecheck/unit API/integração local5463/front/Playwright3310/4310/5463 verdes; build frontend pelo E2E.
- [ ] Review independente, documentação e commit seletivo UTF-8 sem BOM. Notion continua bloqueado pela revisão automática até aprovação direta do resumo/destinos.

## Review Focus

Não expor sessão/PII no OG; impedir SSRF por imagem/redirect; manter sticky/mobile e foco; não incluir motion/pranchas no commit; testar imagem real otimizada e fallback.

## Progresso

Etapas 2–6 pendentes. Sem acesso ao banco hospedado além de provisionar o projeto explicitamente autorizado pelo usuário.


Estado final deste turno: BLOQUEADO no E2E antes de iniciar testes (4310 ocupada; 3310 também em uso). Lint/tipos/API65/front60/integração99 passaram com Node24.22.1. Sem commit: HEAD07422af, index vazio. Não encerrar processos ou reutilizar servidores sem identificar a origem. Minor diferido: fallback A falha→B→A não tentaA novamente até remontagem. Status404, OG/imagens reais e screenshots pendentes. Supabase arremate-verzel criado e saudável; nenhum schema/seed hospedado aplicado.

## Retomada em25/10/2026

Docker estava desligado; iniciado e somente db/db-test do projeto ficaram healthy. Um servidor de teste iniciado nesta execução foi encerrado após timeout, com PID/origem conferidos.

RED real:404 recebia200 e A→B→A mantinha fallback. Correção da imagem usa remount por src; o bitmap mockado de1px foi substituído por PNG válido180px, pois srcset corrige densidade e arredonda naturalWidth de1px para0. A mídia real do teste vinha de snapshots remanescentes da integração, com arquivo ausente: o setup agora reconstrói5snapshots CC0 antes de publicar, no DB5463 e diretório .data/media-e2e.

A tentativa de htmlLimitedBots não resolveu status404 e foi retirada. A revisão apontou risco de rewrite para SITE_URL em preview/alias e perda do404 específico; a reescrita foi removida. O proxy agora retorna NextResponse.next(status404) e mantém a rota, sem destino externo; validação real pendente.

Ruling: usar uma consulta pública prévia nos caminhos de lote/auditoria para decidir404 antes do streaming, mantendo loading por rota — necessário para o status real — custo: uma consulta adicional à API nesses acessos, limitada a5s e sem credenciais.

Gates atuais de25/10: lint e typecheck exit0, API65 e front66 aprovados. Integração/E2E final ainda pendentes. Não declarar entrega ou commit até os gates passarem.
