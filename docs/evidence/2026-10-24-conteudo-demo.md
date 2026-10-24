# Evidência D18 - conteúdo de demonstração (24/10/2026)

Só local, sem push/deploy.

- Migration `20261024090000_lot_simulated_estimate` aplicada em 5462 e 5463 (como owner).
- Seed: 23 lotes criados + 1 já existente (0016/437329); reexecução criou 0. Encerrados: 5 liquidados, 1 sem lances.
- lint 0, typecheck 0, unit 59/59, integração 99/99 (18 suítes), Vitest 49/49, build ok, Playwright 23/23.
- `GET /api/health/ready` 200 `{"status":"ok","database":"up"}`; lote Erasmus devolve estimate {600000, 900000, simulated:true}, conditionReport simulado, artistBio, credit e sourceUrl.

Pendências: lotes residuais de E2E no banco dev; lances do seed com horário da execução; lance inicial do 0016 ficou R$ 500 (lote preexistente); lote extra cancelado sugerido pelo Fred não criado; linha de estimativa em texto simples (não Fraunces).
