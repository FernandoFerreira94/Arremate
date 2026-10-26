# Como explicar o Arremate na entrevista

Roteiro para defender o projeto em voz alta, sem abrir o código. Cada bloco tem a frase curta para dizer primeiro e os detalhes para quando perguntarem "por quê?". Os nomes de arquivo servem para você revisar antes, não para recitar.

## 1. O projeto em 30 segundos

"É uma casa de leilões de arte com obras de domínio público do The Met. O leiloeiro cria lotes, o licitante deposita saldo simulado e dá lances ao vivo. Toda regra de dinheiro mora no back-end, numa transação do PostgreSQL, e cada lote tem uma auditoria pública que detecta adulteração do histórico, mesmo feita direto no banco."

Stack: Next.js + React no front, NestJS no back, PostgreSQL. Um monólito modular: as regras ficam num lugar só, o que é mais fácil de provar correto em 7 dias do que serviços separados. O custo é rodar uma instância só (os limites de taxa ficam em memória).

## 2. O caminho de um lance (a pergunta mais provável)

Diga na ordem em que acontece (`back-end/src/lots/bidding.service.ts` e `bidding.repository.ts`):

1. **Trava o lote** com `SELECT ... FOR UPDATE`. Dois lances no mesmo lote viram fila: o segundo espera o primeiro terminar e então enxerga o valor novo. Sem isso, os dois leriam "lance atual = 100" e os dois seriam aceitos.
2. **Trava as carteiras envolvidas** (quem dá o lance e quem está sendo superado), **sempre em ordem de ID**. Se o lote A travasse a carteira 1 e depois a 2, e o lote B travasse a 2 e depois a 1, as duas transações podiam esperar uma pela outra para sempre (deadlock). Ordem fixa elimina esse ciclo.
3. **Lê o relógio do banco** (`clock_timestamp()`) **depois** dos locks. O relógio do servidor da API ou do navegador pode estar adiantado; e se eu lesse a hora antes de esperar o lock, um lance que esperou 2 s na fila seria julgado com a hora velha.
4. **Decide com uma função pura**, `decideBid` (`bid-rules.ts`): recebe lote, carteira, valor e hora e devolve aceito ou o motivo da recusa. Não toca no banco, então é testável sem banco e recusa nunca muda nada.
5. **Movimenta o saldo no ledger**, na mesma transação: `RESERVE` no novo líder e `RELEASE` no superado. O saldo é a soma dos lançamentos (`wallet_entries`), não um número sobrescrito, então dá para explicar cada centavo.
6. **Assina o evento na cadeia de auditoria** e faz commit. Tudo ou nada.
7. Se o PostgreSQL acusar deadlock (`40P01`) ou conflito de serialização (`40001`), a API **tenta de novo** algumas vezes com espera aleatória curta.

Reforços: o mesmo lance com a mesma `Idempotency-Key` devolve o resultado anterior em vez de duplicar (clique duplo, rede ruim); dinheiro é sempre centavo em `BigInt`, nunca `float`.

**Prova:** teste de integração com 20 licitantes dando lance ao mesmo tempo no PostgreSQL real (`back-end/test/integration/bidding-concurrency.integration.spec.ts`).

## 3. As regras do PDF, uma frase cada

- **Saldo comprometido:** disponível = total − comprometido. O valor de quem lidera fica comprometido; ao ser superado, volta na hora, na mesma transação. Por isso ninguém consegue liderar dois lotes com o mesmo dinheiro.
- **Anti-sniping:** lance aceito nos últimos 2 minutos faz o lote terminar 2 minutos **depois desse lance** (`fim = aceite + 120 s`). Escolhi "relativo ao lance" porque garante sempre 2 minutos de reação a quem foi superado. Lance recusado não estende.
- **Liquidação:** um runner na API roda a cada 1 s (e no startup) e, numa transação, debita o vencedor, credita o leiloeiro e emite o comprovante. Lote sem lance fecha sem vencedor. Por isso o lote fica "apurando" por até ~1 s.
- **Privacidade:** a auditoria e o comprovante mostram "Licitante 3", apelido por lote, nunca nome ou e-mail.
- **API do Met fora do ar:** ao publicar, a obra vira snapshot com a imagem salva localmente e o hash conferido. Depois disso nada depende do Met.
- **Cancelamento:** só sem lances e antes do fim. Por isso não existe estorno: se não há lance, não há saldo reservado para devolver.

## 4. A auditoria (o diferencial; ensaie até desenhar no quadro)

"Cada evento do lote é assinado com HMAC-SHA-256, e a assinatura inclui a do evento anterior. É uma corrente: mexer num elo quebra todos os seguintes."

