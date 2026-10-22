# AGENTS.md

Site da **Gravity Comercial** — intermediação, compra e venda de equipamentos
industriais usados, em Lajeado/RS, com equipamentos no Brasil, em Portugal e na
Argentina. Projeto BahTech.

O contrato tem dois entregáveis: o **site** (este repositório) e a **IA de
atendimento** no WhatsApp. O ponto de união entre os dois é o checklist de
equipamentos (ver "O que o briefing decidiu").

## Documentos — ler primeiro

- [`docs/SITE GRAVITY (1).md`](<docs/SITE GRAVITY (1).md>) — especificação do site:
  páginas, campos da ficha, fluxo "Quero vender", identidade, técnico, ordem de execução.
- [`docs/BLUEPRINT GRAVITY (1).md`](<docs/BLUEPRINT GRAVITY (1).md>) — ata da reunião
  com Júnior Mairesse (01/09/2026): decisões, pendências, questões em aberto e riscos.
- [`docs/DESIGN.md`](docs/DESIGN.md) — design system do mockup do Stitch (catálogo e ficha).
- [`docs/product-sources.json`](docs/product-sources.json) — fontes dos dados reais
  (produtos, contatos e a divergência do WhatsApp), observadas no site atual em 22/09/2026.
- [`README.md`](README.md) — como rodar, onde mexer, conteúdo a validar.

Os dois primeiros são registro histórico. Divergência entre eles e o código deve ser
anotada, não corrigida por cima. O blueprint cita um `IA.md` que não está no
repositório.

## Mapa do repositório

| Pasta | O que é |
|---|---|
| raiz (`app/`, `components/`, `lib/`, `public/`) | **O site** (Next.js). |
| `docs/` | Especificação, ata, design system do mockup, fontes dos dados reais e `referencias.txt` (sites de referência: foeth, vjt, anduril). |

As referências de design que guiaram o site foram apagadas em 05/10/2026 e continuam no
histórico do git (commit `b329aed`): a primeira home em HTML/CSS/JS (`html/`), os mockups
do Stitch do catálogo e da ficha, o mockup do Sobre e dos Depoimentos (`code.html` e
`screen.png` da raiz), o protótipo do v0 (o `app/` da raiz, com pnpm) e
`BahtechSignature.tsx`. Os comentários do código que citam esses arquivos (por exemplo,
"portado de `html/script.js`") registram de onde cada parte veio.

## Stack

Next.js 16.3 (App Router, Turbopack) · React 19.3 · TypeScript · Tailwind CSS 4
(`@theme`) · npm · Node 24.15+. Sem i18n: o site é só pt-BR.

```
.
├── app/
│   ├── (home)/                  root layout próprio; home.css portado da primeira home
│   ├── (catalogo)/              root layout próprio; Tailwind em catalogo.css
│   │   ├── segmentos/           lista de segmentos (sem busca; ver divergências)
│   │   │   └── [segmento]/      página do segmento, com os equipamentos dele
│   │   └── equipamento/[slug]/  ficha técnica
│   └── global-not-found.tsx     404 de URL sem rota
├── components/
│   ├── home/        HomeHeader, HomeMotion, motion-store
│   └── catalogo/    Cabecalho, Rodape, cards, Galeria, FormularioVenda, Icon
├── lib/
│   ├── equipamentos.ts  tipo Equipamento, dados e helpers
│   ├── segmentos.ts     lista de segmentos
│   ├── icones.ts        glifos do Material Symbols
│   └── site.ts          contatos, whatsappUrl(), emailUrl()
├── public/          logo, assets/ (fotos reais), equipamentos/ (fotos do mockup)
└── docs/            especificação, ata, design system do mockup, fontes dos dados
```

Comandos rodam na raiz: `npm run dev`, `npm run build`, `npm run lint`.

## Regras rígidas

- **Next 16 não é o Next do treinamento.** Antes de escrever código, ler o guia
  correspondente em `node_modules/next/dist/docs/` e respeitar os avisos de
  depreciação. O bloco que diz isso em `AGENTS.md` é regravado pelo `next dev` —
  não apagar.
