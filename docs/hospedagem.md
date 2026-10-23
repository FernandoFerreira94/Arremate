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
