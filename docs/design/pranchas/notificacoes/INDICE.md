# Pranchas · Notificações in-app (“Avise-me quando abrir”) — PROPOSTA
Fred · 25/10/2026. Gerador `src/gen_n.py` (importa `rodada-3/src/gen_r3.py` e `header/src/gen_hd.py`), render `../render.sh`. Só no site (sem e-mail/push). Nenhum token novo; ícones lucide novos copiados para `../assets/icons/`: bell-ring, bell-off, check.

| Prancha | Descrição |
|---|---|
| `N1.png` | Botão no hero H2 e no card agendado (0018): ativo (Bell, primary), carregando, inscrito (BellRing/Check em --ok, “Você será avisado” + “Cancelar aviso”); visitante → Sheet Entrar e o aviso é ativado após o login. Mobile 44 px. |
| `N2.png` | (Referência; HD1–HD3 não escolhidos) Sino com contador em HD1/HD2/HD3 (0 sem badge, 3, 9+), badge --primary; mobile com sino de 44 px. |
| `N2-atual.png` | **Vale este.** Sino com contador (0, 3, 9+) no header atual R5/R11, à esquerda do saldo; mobile à esquerda do menu (44 px); visitante sem sino. Gerador `src/gen_n2a.py`. |
| `N3.png` | Popover (desktop) / Sheet (mobile): não lida com ponto bordô + fundo --accent-soft, “Marcar todas como lidas”, todas lidas, vazio (BellOff); item inteiro leva à sala do lote. Tipo único “Lote abriu” (0018, 0013, 0012). |
| `N4.png` | Toast Sonner “O lote 0018 abriu” com “Dar lance” + “Ver lote”; desktop no canto inferior direito, mobile no topo. |

Dúvidas para o dev: (1) tempo real (o SSE já existe) vs polling de 30–60 s para o contador; (2) quem gera a notificação: um job/cron na virada de status agendado→aberto, que cria uma linha por inscrito (tabela nova LotWatch/Notification = migration, reabre o Freeze D12); (3) toast só para quem está online; offline vê o contador ao voltar; (4) cancelar o aviso apaga a inscrição; o lote já aberto esconde o botão; (5) há limite de notificações guardadas (sugestão: últimas 20)?