- **Build é Turbopack.** É o padrão do `next build` no Next 16. Não adicionar
  `--webpack`: o caminho contém `!` (`projetoBah!Tech`), que o webpack lê como sintaxe
  de loader. O `turbopack.root` de `next.config.ts` fixa a raiz do projeto na pasta do
  repositório, sem depender da busca por lockfiles nas pastas acima.
- **npm.** Um lockfile só (`package-lock.json`); não instalar com pnpm nem yarn.
- **Dois root layouts, estilos isolados.** `(home)` usa o CSS original (`home.css`,
  variáveis em `:root`); `(catalogo)` usa Tailwind (`catalogo.css`, tokens em `@theme`).
  Um não importa o CSS do outro, e a navegação entre eles recarrega a página. Por isso o
  404 de URL sem rota é `app/global-not-found.tsx` (flag `experimental.globalNotFound`),
  que remonta `Cabecalho` e `Rodape`. UI nova do catálogo reusa `Cabecalho`, `Rodape` e
  `Icon` em vez de layout avulso.
- **Cores só pelos tokens.** No catálogo, os de `@theme` em `catalogo.css`; na home, as
  variáveis de `home.css`. Nada de hex cru em componente novo. **Nenhuma das duas paletas
  é oficial:** o turquesa da home (`--teal`, `#18b8ab`) é aproximação lida da logo em
  bitmap (`public/logo-gravity.webp`, a logo entregue pelo cliente); o do
  catálogo (`primary`, `#00d2b4`) veio do mockup do Stitch. Logo vetorial e paleta exata
  são pendência do Júnior. Não trocar um valor pelo outro sem a paleta oficial.
- **Tudo estático.** `next build` gera todas as páginas como SSG. A ficha usa
  `generateStaticParams` + `dynamicParams = false`. Componente que ler a URL
  (`useSearchParams`) fica em `Suspense` com fallback estático: o catálogo precisa
  aparecer sem JS.
- **Dado mora em `lib/`, não na página.** Equipamento em `lib/equipamentos.ts`, segmento
  em `lib/segmentos.ts`, contato em `lib/site.ts`. O tipo `Equipamento` é o contrato da
  ficha; campo opcional só aparece quando preenchido. Os destaques da home são buscados
  pelo slug e o build quebra se o slug sumir — de propósito.
- **Ícone novo entra em `lib/icones.ts`.** A fonte do Material Symbols é baixada só com
  os glifos listados; o tipo `IconName` acusa o que faltar.
- **Toda conversão termina no WhatsApp.** É e-commerce sem checkout: o link sai de
  `whatsappUrl()` com mensagem pronta que leva o código do equipamento
  (`mensagemProposta()`). Nada é enviado automaticamente. Hoje nenhum formulário grava
  dado, porque o painel ainda não existe.
- **SEO por rota.** Metadata escrita à mão em cada página (o catálogo usa o template
  `%s | Gravity Comercial`). Cada ficha publica canonical, Open Graph e JSON-LD
  `Product`/`Offer`; o `Offer` só entra quando há preço.
- **`Link` de `next/link`.** Não há i18n no projeto.
- **Celular primeiro.** O comprador consulta o catálogo de dentro da fábrica.

## O que o briefing decidiu

Da especificação e da ata, valem como regra de negócio:

- **O checklist é fonte única.** Os campos da ficha (identificação, técnico, estado,
  comercial, localização, documentação, mídia, interno) são os mesmos que a IA coleta na
  conversa. Mudar um campo da ficha é mudar o checklist.
- **Localização pública só até estado/região.** A cidade exata só é revelada depois da
  qualificação, para proteger a intermediação. Número de série e o bloco interno
  (vendedor, contato, comissão, termo de veracidade) nunca aparecem.
