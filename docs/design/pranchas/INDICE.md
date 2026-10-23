# Índice das pranchas — Arremate (Casa de Leilão)

**Status geral:** etapas 1, 2 e 3 desenhadas. Decisões de identidade aprovadas pelo Fernando em 23/10, segundo o Orquestrador Dev (nome Arremate; Bordô #6E1E2B e Latão #A9823A sobre papel #F6F3EC; Fraunces e Inter; atalhos mínimo/+1/+2; depósito R$1 a R$100 mil; vitrine por término mais próximo; sem aviso ao visitante quando o Met cair; sem dark mode). **Status: Design Freeze (aprovado por Fernando 23/10)**, incluindo logo, paginação de 8 itens e atalhos de depósito 1k/5k/10k (D09–D12). Pendentes na implementação: validação de a11y e alinhamento de textos/códigos de erro com o back.
Atualizado em 23/10/2026 (BRT). Fonte visual canônica: os HTML em `src/`; os PNG são exportações deles.

## Ordem de leitura

| # | Prancha | PNG | Fonte | Status |
| --- | --- | --- | --- | --- |
| 00 | Design system: nome e logo Arremate, paleta aprovada, tipografia, tokens, radius, sombras, ícones lucide, componentes shadcn, leis de UX, assets de metadados | `00-design-system.png` | `src/00-design-system.html` | Congelada |
| 01 | Estados e componentes: botões, campos monetários, badges, alertas, recusas R15, cronômetro/prorrogação, skeleton/fallback, AlertDialog, toast, tabs/paginação | `01-estados-componentes.png` | `src/01-estados-componentes.html` | Congelada |
| 02 | Vitrine desktop 1440: E1 ao vivo (licitante), E2 carregando, E3 vazio, E4 erro, E5 catálogo externo fora, E6 cabeçalho de visitante, E7 agendado/encerrado | `02-vitrine-desktop.png` | `src/02-vitrine-desktop.html` | Congelada |
| 03 | Vitrine mobile 390: M1 ao vivo, M2 carregando, M3 aba vazia, M4 menu (Sheet) | `03-vitrine-mobile.png` | `src/03-vitrine-mobile.html` | Congelada |
| 04 | Sala do lote desktop 1440: E1 ao vivo/superado, E2 ganhando, E3–E4 recusas, E5 prorrogação, E6 reconectando, E7 confirmação indeterminada, E8 agendado, E9 processando resultado, E10 arrematou, E11 sem lances, E12 cancelado, E13 visitante/leiloeiro, E14 confirmar lance | `04-sala-desktop.png` | `src/04-sala-desktop.html` | Congelada |
| 05 | Sala do lote mobile 390: M1 superado, M2 recusa por saldo, M3 prorrogado e ganhando, M4 arrematou, M5 reconectando | `05-sala-mobile.png` | `src/05-sala-mobile.html` | Congelada |
| 06 | Carteira desktop 1440: E1 com saldo, E2 zero, E3 inválido, E4 confirmação, E5 pendente, E6 sucesso, E7 erro/indeterminado, E8 superado em tempo real, E9 após arremate, E10 carregando | `06-carteira-desktop.png` | `src/06-carteira-desktop.html` | Congelada |
| 07 | Carteira mobile 390: M1 com saldo, M2 depósito (Sheet), M3 inválido, M4 sucesso, M5 saldo zero | `07-carteira-mobile.png` | `src/07-carteira-mobile.html` | Congelada |
| 08 | Entrar `/entrar`: desktop E1–E7, mobile M1–M3 | `08-entrar.png` | `src/08-entrar.html` | Congelada |
| 09 | Meus lotes `/painel/lotes`: E1–E9, M1–M3 | `09-meus-lotes.png` | `src/09-meus-lotes.html` | Congelada |
| 10 | Criar lote `/painel/lotes/novo`: E1–E9, M1–M3 | `10-criar-lote.png` | `src/10-criar-lote.html` | Congelada |
| 11 | Meus arremates `/meus-arremates`: E1–E7, M1–M3 | `11-meus-arremates.png` | `src/11-meus-arremates.html` | Congelada |
| 12 | Auditoria `/lotes/:id/auditoria`: E1–E7, M1–M3 | `12-auditoria.png` | `src/12-auditoria.html` | Congelada |
| 13 | Comprovante `/comprovantes/:token`: E1–E7, M1–M3 | `13-comprovante.png` | `src/13-comprovante.html` | Congelada |

Cada prancha 08–13 traz o desktop 1440 e o mobile 390 na mesma imagem. Estados detalhados e checagem R01–R33/U01–U11 (coberto ou fora do design, com motivo) em `../HANDOFF-GROK.md` §8 e §8b.

## Cobertura R/U (resumo)

- **Cobertos:** R01–R04, R06–R27; U02, U03, U04, U07, U08.
- **Fora do design** (entrega, stack ou processo): R05, R28–R33; U01, U05, U06, U09, U10, U11.

## Arquivos de apoio

- `assets/obras/`: 7 imagens do The Met Open Access (CC0, `isPublicDomain: true` conferido na API); créditos em `../HANDOFF-GROK.md`.
- `assets/icons/`: SVG do lucide-static 1.61.0 (licença ISC).
- `assets/meta/`: favicon.svg, favicon.ico (32), apple-touch-icon.png (180), og-image.png (1200×630).
- `src/_gen/`: scripts Python que geram os HTML e exportam os PNG (Chrome headless). Servem só para a apresentação; não são código de produto.
