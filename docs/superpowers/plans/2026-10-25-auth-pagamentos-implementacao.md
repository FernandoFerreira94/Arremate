# Implementação de autenticação e pagamentos simulados

**Objetivo:** concluir o cadastro, OAuth Google, identidade, pagamentos e histórico autorizados por Fernando em 25/10.
**Fontes:** PROPOSTA-AUTH-PAGAMENTOS, A1–A7; D20 e D22 (Sheet prevalece sobre página da proposta; A4 sem campos de cartão).
**Arquitetura:** NestJS mantém sessão/CSRF e autorização. Prisma descreve/migra PostgreSQL; repositories existentes executam SQL parametrizado. Sem SDK Supabase e sem dependência nova.

## Restrições
- Branch chore/bootstrap, preservar merge 690746d e commits posteriores; commits pequenos via arquivo UTF-8 sem BOM; sem push.
- Não ler .env. Migrations apenas instâncias locais 5462/5463. Sem Prettier no arquivo inteiro.
- Cartão fixo de teste Visa final 4242 validade 12/2034. Nunca coletar PAN/CVV.

## Execução
- [ ] Cadastro: DTO explícito BIDDER, aceite, Argon2id e sessão; /auth/me com userId/nome; Sheet/Perfil/header/tour.
- [ ] Google: configuração por nomes de ambiente, disponibilidade pública, start POST com CSRF, state descartável em banco/cookie, PKCE/nonce, callback com validação criptográfica; vínculo somente iniciado e concluído na mesma sessão.
- [ ] Dados: nome/hash opcional/subject e OAuth states; cartões somente metadados; método/final no ledger. Migration incremental revisada antes de aplicar localmente.
- [ ] Pagamentos: propriedade de cartão, transação/idempotência existentes, digest do corpo completo; Pix/cartão aprovados, extrato paginado.
- [ ] Interface A3–A6: abas endereçáveis, QR fictício, cartão mascarado e confirmação de remoção; histórico por encerramento com paginação 8.
- [ ] Verificar: RED/GREEN, integração 401/403/duplicidade/PAN e OAuth com servidor simulado, E2E workers=1, lint/typecheck/build; revisão independente.
- [ ] D23, README, PROGRESSO e evidência com verificações e limites reais; commits locais.

## Revisão de risco
- Conta Google sem senha não pode entrar usando hash dummy; e-mail Google não vincula conta local sem sessão prévia.
- State/cookie, sessão iniciadora, assinatura/issuer/audience/nonce/expiração devem impedir replay e troca de identidade.
- Depósito não aceita cartão alheio, PAN/CVV, método desconhecido, valor fora de R$1–100 mil ou chave reaproveitada com corpo diferente.
- Remoção de cartão preserva final/método do extrato; dados privados sempre filtrados pelo ator.
- OAuth real depende das credenciais externas: testes locais simulados não provam consentimento real.