- **Nada vai ao ar sem moderação.** "Quero vender" é formulário sem login e sem CPF,
  pede o WhatsApp já no primeiro passo e cai numa fila "Em análise". Enquanto a fila não
  existe, `FormularioVenda` só monta a mensagem e abre o WhatsApp.
- **Rótulo, nunca slug.** O site atual exibe "a_combinar"; aqui todo valor exibido passa
  por rótulo (`ROTULO_STATUS`, `formatarPreco()`, `textoLocal()`).
- **Status é disponível, reservado ou vendido**, com selo sobre a imagem. Vendido sai do
  catálogo (`equipamentosAtivos()`); a prova social é `/vendidos`.
- **Bandeira do país no card**, não só na ficha. País sem confirmação na base aparece
  como "Local a confirmar" — nunca inventar país.
- **Bebidas deixa de ser o eixo** e vira um segmento entre outros. Categoria sem
  equipamento ativo sai do menu, mas mantém a página com CTA "Procuro este equipamento".
  Consultoria e montagem são serviço e não entram no catálogo.
- **Preço:** mantém o formato atual, "Sob consulta" quando não há valor, e o botão
  "Fazer Proposta".

## Onde o código diverge da especificação

Anotado, não corrigido — cada item depende de decisão:

- **URLs.** A spec pede `/equipamentos/{segmento}/{categoria}` com 301 das URLs antigas;
  o código tem página estática por segmento em `/segmentos/{segmento}`, sem nível de
  categoria.
- **Busca e filtros.** A spec pede catálogo com busca e filtros. O filtro rápido e a grade
  "Oportunidades em destaque" de `/segmentos` (com os filtros na URL, `?q=&segmento=&pais=&aba=`)
  saíram em 02/10/2026, a pedido; os equipamentos aparecem só na página de cada segmento.
  O código deles (`lib/filtros.ts`, `use-filtros.ts`, `ConsoleFiltros`, `GradeEquipamentos`)
  foi apagado em 05/10/2026 e está no histórico do git.
- **Segmentos.** A spec pede que segmento novo entre sem mexer no código; hoje é um
  `const` em `lib/segmentos.ts`. A home tem outra lista, própria (`SEGMENTOS_HOME` em
  `app/(home)/page.tsx`), com "Plásticos & reciclagem", que o `lib/` não tem.
- **Montagem Industrial.** A spec tira montagem do catálogo por ser serviço; `lib/segmentos.ts`
  segue o menu do site atual e a mantém como segmento, sem equipamento ("Sob demanda").
- **Páginas que ainda são âncoras.** `/quero-vender`, `/vendidos`, `/servicos`, `/sobre`,
  `/contato` e `/faq` hoje são seções de `/equipamentos` ou da home (`navegacao.ts`). As
  páginas legais (privacidade/LGPD e termos) não existem, e a spec exige aceite LGPD nos
  formulários.
- **Painel** (status em massa, duplicar anúncio, fila de moderação) não existe.
- **Paleta.** Duas turquesas; ver a regra de cores.

## Conteúdo real e conteúdo de demonstração

Verificado em `docs/product-sources.json` e nos comentários de `lib/`, não
suposto:

- **Só GRV-001 a GRV-004 são produtos reais** (brassagem, chiller, robô de solda,
  rinsagem), observados no site atual em 22/09/2026, com fotos em `public/assets/`. Os
  itens `GRV-8xxx`, os vendidos, os depoimentos de `/segmentos`, as métricas (+1.240
  negociados, R$ 180M+, 8.500 compradores), os "hubs" e as fotos de `public/equipamentos/`
  são **demonstração do mockup do Stitch**.
- **Os 10 depoimentos de `/depoimentos` são reais** (`lib/depoimentos.ts`), copiados da
  seção `#depoimentos` do site atual em 01/10/2026, com fotos em `public/assets/depoimentos/`.
  Duas correções estão anotadas no código ("Joinville/RS" virou SC; "supresa" virou
  "surpresa"), e a grafia "Itaroqem" ainda precisa ser confirmada. Confirmar com a Gravity se
  a autorização de uso dos nomes e das fotos vale também para o site novo.
