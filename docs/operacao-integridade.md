# Operação da integridade

Prova local da Tarefa 2 (23/10/2026). A08 fica HMAC-SHA-256 encadeado mais testemunha em disco, fora do PostgreSQL. O volume de produção e o fsync de diretório no Linux continuam em aberto. Nada foi contratado.

## Modelo

O atacante considerado pode alterar o banco, inclusive constraints. Não tem a chave nem o diretório da testemunha. Comprometer os dois juntos está fora deste mecanismo. A consulta pública confia no backend; não há assinatura verificável fora do servidor.

A resposta pública é `status`, `revision`, `count`, `verifiedAt`, `reasonCode` e `message` em pt-BR. Não inclui usuário interno, e-mail, hash, chave, assinatura nem token de recibo.

| reasonCode | status | mensagem |
| --- | --- | --- |
| INTACT | INTACT | O histórico confere com a testemunha. |
| MISSING_KEY | INDETERMINATE | Chave de verificação ausente. |
| MISSING_WITNESS | INDETERMINATE | Testemunha do lote ausente. |
| WITNESS_UNREADABLE | INDETERMINATE | Testemunha ilegível. |
| CONFIRMATION_GAP | INDETERMINATE | Confirmação do lote incompleta. |
| CONCURRENT_READ | INDETERMINATE | Leitura cruzou uma atualização; o resultado não foi fechado. |
| CHAIN_MISMATCH | TAMPERED | Assinatura ou encadeamento não confere. |
| HISTORY_TRUNCATED | TAMPERED | Histórico menor que a testemunha. |
| LOT_REMOVED | TAMPERED | Lote ausente com testemunha remanescente. |
| LOT_METADATA_MISMATCH | TAMPERED | Metadados do lote não conferem com a gênese. |
| ENVELOPE_MISMATCH | TAMPERED | Extensão ou resultado não conferem com o envelope. |
| DUPLICATE_ROW | TAMPERED | Há mais de uma linha para o mesmo lote ou liquidação. |

Sem chave, sem testemunha ou com confirmação incompleta o status nunca é INTACT. Leitura que muda de revisão no meio da consulta vira INDETERMINATE, não adulteração definitiva.

## Ordem da confirmação

Uma instância só. O mutex do processo serializa o lote; ele não substitui o lock de carteiras entre lotes.

1. Assinar em memória o próximo envelope. A chave não entra no banco nem no payload.
2. Gravar o arquivo `pending` com escrita atômica. Isso ainda não confirma o lance.
3. Commit no PostgreSQL: lance e revisão do lote, na mesma transação.
4. Promover `pending` para `checkpoint` com `advance(revisão atual, próxima)`. A revisão só cresce. Apagar `pending`.
5. Só então devolver a resposta ou publicar o evento.

Se o passo 4 falha (write, fsync ou rename), o lote fica INDETERMINATE com `CONFIRMATION_GAP`. `assertCanMutate` recusa novas mutações e a liquidação futura com `CONFIRMATION_PENDING`. Não há rotina que assine de novo o conteúdo atual do banco. `retryCheckpoint` só promove o `pending` que já estava assinado, e só se o banco conferir com ele. Sem esse arquivo, a recuperação automática não existe: o plano aceita o lote parado até haver evidência confiável (cópia consistente de banco e testemunha). Não prometemos reconstrução.

## O que entra na assinatura

Bytes canônicos versão `v1`, UTF-8, campos em ordem fixa, uma linha `nome=valor`. Dinheiro é inteiro decimal, sem `Number`. Instante é UTC com três dígitos de milissegundo (`2026-10-23T18:01:02.003Z`). HMAC-SHA-256 em hex minúsculo. A comparação usa `timingSafeEqual`.

A gênese cobre dono, snapshot, lance inicial, incremento, início e fim originais. O envelope do checkpoint cobre a cabeça da cadeia, a revisão, a contagem, o fim vigente e o vínculo de liquidação/recibo (id da liquidação, lance vencedor, token e instante). A Tarefa 7 prova o recibo no fluxo de encerramento; aqui o vínculo já entra na verificação.

Cada lance assina `lotId`, `bidId`, `bidderUserId`, sequência, alias em UTF-8 com tamanho em bytes, valor, instante, assinatura anterior e `keyVersion`. Trocar o usuário interno e manter o alias quebra a assinatura. `keyVersion` suportada: 1.

## Disco

Diretório fora do banco, um subdiretório por UUID de lote, arquivos `checkpoint` e `pending`. Gravação: arquivo temporário, fsync do arquivo, rename. Em seguida o código tenta fsync do diretório. Neste Windows o fsync do diretório devolve EPERM e a gravação segue; isso não prova o fsync de diretório no Linux de destino. Esse ensaio fica para o ambiente Linux da release.

A chave prevista para o processo é `AUDIT_HMAC_KEY` (hex, no mínimo 32 bytes), fora do repositório e do banco. O diretório previsto é `AUDIT_WITNESS_DIR`. A API ainda não lê esses nomes: não há rota HTTP de auditoria nesta tarefa. Os testes injetam a chave e usam um diretório temporário. Não colocar a testemunha em disco efêmero de função serverless.

## Leitura

`verifyLot` lê a testemunha, o histórico inteiro (não a página da tela) e a testemunha de novo. A leitura do banco usa `REPEATABLE READ` e `SET LOCAL search_path`, para não vazar o schema da conexão. Se a revisão mudar nesse intervalo, repete até três vezes e então devolve `CONCURRENT_READ`. Mais de uma linha de lote ou de liquidação para o mesmo id é `DUPLICATE_ROW`, mesmo que a primeira linha ainda confira.