- **Por que HMAC e não só SHA-256?** Hash simples qualquer um com acesso ao banco recalcula depois de adulterar. O HMAC precisa de uma chave que fica só no ambiente da API, fora do banco.
- **O caso que quase todo mundo esquece:** apagar os **últimos** lances. A corrente que sobra continua válida. Por isso guardo um checkpoint (quantos eventos e a última assinatura) numa **testemunha fora do PostgreSQL**. Histórico menor que a testemunha = `HISTORY_TRUNCATED`.
- **O que cada ataque gera:** alterar um lance → `CHAIN_MISMATCH`; inserir sem a chave → assinatura inválida; apagar os últimos → `HISTORY_TRUNCATED`; apagar o lote → `LOT_REMOVED`. Sem chave ou sem testemunha, o resultado é "indeterminado", nunca "íntegro". Lote adulterado bloqueia novas mutações.
- **Serialização canônica:** o conteúdo assinado prefixa o texto livre (o apelido) com o tamanho em bytes, para que dois conteúdos diferentes nunca virem o mesmo texto assinado (`back-end/src/audit/audit-chain.ts`).
- **Demonstração ao vivo:** o `UPDATE bids ...` do README e recarregar a página de auditoria.
- **Limite honesto:** quem tiver a chave **e** a testemunha ao mesmo tempo consegue forjar. E, como é HMAC, só o servidor confere a corrente: o público confia na palavra dele. A evolução seria assinar com Ed25519 (chave pública divulgada) para que qualquer pessoa recalcule.

## 5. Segurança, em uma lista

Senha com Argon2id; sessão opaca em cookie HttpOnly e só o hash do token no banco (vazou o banco, não vazou sessão); CSRF por token + `Origin` exato; CSP com nonce por requisição; a API conecta com um papel de banco **sem DDL** (não consegue apagar tabela nem mudar schema); rate limit em login e mutações.

## 6. Trade-offs que valem citar

| Escolha | O que ganhei | O que paguei |
| --- | --- | --- |
| Regras no back-end em transação, não no banco (triggers) nem no front | Código legível e testável, uma fonte de verdade | Depende de todo acesso passar pela API |
| SQL parametrizado no caminho do lance, Prisma só nas migrations | Controle exato de lock e ordem | Mais SQL à mão para revisar |
| SSE por lote com fallback de polling de 10 s | Tempo real simples, sem WebSocket | Até 3 conexões por IP; a partir da 4ª aba, polling |
| Ledger em vez de saldo sobrescrito | Cada centavo explicável, auditável | Mais linhas e mais escrita por lance |
| Relógio do banco | Uma hora única para todos | Uma ida a mais ao banco por lance |
| Testemunha da auditoria em disco | Simples, fora do banco | Precisa de disco persistente no deploy |
| Monólito numa instância | Entrega em 7 dias, menos peças | Rate limit em memória, sem escala horizontal |

## 7. Perguntas difíceis prováveis

- **"E se dois lances chegarem no mesmo milissegundo?"** O `FOR UPDATE` serializa; o segundo vê o primeiro e é avaliado contra o novo mínimo.
- **"E se a API cair no meio do lance?"** É uma transação: ou tudo foi gravado (lance, ledger, auditoria), ou nada. O cliente pode repetir com a mesma `Idempotency-Key`.
- **"E se a API cair na hora de encerrar?"** O runner liquida no startup tudo o que já venceu; a liquidação também é uma transação.
- **"Por que não confiar na hora do navegador?"** Pode estar errada ou ser manipulada; o front só mostra o cronômetro, quem decide é o banco.
- **"Como escalaria?"** Rate limit e eventos ao vivo para um armazenamento compartilhado (Redis), runner com lock de líder (ou `SKIP LOCKED`), várias instâncias atrás de um balanceador. As regras de lance não mudam, porque já dependem só do banco.
- **"O que você faria diferente?"** Deploy antes dos extras (Google, Pix, tour vieram antes do obrigatório) e assinatura pública na auditoria.

## 8. Uso de IA (diga antes que perguntem)

"A IA escreveu a maior parte do código, dentro de um processo que eu defini: cada entrega com teste e evidência, nenhuma dependência, push ou deploy sem a minha validação. Meu papel foi decidir as regras e a arquitetura, revisar e testar." Tenha 2 exemplos prontos de correção, como os do README: o login travado por IP único atrás do proxy, e a sala mostrando "superado" e "ganhando" ao mesmo tempo.

O que garante que você domina o projeto não é ter digitado cada linha; é conseguir explicar as seções 2 e 4 sem olhar.