- **Promessas a confirmar com a Gravity antes de publicar:** conta escrow, engenheiro
  credenciado, origem fiscal homologada, "Revisão 100% Gravity Lab", laudos NR-12/13 e o
  Júnior como especialista alocado em toda ficha.
- **O WhatsApp diverge no site atual.** Rodapé e widget usam +55 54 99643-4232 (o de
  `lib/site.ts`); os botões "Fazer Proposta" dos anúncios ainda apontam para
  51 99915-0665.
- **Preço e disponibilidade** dos produtos reais precisam ser confirmados com a equipe.
- **Foto de anúncio pode ser gerada por IA.** A imagem principal da rinsagem trazia a
  marca "Conteúdo gerado por IA" e foi descartada. Conferir cada foto tirada do site
  atual.
- **As fitas da logo não são o vetor oficial.** Foram vetorizadas do bitmap por
  `html/scripts/trace-brand.py` (hoje no histórico do git) e estão em `lib/marca.ts` e
  `public/assets/gravity-symbol.svg`. A arte conceitual da primeira home
  (`html/assets/gravity-core.*`) era gerada por IA e não entrou no site.

## Pendências do cliente

Tudo com o Júnior. Sem os três primeiros, o projeto para:

- Lista final de segmentos e categorias (`lib/segmentos.ts` é provisória).
- Modelo do checklist de equipamentos.
- Histórico de conversas reais, para a IA.
- Logo em vetor e paleta exata.
- Acesso ao domínio e à hospedagem (Hostinger); recuperação do `.com.br`.

## Movimento

A home concentra o movimento, portado da primeira home (`html/script.js`) para `HomeMotion`: parallax
da marca, partículas, revelação na rolagem, palavras que acendem, inclinação dos cards e
botões magnéticos. Catálogo e ficha ficam quietos.

`prefers-reduced-motion: reduce` desliga tudo isso (o `HomeMotion` repassa a preferência
ao `motionStore`) e não é opcional. O site não tem botão de pausar animações: ele foi
retirado a pedido em 02/10/2026. As partículas param quando o hero
sai de vista ou a aba fica oculta. O conteúdo continua visível sem
`IntersectionObserver`: a classe `js-motion` só entra quando ele existe.

---

## Fluxo obrigatório

Para toda instrução, seguir nesta ordem — sem exceção:

1. **Ler** — identificar e ler todos os arquivos relacionados à instrução
   (componentes, estilos, tipos, utilitários, rotas, testes).
2. **Confirmar** — responder com:
   - **Entendi:** (resumo de 2–3 frases do que foi pedido)
   - **Arquivos que vou alterar:** (nome e caminho de cada um)
   - **O que muda em cada um:** (descrição breve por arquivo)
3. **Aguardar** — não fazer nenhuma alteração até receber confirmação explícita
   ("ok", "pode ir", "sim" ou equivalente).
4. **Executar** — só depois da confirmação, implementar exatamente o combinado.
   Não ampliar escopo sem avisar antes.

Se qualquer parte da instrução estiver ambígua, perguntar antes de ler os arquivos.

---

## Regras

**Fazer:**

- Seguir os padrões existentes do projeto (nomes, estrutura, estilo)
- Ficar no escopo estrito do que foi pedido
- Relatar qualquer problema encontrado fora do escopo antes de agir sobre ele
- Conferir imports, exports e dependências afetadas
- Avisar se uma mudança pode quebrar algo em outro lugar

**Não fazer:**

- Alterar arquivos sem apresentar o plano e aguardar confirmação
- Assumir qualquer coisa que não tenha sido dita explicitamente
- Refatorar código além do que foi pedido
- Renomear, mover ou apagar arquivos sem aprovação explícita
- Instalar dependências novas sem informar e aguardar confirmação
- Criar arquivos novos sem avisar antes
- Reescrever lógica funcional ao corrigir algo simples

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
