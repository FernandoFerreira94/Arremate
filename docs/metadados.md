# Metadados e compartilhamento — U08

Pedido de Fernando em 23/10/2026: dar atenção aos metadados do site. Esta especificação complementa o plano; não é requisito atribuído à Verzel nem implementação concluída. Mantém as 9 páginas propostas.

## Critérios de aceite

- Título único e descrição coerente por página; sufixo com nome aprovado pelo Grok/Fernando. Sem título padrão do Vite, texto fictício comercial ou metadados da Verzel como se ela operasse a aplicação.
- Documento com `lang="pt-BR"`, charset UTF-8 e viewport responsivo sem impedir zoom.
- Favicons, apple-touch-icon e imagem social produzidos a partir da identidade aprovada pelo Grok; `theme-color` coerente com o tema. Não criar identidade visual paralela.
- Nas páginas compartilháveis: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:alt`, `og:locale=pt_BR` e `og:site_name`; Twitter Card com imagem grande e textos equivalentes. Proposta de asset social: 1200 × 630, com dimensões/tipo declarados e URL HTTPS absoluta acessível sem login.
- `canonical` e URLs OG derivados de origem de produção validada/configurada, nunca de Host ou query arbitrária da request. Sem localhost, fragmento, tracking ou redirect aberto. Sem canonical cruzado de todos os lotes para a Home.
- Imagem/textos sociais usam dados públicos persistidos e licença verificada; não consultar Met a cada preview. Sem nomes pessoais, email, saldo, usuário interno, sessão ou informações privadas em HTML/head/JSON-LD/assets.
- Previews não prometem lance atual, cronômetro ou resultado atualizado: são informações voláteis sujeitas ao cache de terceiros. Descrever a obra/lote e a simulação; o estado real é consultado na sala.

## Política por página — proposta para aprovação no S5

Deploy público de avaliação não exige indexação por buscadores. Recomenda-se **demo inteira com `noindex`**, mantendo acesso direto e compartilhamento. Se Fernando aprovar exposição indexável de portfólio, apenas as páginas públicas adequadas mudam conforme tabela. Não alterar segurança/configuração em execução nesta etapa.

| Página | Título base proposto | Indexação e dados do preview |
| --- | --- | --- |
| Vitrine | Leilões de arte — demonstração | Demo: noindex; candidata a indexar após aprovação. Preview institucional da simulação |
| Entrar | Entrar | Sempre noindex; descrição genérica, sem credencial/conta preenchida |
| Sala | Obra / título do lote | Demo: noindex; candidata a indexar se pública e válida. Preview da obra e origem, sem saldo/posição pessoal |
| Meus lotes | Meus lotes | Sempre noindex; sem dados da sessão no head |
| Criar lote | Criar lote | Sempre noindex; sem obra ainda privada ou formulário serializado |
| Carteira | Minha carteira | Sempre noindex; nenhum valor/usuário em preview |
| Meus arremates | Meus arremates | Sempre noindex; não listar participações no head |
| Auditoria | Auditoria do lote | Sempre noindex por proposta de privacidade; preview genérico, sem alias/histórico no head |
| Comprovante | Comprovante de arremate — demonstração | Sempre noindex; compartilhável por link público, preview genérico sem vencedor/valor/token como texto visível |

`noindex` não controla acesso nem torna o comprovante privado. Recursos privados continuam com autenticação/autorização e respostas sem dados antes da sessão. A proposta de noindex é política de descoberta, não proteção de dados.

Para a demo: `meta robots` e/ou `X-Robots-Tag` emitidos no servidor, sem depender de JavaScript. Não bloquear o crawler pelo robots.txt nas páginas em que ele precisa ler noindex; robots.txt não é mecanismo de autorização. Não publicar sitemap listando as 9 páginas indiscriminadamente. Enquanto todas forem noindex, sitemap é N/A; se indexação pública for aprovada, incluir somente URLs públicas, indexáveis, canônicas e válidas, nunca painel, carteira, auditoria ou comprovantes.

## Entrega do HTML e segurança

U09 define site na Vercel + API Node persistente separada. A01 selecionou Next App Router no bootstrap U12; Metadata/generateMetadata no servidor é a única implementação do head. Não criar renderer no Nest nem depender de JS do crawler. Usar projeção pública dos dados persistidos; navegador/crawler recebem o mesmo head. Não fazer detecção de bot ou contratar serviço de prerender separado por padrão. [Compatibilidade da hospedagem](hospedagem.md).

Centralizar regras em front-end/src/lib/page-metadata.ts, usando escape/renderização da Metadata API nativa do Next; a navegação atualiza/restaura o head, sem tags duplicadas ou metadado privado remanescente após logout. Não usar concatenação de título externo sem escape. URLs usam allowlist/esquema HTTPS e origem confiável. Rotas privadas retornam head genérico; conteúdo da sessão nunca entra na resposta pública cacheada. HTML personalizado, quando existir, não recebe cache público.

Lote/comprovante inexistente deve retornar HTTP 404 e noindex, sem soft-404 com status 200/título de outro lote. Falha transitória deve manter status 5xx adequado e head genérico seguro, sem mascarar falha como página válida. Não anunciar Offer, preço comercial, avaliação, estoque, organização ou propriedade fictícios em dados estruturados. JSON-LD só quando houver fato e tipo adequados à simulação; não é dependência obrigatória deste desafio.

## Testes T16 — planejados

1. HTTP sem executar JavaScript: Home, sala e comprovante têm título/descrição/OG esperados no HTML inicial; URL/imagem absolutas, asset público responde corretamente e tags não duplicam.
2. Matriz das 9 páginas: noindex conforme política; páginas privadas não expõem dados sem sessão; canonicals e compartilhamento respeitam cada rota.
3. Título malicioso importado, Host/query manipulados e URL inválida não injetam HTML/atributos nem mudam origem canônica.
4. Navegar entre dois lotes → carteira → logout → Home restaura o head correto; nenhum saldo/identificador interno/credencial aparece em HTML ou assets sociais.
5. HTTP 404/erro de provider, OG com dados persistidos durante queda do Met, robots e sitemap seguem os critérios acima. Preview real na URL pública verificado no release; cache de terceiro não equivale a dado financeiro atual.

Teste de HTML inicial é integrado; teste de troca de rota é E2E. Registrar comandos, resultados e limites em evidence, junto com review do renderizador e das fronteiras públicas. Matriz das nove páginas continua **NOT RUN**. O bootstrap testa somente HTML inicial do placeholder (lang/title/noindex) e404; isso não valida os assets/OG/canonical/privacidade das futuras telas.

## Fontes oficiais consultadas

- [Google — JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): processamento/renderização e cuidados com metadados em aplicações JavaScript.
- [Google — noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): meta/header e necessidade de permitir acesso ao crawler para ler a diretiva.
- [Open Graph Protocol](https://ogp.me/): propriedades básicas e opcionais do compartilhamento.
