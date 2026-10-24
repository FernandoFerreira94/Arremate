# Proposta de conteúdo — Arremate (cara de produção)

**Autor:** Fred (UX/UI) · 24/10/2026 · **Status: PROPOSTA, aguarda aprovação do Fernando.** Não altera pranchas, tokens nem código.

Fontes lidas: `pranchas/INDICE.md`, `HANDOFF-GROK.md`, e no repositório local (`/workspace/arremate-w/repo`): `docs/design/DECISOES-VISUAIS.md`, `docs/decisoes.md` (D01–D16, Design Freeze D12), `back-end/prisma/schema.prisma`, `back-end/src/catalog/*`, `front-end/src/features/*`.

**O que já existe (base desta proposta):**
- `CatalogItemSnapshot.attributes` (JSON) já guarda do Met: `artist`, `artistBio`, `date`, `medium`, `dimensions`, além de `credit` (creditLine) e `license`. A imagem é baixada pelo `image-importer` (mídia local, `mediaKey`).
- `Lot` tem só `initialCents`, `incrementCents`, `startsAt`, `endsAt`, `status`. **Não há** campos de estimativa, condition report nem proveniência.
- Sala do Lote: o `AboutCard` (`lot-room-page.tsx`) já mostra Artista, Data, Técnica, Dimensões, Licença, Lance inicial, Incremento, Início e Fim. A Vitrine tem `Tabs` (Ao vivo / Agendados / Encerrados), `LotCard` e paginação de 8 (D10).
- **Não existe `seed.ts` ainda** (previsto na P8: 1 leiloeiro, 2 licitantes, 1 lote). Hoje as páginas ficam vazias porque há pouco dado, não por falta de layout.

Conclusão: a maior parte do “pouco conteúdo” se resolve com **seed rico** usando campos que já existem. O que exige UI está listado na seção 4, sempre reaproveitando componentes que já existem.

---

## 1) Conteúdo a acrescentar por página

| Página | Hoje | Acrescentar | Origem do dado |
| --- | --- | --- | --- |
| **Vitrine** (`/`) | Cards com título, artista · data, preço e prazo | 24 lotes distribuídos nas 3 abas (ver catálogo); 3 páginas de 8; técnica numa linha `muted` no `LotCard`; contagem de lances no card (“12 lances”) | Seed + `medium` já existente; contagem já calculável dos `Bid` |
| **Sala do Lote** (`/lotes/[id]`) | Imagem, painel de lance, “Sobre o lote” | (a) **Nota do artista** (`artistBio`, ex.: “Dutch, Zundert 1853–1890”); (b) **Proveniência / crédito** = `creditLine` real do Met (“Bequest of…, 1909”) com link “Ver no The Met” (`sourceUrl`); (c) **Histórico de lances** com 5–15 lances por apelido (já existe na sala/auditoria); (d) **Estimativa** (faixa, ex.: R$ 8–12 mil) — ver conflito C2; (e) **Condition report** curto — ver conflito C3 | (a)(b) já no snapshot; (c) seed via serviço de lance; (d)(e) exigem campo novo |
| **Carteira** (`/carteira`) | Saldo e tabela “onde está comprometido” | Extrato com 8–12 movimentos variados (depósitos 1k/5k/10k, bloqueio por lance, liberação por superação, liquidação) para os 2 licitantes demo | Seed via serviço de carteira (`WalletEntry`) |
| **Meus arremates** (`/meus-arremates`) | Arremates + aba Participações | 2 arremates e 4–5 participações (liderando, superado, não arrematado) por licitante demo | Seed (lances + liquidação) |
| **Comprovante público** (`/comprovantes/[token]`) | Imagem, valores, crédito | Nada novo de UI; ganha conteúdo real com 2–3 lotes liquidados no seed | Seed |
| **Auditoria pública** (`/lotes/[id]/auditoria`) | Cadeia de lances | Lotes com 10+ lances para a cadeia não parecer vazia | Seed |
| **Painel do leiloeiro** (`/painel/lotes`, `/painel/lotes/novo`) | Meus lotes / criar lote | Leiloeiro demo com os 24 lotes em todos os estados (inclusive 1 cancelado e 1 agendado) | Seed |
| **Entrar / 404** | — | Sem mudança | — |

---

## 2) Catálogo de 24 lotes (objectIDs verificados)

Todos verificados em 24/10/2026 na API `https://collectionapi.metmuseum.org/public/collection/v1/objects/{ID}` com `isPublicDomain=true` e `primaryImage` preenchido. Nenhuma obra repetida. Os lotes 0007, 0009, 0012 e 0016 mantêm as obras das pranchas. Estimativas e lances são **valores simulados** (demonstração; nenhuma obra está à venda). Dimensões em cm, conforme o Met.

