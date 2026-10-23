# Identidade visual — decisões para Grok e Fernando

Atualizado em 23/10/2026; U04 e U13. Este é um registro de decisão, não um segundo design system.

| Item | Estado | Responsável / entrega |
| --- | --- | --- |
| Nome final | **LOCKED (D01): Arremate**; “Casa de Leilões” fica só como nome interno | Aprovado por Fernando em 23/10/2026 |
| Logo | **LOCKED (D09)**: “A” em Fraunces em moldura de latão sobre quadrado bordô (HANDOFF §1/§8) | Aprovado por Fernando em 23/10/2026; SVG em `pranchas/assets/meta/` |
| Paleta principal e cores semânticas | **LOCKED (D02)**: Bordô #6E1E2B, Latão #A9823A, papel #F6F3EC; tokens completos no HANDOFF §2 | Aprovado por Fernando em 23/10/2026 |
| Componentes | **DEFINIDO: shadcn** | Implementação usa primitivas oficiais e o visual aprovado |
| Tipografia, escala, grid, radius, sombra, motion | **LOCKED (D03 + Design Freeze D12)**: Fraunces (títulos/valores) + Inter (UI); escala/grid/radius/sombra/motion conforme HANDOFF §2 | Aprovado por Fernando em 23/10/2026 |
| Tema claro/escuro | **LOCKED (D08)**: só tema claro, sem dark mode | Aprovado por Fernando em 23/10/2026 |
| Metadados e assets | EXIGIDOS | Nome/title, favicon, apple-touch-icon, OG1200×630/alt e logo licenciada |

As cores precisam cobrir fundo/superfície/texto/borda/foco e status: agendado/ao vivo/encerrado/cancelado, ganhando/superado e íntegro/adulterado/indeterminado. Não depender só da cor; contraste WCAG2.2AA nas jornadas e estados disabled/pending/erro legíveis.

Grok entrega nove páginas desktop+mobile, DS e estados conforme [briefing](briefing-grok.md). Manter nomenclatura/variantes compatíveis com Button/Input/Label/Card/Dialog/AlertDialog/Tabs/Table/Badge/Alert/Skeleton do shadcn. Não é obrigatório usar todos nem reproduzir o tema padrão do registry.

Salvar artefatos em `docs/design/pranchas/`, assets próprios em `docs/design/pranchas/assets/` e handoff em `docs/design/HANDOFF-GROK.md`. O handoff identifica alternativas propostas, versão aprovada, nome/logo/paleta escolhidos, origem/licença de fontes/assets, tokens/variantes e comportamento responsivo. Proposta visual não equivale à aprovação de Fernando.

Após aprovação, Codex deriva DESIGN.md e .design-system/ dessa fonte e implementa componentes. Nenhuma paleta, marca ou logo será considerada final antes disso. Não alterar nome interno de pacotes/repositório para acompanhar brainstorm de marca.

**Design Freeze declarado por Fernando em 23/10/2026 (D12).** Também aprovados: paginação da vitrine com 8 itens (D10) e atalhos de depósito 1k/5k/10k (D11). Pendentes só na implementação: validação de a11y e alinhamento de textos/códigos de erro com o back-end. Ver [decisões](../decisoes.md).
