# DESIGN — Arremate

Resumo do design system **implementado**. Fonte visual congelada (D12): [HANDOFF-GROK](docs/design/HANDOFF-GROK.md) e [pranchas](docs/design/pranchas/INDICE.md). Em conflito, o HANDOFF vale; este arquivo só aponta onde cada coisa vive no código.

## Tokens (`front-end/src/app/globals.css`)

| Papel | Variável | Valor |
| --- | --- | --- |
| Fundo (papel) | `--background` | `#f6f3ec` |
| Texto | `--foreground` | `#1f1b16` |
| Primária (Bordô) | `--primary` / `--primary-hover` | `#6e1e2b` / `#5a1722` |
| Acento (Latão) | `--accent` | `#a9823a` |
| Erro | `--destructive` | `#b42318` |
| Sucesso | `--success` / `--success-soft` | `#1e6b45` / `#e6f2ea` |
| Aviso | `--warning` / `--warning-soft` | `#8a5300` / `#fbf0dc` |
| Raio | `--radius-sm/md/lg/xl` | 4 / 6 / 10 / 14 px |
| Fontes | `--font-serif` / `--font-sans` | Fraunces (títulos e valores) / Inter (UI) |

Só tema claro (D08). Sem dark mode.

## Componentes

- Primitivas shadcn sobre `radix-ui` (D16) em `front-end/src/components/ui/`; ícones lucide; nenhuma biblioteca extra de UI/motion.
- Compostos do produto: `features/lots/lot-card.tsx` (LoteCard), `features/lots/lot-room-page.tsx` (preço, contador, MyStatus, ResultBanner, BidForm com atalhos mínimo/+1/+2 e confirmação), `features/lots/audit-page.tsx` (Integridade), `features/lots/receipt-page.tsx` (Simulado), carteira em `features/wallet/`.
- Dinheiro sempre em centavos BigInt e `formatBrl`; horários em BRT (`formatBrt`).

## Regras de uso

- Valores e títulos em Fraunces com `tabular-nums`; resto em Inter.
- Selo "Demonstração · valores simulados" fixo no header; comprovante sempre com "Simulação · sem valor fiscal ou de compra".
- Estados obrigatórios por tela: carregando (Skeleton), vazio, erro com tentar de novo, acesso negado, canal degradado ("Reconectando…").
- Responsivo: desktop 12 colunas (sala 7/5), mobile 390 em coluna única com menu em folha.

## Evidência visual

`docs/evidence/screenshots/tarefa-8/` e `tarefa-9/` (1440 e 390 px). `.design-system/` contém agora um índice documental do código/HANDOFF, extraído antes da extensão D17; tokens continuam canônicos em globals.css e a direção visual no HANDOFF, sem duplicação de tema.

## Entrada animada — 24/10/2026

D17: splash800ms por sessão e entrada sequencial200ms dos blocos, até8px, com CSS nativo. BrandIntro é decorativo; o script estático no head decide antes do primeiro frame e omite a introdução em reduced-motion/storage indisponível. Interação cancela imediatamente. PageEntrance usa pathname, sem reanimar dados ao vivo; sem transform persistente em ancestrais dos CTAs fixos. [Motion](.design-system/animations.md) e [evidência](docs/evidence/2026-10-24-entrada-animada.md).

## D19 — Ritmo mais lento — 24/10/2026

Tempos vigentes: splash3s, saída800ms, componentes850ms e cards escalonados100–600ms. Isso substitui o tempo inicial800/200ms acima. Interação/foco continuam imediatos; o wrapper mantém data-entry-interrupted até trocar rota, evitando foco invisível e reentrada ao desfocar. Sem mudar identidade/estrutura financeira.