Estado: **aberto** = ao vivo com mais de 1 h; **encerrando** = ao vivo com menos de 1 h (estado derivado do relógio, não é status novo); **encerrado** = liquidado ou sem lances; 2 lotes **agendados** cobrem a aba Agendados.

| Lote | Título (pt-BR) | Artista | Ano/época | Estilo | Técnica | Dimensões | Estimativa | Lance inicial | Estado | objectID | URL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0001 | Erasmo de Roterdã | Hans Holbein, o Jovem | c. 1532 | Renascimento do Norte | Óleo sobre painel de tília | 17,6 × 14 | R$ 6–9 mil | R$ 3.000 | aberto | 459080 | https://www.metmuseum.org/art/collection/search/459080 |
| 0002 | Os ceifeiros | Pieter Bruegel, o Velho | 1565 | Renascimento flamengo | Óleo sobre carvalho | 116,5 × 159,5 | R$ 40–60 mil | R$ 20.000 | encerrando | 435809 | https://www.metmuseum.org/art/collection/search/435809 |
| 0003 | Vista de Toledo | El Greco | c. 1599–1600 | Maneirismo | Óleo sobre tela | 121,3 × 108,6 | R$ 30–45 mil | R$ 15.000 | aberto | 436575 | https://www.metmuseum.org/art/collection/search/436575 |
| 0004 | Bishamonten Tobatsu | Japão (autor anônimo) | fim séc. X–início XI | Escultura budista Heian | Madeira de zelkova com traços de cor | alt. 125,1 | R$ 18–25 mil | R$ 9.000 | encerrado | 53162 | https://www.metmuseum.org/art/collection/search/53162 |
| 0005 | Manuel Osorio Manrique de Zuñiga | Goya | 1787–88 | Rococó tardio / retrato | Óleo sobre tela | 127 × 101,6 | R$ 25–35 mil | R$ 12.000 | aberto | 436545 | https://www.metmuseum.org/art/collection/search/436545 |
| 0006 | Inrō com desenho de armadura | Yamada Jōkasai | 2ª metade séc. XIX | Arte decorativa Edo/Meiji | Laca dourada e colorida com incrustações | 9,8 × 4,9 × 3,2 | R$ 800–1.200 | R$ 300 | aberto | 45585 | https://www.metmuseum.org/art/collection/search/45585 |
| 0007 | A morte de Sócrates | Jacques Louis David | 1787 | Neoclassicismo | Óleo sobre tela | 129,5 × 196,2 | R$ 10–14 mil | R$ 5.000 | encerrado (arrematado R$ 12.900) | 436105 | https://www.metmuseum.org/art/collection/search/436105 |
| 0008 | A grande onda de Kanagawa | Katsushika Hokusai | c. 1830–32 | Ukiyo-e | Xilogravura, tinta e cor sobre papel | 25,7 × 37,9 | R$ 2–3,5 mil | R$ 1.000 | encerrando | 45434 | https://www.metmuseum.org/art/collection/search/45434 |
| 0009 | Madame Georges Charpentier e os filhos | Auguste Renoir | 1878 | Impressionismo | Óleo sobre tela | 153,7 × 190,2 | R$ 35–50 mil | R$ 100 | aberto | 438815 | https://www.metmuseum.org/art/collection/search/438815 |
| 0010 | Veneza, do pórtico da Salute | J. M. W. Turner | c. 1835 | Romantismo | Óleo sobre tela | 91,4 × 122,2 | R$ 20–30 mil | R$ 10.000 | agendado | 437853 | https://www.metmuseum.org/art/collection/search/437853 |
| 0011 | Washington atravessando o Delaware | Emanuel Leutze | 1851 | Pintura histórica | Óleo sobre tela | 378,5 × 647,7 | R$ 60–90 mil | R$ 30.000 | aberto | 11417 | https://www.metmuseum.org/art/collection/search/11417 |
| 0012 | La Berceuse | Vincent van Gogh | 1889 | Pós-impressionismo | Óleo sobre tela | 92,7 × 73,7 | R$ 15–20 mil | R$ 8.000 | encerrado (não arrematado acima do 2º) | 437984 | https://www.metmuseum.org/art/collection/search/437984 |
| 0013 | Coração dos Andes | Frederic Edwin Church | 1859 | Hudson River School | Óleo sobre tela | 168 × 302,9 | R$ 50–80 mil | R$ 25.000 | aberto | 10481 | https://www.metmuseum.org/art/collection/search/10481 |
| 0014 | Montanhas Rochosas, Pico Lander | Albert Bierstadt | 1863 | Hudson River School | Óleo sobre tela | 186,7 × 306,7 | R$ 45–70 mil | R$ 22.000 | agendado (24/10 10:00, prancha 10) | 10154 | https://www.metmuseum.org/art/collection/search/10154 |
| 0015 | Mulher com papagaio | Gustave Courbet | 1866 | Realismo | Óleo sobre tela | 129,5 × 195,6 | R$ 22–32 mil | R$ 11.000 | encerrado (sem lances) | 436002 | https://www.metmuseum.org/art/collection/search/436002 |
| 0016 | O rapto das sabinas | Nicolas Poussin | c. 1633–34 | Classicismo barroco | Óleo sobre tela | 154,6 × 209,9 | R$ 5–8 mil | R$ 2.000 | aberto | 437329 | https://www.metmuseum.org/art/collection/search/437329 |
| 0017 | Mulher sentada junto a um vaso de flores | Edgar Degas | 1865 | Impressionismo | Óleo sobre tela | 73,7 × 92,7 | R$ 14–20 mil | R$ 7.000 | aberto | 436121 | https://www.metmuseum.org/art/collection/search/436121 |
| 0018 | A aula de dança | Edgar Degas | 1874 | Impressionismo | Óleo sobre tela | 83,5 × 77,2 | R$ 28–40 mil | R$ 14.000 | encerrando | 438817 | https://www.metmuseum.org/art/collection/search/438817 |
| 0019 | Passeio de barco | Édouard Manet | 1874 | Impressionismo | Óleo sobre tela | 97,2 × 130,2 | R$ 18–26 mil | R$ 9.000 | encerrado (arrematado) | 436947 | https://www.metmuseum.org/art/collection/search/436947 |
| 0020 | Madame X | John Singer Sargent | 1883–84 | Realismo / retrato de salão | Óleo sobre tela | 243,2 × 143,8 | R$ 30–45 mil | R$ 15.000 | aberto | 12127 | https://www.metmuseum.org/art/collection/search/12127 |
| 0021 | Desfile de circo | Georges Seurat | 1887–88 | Pontilhismo / neoimpressionismo | Óleo sobre tela | 99,7 × 149,9 | R$ 24–34 mil | R$ 12.000 | aberto | 437654 | https://www.metmuseum.org/art/collection/search/437654 |
| 0022 | Campo de trigo com ciprestes | Vincent van Gogh | 1889 | Pós-impressionismo | Óleo sobre tela | 73,2 × 93,4 | R$ 35–55 mil | R$ 18.000 | encerrando | 436535 | https://www.metmuseum.org/art/collection/search/436535 |
| 0023 | Natureza-morta com maçãs e prímulas | Paul Cézanne | c. 1890 | Pós-impressionismo | Óleo sobre tela | 73 × 92,4 | R$ 16–24 mil | R$ 8.000 | encerrado (arrematado) | 435882 | https://www.metmuseum.org/art/collection/search/435882 |
| 0024 | A corrente do Golfo | Winslow Homer | 1899 (retrabalhada até 1906) | Realismo americano | Óleo sobre tela | 107,5 × 159,3 | R$ 20–30 mil | R$ 10.000 | aberto | 11122 | https://www.metmuseum.org/art/collection/search/11122 |

