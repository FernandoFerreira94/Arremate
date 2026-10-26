# Pranchas · Toast (Sonner) e erro inesperado — PROPOSTA (G2 e G2b do plano 2026-10-25-erros-e-toasts)
Fred · 25/10/2026. Gerador `src/gen_t.py` (importa notificacoes/gen_n, footer/gen_f), render `../render.sh`. Header atual R5/R11 com sino; footer F3-cor. Nenhum token novo; ícone lucide novo: undo-2.

| Prancha | Descrição |
|---|---|
| `T1.png` | Variantes: sucesso, erro da API (com “Código para suporte”), aviso, info, erro inesperado, info de conexão; promise carregando → sucesso/erro; com ação (notificação “Dar lance”/“Ver lote”, “Desfazer”, “Tentar de novo”). Corpo --surface, cor de estado só na borda e no ícone; --primary só na ação principal. AA: ink-2 7,3:1, ok 6,4, err 6,5, warn 6,2, info 6,8, ink-3 4,8. |
| `T2.png` | Desktop bottom-right (pilha recolhida/expandida, 3 visíveis), mobile top-center; tabela de durações (4/4/6/8 s, até fechar com ação, carregando sem timeout) e aria-live (assertive só erro); pausa hover/foco/aba oculta, X + swipe, reduced-motion; migração do N4 para Sonner. |
| `E1.png` | 404 atual como referência; error.tsx dentro do layout (header + F3-cor) com “Tentar de novo” (reset) + “Voltar à vitrine”; global-error.tsx sem layout, autossuficiente (logo + “Tentar de novo” via reload + “Ir para a vitrine”); código de referência (digest) discreto; desktop + mobile. |

Dúvidas para o dev:
1. `components/app/toast.tsx` não existe no repo lido (`/workspace/arremate-w/repo`, anterior ao merge `690746d`), por isso a migração foi desenhada a partir do N4. Conferir no PC.
2. O plano cita dark/light, mas o Arremate não tem dark mode. Fica só o claro? (sugiro `theme="light"`)
3. requestId: mostrar mascarado no toast ou completo e copiável? Na prancha aparece como “req_••••” porque não há valor real.
4. A notificação com ação deve ficar até fechar ou ter 8 s, como no plano? Na prancha ficou até fechar.
5. No global-error o reset não basta. Usar `location.reload()`?
6. Os textos de sucesso dependem da Parte 2 (`message` da API); onde não houver, usar o fallback local do `notify.ts`.
7. “Removido dos favoritos” + Desfazer exige rota de refavoritar idempotente: NÃO VERIFICADO.
