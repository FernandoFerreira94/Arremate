# Pranchas · Hero da vitrine (Arremate) — PROPOSTA para o Fernando escolher

Fred · 25/10/2026. Gerador `src/gen_h.py` (importa `rodada-3/src/gen_r3.py`: header R5, demo, `lcard`/Tabs R2, tokens e CSS). Render Chrome headless 1520 px, frame 1440. **Nenhum token novo**; lucide de `../assets/icons/`. Cada prancha mostra o começo da vitrine (Tabs + 4 cards) logo abaixo do hero.

| Prancha | Descrição |
|---|---|
| `H1.png` | Lote em destaque (0013, Coração dos Andes): imagem contain à esquerda, lance atual R$ 31.000 em bordô, contagem h/min/s e um CTA “Dar lance” — hero 320 px. |
| `H2.png` | Próximo leilão (0018, A aula de dança, abre 25/10 10:00): miniatura, lance inicial, contagem grande até abrir e CTA “Avise-me quando abrir” — hero 280 px. |
| `H2b.png` | **Evolução do H2 implementado:** carrossel de até 5 agendados (hoje 3 reais: 0018, 0010, 0014). Hero de 250 px, setas 44 px nas laterais, pills clicáveis (ativo --primary, “Leilão 2 de 3”), Pausar/Retomar. Mobile: setas 44 px na linha do indicador + swipe. Desktop 1440 + mobile 390; spec na própria prancha. Gerador `src/gen_h2b.py`. |
| `H3.png` | Encerrando em breve: carrossel compacto de 3 lotes (0008, 0006, 0022) com contagem e “Dar lance” por card, setas e “Ver todos os 5” — hero 260 px. |

Notas: valores e prazos são os mesmos das pranchas R2/R3 (simulados). 0018 aparece como Agendado como em R2/R3, mas no PROPOSTA-CONTEUDO está “encerrando” (divergência já existente). O prazo 00:55:30 do 0022 é ilustrativo (o catálogo só diz “encerrando”, < 1 h). “Avise-me quando abrir” (H2) exige notificação, que não existe hoje; alternativa sem escopo novo: “Ver detalhes” como CTA.

## H2b · especificação do carrossel
- Até 5 lotes agendados, ordem “abre antes”. Hoje são 3 reais: 0018 (como nas pranchas) e 0010 e 0014 (PROPOSTA-CONTEUDO); não completar até 5. Com 1 lote: sem setas, indicador nem Pausar, e sem autoplay. Com 0: o hero não aparece.
- Setas ChevronLeft/Right em botões-ícone redondos de 44 px, nas laterais no desktop; circular. No mobile ficam na linha do indicador, abaixo do CTA (alcance do polegar, sem cobrir conteúdo), com swipe (limiar de 40 px).
- Indicador: pills, a ativa de 24×8 em --primary e as outras em --border; cada uma é botão com área de 44 px, aria-label “Leilão N de T” e aria-current.
- Autoplay a cada 4 s; pausa no hover, no foco (focusin/focusout) e com a aba oculta (visibilitychange). Botão Pausar/Retomar visível (WCAG 2.2.2); pausado pelo botão, não retoma sozinho.
- Transição: fade + translate de 16 px, 300 ms ease-out, em CSS puro. Com prefers-reduced-motion: sem autoplay e sem animação, troca instantânea só manual, sem o botão Pausar.
- ARIA: section aria-roledescription="carrossel" aria-label="Próximos leilões"; slide role=group aria-roledescription="slide" com “N de T”; ←/→ com o foco no carrossel; aria-live="off" em autoplay e "polite" em manual ou pausado; slides ocultos com inert.
- Contagem e estado do Avise-me são por slide (N1). Visitante → Sheet Entrar.
- Pendência: 0010 não tem data de abertura no catálogo e a do 0014 (24/10 10:00) já passou; na prancha a contagem aparece como “--”. Definir datas futuras no seed.
- Imagens novas, ambas CC0 do Met: 437853.jpg e 10154.jpg em `../assets/obras/`. Ícones lucide novos: pause e play.