Distribuição: 11 abertos, 5 encerrando, 6 encerrados (3 arrematados, 1 não arrematado, 1 sem lances, 1 escultura arrematada), 2 agendados. Faixa de lance inicial de R$ 100 a R$ 30.000; épocas do séc. X ao XX; pintura, xilogravura, escultura em madeira e laca. Lances do seed ficam dentro do depósito de R$ 1 a R$ 100 mil (D05). Sugestão: usar 1 cancelado extra só no painel do leiloeiro (não aparece na vitrine).

---

## 3) Fonte das imagens

- **The Metropolitan Museum of Art — Open Access.** Obras marcadas `isPublicDomain=true` são liberadas em **Creative Commons Zero (CC0 1.0)**: https://www.metmuseum.org/about-the-met/policies-and-documents/open-access e https://creativecommons.org/publicdomain/zero/1.0/
- API pública (sem chave): https://metmuseum.github.io/ · endpoint `collectionapi.metmuseum.org/public/collection/v1/objects/{ID}`.
- **Sem dependência nova:** o seed usa o `met-catalog.client.ts` + `image-importer.ts` que já existem (fetch nativo), gravando snapshot + mídia local (`mediaKey`). Seed **não chama a API no startup**; usa snapshots obtidos antes, com proveniência (regra do spec: “não inventar item e dizer que veio da API”). Os 7 JSON já salvos em `pranchas/assets/obras/` servem de exemplo de formato.
- Crédito exibido: `creditLine` do Met + “The Met Open Access, CC0” (rodapé atual já cobre).

---

## 4) Só seed × mudança de UI

| Item | Tipo | Componente existente reaproveitado | Observação |
|---|---|---|---|
| 24 lotes, 3 abas, 3 páginas | Só seed | `LotCard`, `Tabs`, paginação da vitrine | Datas relativas ao momento do seed |
| Histórico de lances, auditoria cheia | Só seed | Tabela da sala / `audit-page` | Lances via serviço (assinatura HMAC), nunca INSERT direto |
| Extrato da carteira | Só seed | `Table` em `wallet-page` | Via serviço de carteira |
| Arremates / participações / comprovantes | Só seed | `my-awards-page`, `receipt-page` | Via liquidação real |
| Artista, data, técnica, dimensões, licença | Só seed | `AboutCard` (já exibe) | Campos já no snapshot |
| Nota do artista (`artistBio`) | UI pequena | Mais uma linha `dt/dd` no `AboutCard` | Dado já no JSON; precisa só expor no `PublicLot` |
| Proveniência / crédito + “Ver no The Met” | UI pequena | Linha no `AboutCard` + `Button variant="outline" size="sm"` com link (igual a “Auditoria pública”) | `credit` e `sourceUrl` já existem |
| Técnica no card da vitrine | UI pequena | Linha `text-sm text-muted-foreground` já usada no `LotCard` | |
| Contagem de lances no card | UI pequena | Mesma linha `muted` do `LotCard` | Precisa expor contagem na API |
| Estimativa (faixa) | UI + **schema** | Linha no `AboutCard`, valor em Fraunces como os outros preços | Campo novo em `Lot` → ver C2 |
| Condition report | UI + **schema** | `Card` + `CardHeader/CardTitle` igual ao “Sobre o lote” | Campo novo; texto simulado → ver C3 |
| Badge “Encerrando” | Nenhuma (opcional) | `LotStateBadge` / contador já existente | Se já houver destaque de prazo curto, não criar nada |
| Filtros por estilo/época na vitrine | **Fora** | — | Não proposto: seria tela nova, quebra o Freeze |

---

## 5) Conflitos e pontos de atenção (só sinalizados)

- **C1 — Cópias da documentação divergentes.** `/workspace/casa-de-leilao/docs` ainda diz “Design Freeze não declarado” e trata 8 itens/1k-5k-10k como pendentes; o repositório (`/workspace/arremate-w/repo/docs/decisoes.md`) registra D10–D12 (Freeze declarado em 23/10). Também não há `DECISOES-VISUAIS.md` nesta pasta — só no repositório. Considerei o repositório como fonte. Precisa de sincronização (Orquestrador).
- **C2 — Estimativa exige campo novo no `Lot`** (migration + API + UI). Pequena, mas é mudança de schema fora do plano. Alternativa sem schema: omitir estimativa.
- **C3 — Condition report e estimativa não vêm do Met.** São textos inventados; o spec proíbe sugerir que vieram da API. Se aprovados, rotular “Simulado para demonstração” (padrão do rodapé “Valores simulados”). Alternativa: não incluir condition report.
- **C4 — Seed da P8 previa 1 leiloeiro, 2 licitantes e 1 lote.** 24 lotes com lances e liquidações amplia o escopo do seed (tempo até 29/10). Precisa ser idempotente e não destrutivo (T15) e passar pelos serviços (HMAC/carteira).
- **C5 — “Encerrando” não é status do modelo** (`LotStatus`); é derivado do tempo. Não criar status nem aba nova; a vitrine continua com Ao vivo/Agendados/Encerrados e ordenação “encerra antes” (D06).
- **C6 — Imagens no seed dependem da API do Met no momento da preparação.** Se o Met cair na preparação, o lote fica com fallback; em produção nada muda para o visitante (D07).
- **C7 — Obras muito famosas** (Madame X, Washington, A grande onda) podem soar irreais “à venda”. O rodapé já diz “nenhuma obra está à venda”; aceitável para demo, mas o Fernando pode preferir obras menos icônicas.

Nada aqui altera cores, fontes, raio, tema, atalhos de lance/depósito ou ordenação aprovados.
